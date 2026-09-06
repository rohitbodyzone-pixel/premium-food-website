import { prisma } from '../db/prisma';

export interface ScheduleSlotInput {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
}

export interface TimeOffInput {
  startDate: string; // "2026-09-15"
  endDate: string;   // "2026-09-18"
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  reason?: string;
}

export interface GeneratedSlot {
  startUtc: string;
  endUtc: string;
  startTime: string;
  endTime: string;
  date: string;
  localDisplay: string;
  timezone: string;
  durationMinutes: number;
}

/**
 * Converts a calendar date and time in an IANA timezone into a UTC Date object.
 */
export function localToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naiveUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(naiveUtc);
  const partMap: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = Number(part.value);
    }
  }

  const formattedAsUtc = Date.UTC(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    partMap.hour,
    partMap.minute,
    partMap.second || 0
  );

  const diffMs = naiveUtc.getTime() - formattedAsUtc;
  return new Date(naiveUtc.getTime() + diffMs);
}

/**
 * Converts a UTC Date into local dateStr and timeStr for an IANA timezone.
 */
export function utcToLocal(date: Date, timeZone: string): { dateStr: string; timeStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const formatted = formatter.format(date);
  const [dateStr, timeStr] = formatted.split(', ');
  return { dateStr, timeStr };
}

export class AvailabilityService {
  /**
   * Validates weekly schedule slot entries.
   * Ensures valid days, 24h time format, start < end, and no overlaps on the same day.
   */
  validateWeeklySchedule(slots: ScheduleSlotInput[]): { valid: boolean; error?: string } {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const slot of slots) {
      if (typeof slot.dayOfWeek !== 'number' || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        return { valid: false, error: 'dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)' };
      }
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return { valid: false, error: `Invalid time format in slot. Expected HH:mm (24-hour), got ${slot.startTime} - ${slot.endTime}` };
      }
      if (slot.startTime >= slot.endTime) {
        return { valid: false, error: `Start time (${slot.startTime}) must be strictly earlier than end time (${slot.endTime})` };
      }
    }

    // Check overlaps within same day
    for (let day = 0; day <= 6; day++) {
      const daySlots = slots.filter((s) => s.dayOfWeek === day);
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          const a = daySlots[i];
          const b = daySlots[j];
          if (a.startTime < b.endTime && b.startTime < a.endTime) {
            return {
              valid: false,
              error: `Overlapping schedule blocks detected on day ${day}: ${a.startTime}-${a.endTime} overlaps with ${b.startTime}-${b.endTime}`,
            };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Retrieves an expert's weekly schedule.
   */
  async getWeeklySchedule(expertProfileId: string) {
    return prisma.appointmentSlot.findMany({
      where: { expertProfileId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Saves or replaces an expert's weekly schedule.
   */
  async saveWeeklySchedule(expertProfileId: string, slots: ScheduleSlotInput[]) {
    const validation = this.validateWeeklySchedule(slots);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return prisma.$transaction(async (tx) => {
      // Clear existing slots
      await tx.appointmentSlot.deleteMany({
        where: { expertProfileId },
      });

      // Insert new slots
      if (slots.length > 0) {
        await tx.appointmentSlot.createMany({
          data: slots.map((s) => ({
            expertProfileId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: true,
          })),
        });
      }

      return tx.appointmentSlot.findMany({
        where: { expertProfileId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  }

  /**
   * Retrieves expert time-off blocks.
   */
  async getTimeOff(expertProfileId: string) {
    return prisma.expertTimeOff.findMany({
      where: { expertProfileId },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Creates a time-off block with validation.
   */
  async createTimeOff(expertProfileId: string, data: TimeOffInput) {
    const { startDate, endDate, startTime, endTime, isAllDay = true, reason } = data;

    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    if (startDate > endDate) {
      throw new Error('startDate cannot be after endDate');
    }

    if (!isAllDay) {
      if (!startTime || !endTime) {
        throw new Error('startTime and endTime are required for partial day time-off');
      }
      if (startDate === endDate && startTime >= endTime) {
        throw new Error('startTime must be before endTime for partial day time-off');
      }
    }

    return prisma.expertTimeOff.create({
      data: {
        expertProfileId,
        startDate,
        endDate,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        isAllDay,
        reason,
      },
    });
  }

  /**
   * Deletes a time-off block.
   */
  async deleteTimeOff(expertProfileId: string, timeOffId: string) {
    const item = await prisma.expertTimeOff.findUnique({
      where: { id: timeOffId },
    });

    if (!item) {
      throw new Error('Time-off block not found');
    }

    if (item.expertProfileId !== expertProfileId) {
      throw new Error('Unauthorized to delete this time-off block');
    }

    return prisma.expertTimeOff.delete({
      where: { id: timeOffId },
    });
  }

  /**
   * Generates timezone-safe, conflict-free appointment slots for an expert on a given date.
   */
  async generateSlots(
    expertProfileId: string,
    dateStr: string,
    durationMinutes: number = 30,
    clientTimezone?: string
  ): Promise<{ expertId: string; date: string; timezone: string; availableSlots: GeneratedSlot[] }> {
    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertProfileId },
      include: {
        availabilitySlots: true,
        timeOffBlocks: true,
      },
    });

    if (!expert) {
      throw new Error('Expert not found');
    }

    const expertTz = expert.timezone || 'Pacific/Auckland';
    const displayTz = clientTimezone || expertTz;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    // Determine day of week in expert's timezone
    const noonLocal = localToUtc(dateStr, '12:00', expertTz);
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = noonLocal.getUTCDay();

    // Check max advance days
    const now = new Date();
    const maxDate = new Date(now.getTime() + (expert.maxAdvanceDays || 60) * 24 * 60 * 60 * 1000);
    const requestedMidnight = localToUtc(dateStr, '00:00', expertTz);
    if (requestedMidnight > maxDate) {
      return { expertId: expertProfileId, date: dateStr, timezone: displayTz, availableSlots: [] };
    }

    // Get availability blocks for this day of week
    let scheduleBlocks = expert.availabilitySlots.filter((s) => s.dayOfWeek === dayOfWeek && s.isAvailable);

    // Fallback default: Monday to Friday 09:00 - 17:00 if expert hasn't configured any slots
    if (expert.availabilitySlots.length === 0 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      scheduleBlocks = [
        {
          id: 'default',
          expertProfileId,
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true,
        },
      ];
    }

    if (scheduleBlocks.length === 0) {
      return { expertId: expertProfileId, date: dateStr, timezone: displayTz, availableSlots: [] };
    }

    // Existing confirmed/pending appointments on or overlapping this date
    const dayStartUtc = localToUtc(dateStr, '00:00', expertTz);
    const dayEndUtc = localToUtc(dateStr, '23:59', expertTz);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        expertId: expertProfileId,
        status: { in: ['BOOKED', 'CONFIRMED', 'PENDING'] },
        OR: [
          { date: dateStr },
          {
            startUtc: { lte: dayEndUtc },
            endUtc: { gte: dayStartUtc },
          },
        ],
      },
    });

    const bufferMs = (expert.bufferMinutes || 10) * 60 * 1000;
    const minNoticeMs = (expert.minimumNoticeMinutes || 120) * 60 * 1000;
    const minBookingTime = now.getTime() + minNoticeMs;

    const availableSlots: GeneratedSlot[] = [];

    for (const block of scheduleBlocks) {
      const [startHour, startMin] = block.startTime.split(':').map(Number);
      const [endHour, endMin] = block.endTime.split(':').map(Number);

      let currentMinute = startHour * 60 + startMin;
      const endBlockMinute = endHour * 60 + endMin;

      while (currentMinute + durationMinutes <= endBlockMinute) {
        const slotStartH = Math.floor(currentMinute / 60).toString().padStart(2, '0');
        const slotStartM = (currentMinute % 60).toString().padStart(2, '0');
        const slotStartTimeStr = `${slotStartH}:${slotStartM}`;

        const slotEndMinute = currentMinute + durationMinutes;
        const slotEndH = Math.floor(slotEndMinute / 60).toString().padStart(2, '0');
        const slotEndM = (slotEndMinute % 60).toString().padStart(2, '0');
        const slotEndTimeStr = `${slotEndH}:${slotEndM}`;

        const slotStartUtc = localToUtc(dateStr, slotStartTimeStr, expertTz);
        const slotEndUtc = new Date(slotStartUtc.getTime() + durationMinutes * 60 * 1000);

        // 1. Notice filter: must be in the future beyond minimum notice
        if (slotStartUtc.getTime() >= minBookingTime) {
          // 2. Time-off filter
          let isBlockedByTimeOff = false;
          for (const to of expert.timeOffBlocks) {
            if (dateStr >= to.startDate && dateStr <= to.endDate) {
              if (to.isAllDay) {
                isBlockedByTimeOff = true;
                break;
              } else if (to.startTime && to.endTime) {
                const toStartUtc = localToUtc(to.startDate, to.startTime, expertTz);
                const toEndUtc = localToUtc(to.endDate, to.endTime, expertTz);
                if (slotStartUtc < toEndUtc && slotEndUtc > toStartUtc) {
                  isBlockedByTimeOff = true;
                  break;
                }
              }
            }
          }

          // 3. Existing appointment conflict filter (with buffer)
          let isConflict = false;
          if (!isBlockedByTimeOff) {
            for (const appt of existingAppointments) {
              const apptStartUtc = appt.startUtc || localToUtc(appt.date, appt.startTime, appt.timezone || expertTz);
              const apptEndUtc = appt.endUtc || localToUtc(appt.date, appt.endTime, appt.timezone || expertTz);

              const apptWithBufferEnd = new Date(apptEndUtc.getTime() + bufferMs);
              const slotWithBufferEnd = new Date(slotEndUtc.getTime() + bufferMs);

              if (slotStartUtc < apptWithBufferEnd && apptStartUtc < slotWithBufferEnd) {
                isConflict = true;
                break;
              }
            }
          }

          if (!isBlockedByTimeOff && !isConflict) {
            // Convert to display timezone
            const localDisplayTimes = displayTz === expertTz
              ? { dateStr, startTime: slotStartTimeStr, endTime: slotEndTimeStr }
              : {
                  dateStr: utcToLocal(slotStartUtc, displayTz).dateStr,
                  startTime: utcToLocal(slotStartUtc, displayTz).timeStr,
                  endTime: utcToLocal(slotEndUtc, displayTz).timeStr,
                };

            availableSlots.push({
              startUtc: slotStartUtc.toISOString(),
              endUtc: slotEndUtc.toISOString(),
              startTime: localDisplayTimes.startTime,
              endTime: localDisplayTimes.endTime,
              date: localDisplayTimes.dateStr,
              localDisplay: `${localDisplayTimes.startTime} - ${localDisplayTimes.endTime}`,
              timezone: displayTz,
              durationMinutes,
            });
          }
        }

        // Increment candidate slot (step by duration + buffer)
        currentMinute += durationMinutes + (expert.bufferMinutes || 10);
      }
    }

    return {
      expertId: expertProfileId,
      date: dateStr,
      timezone: displayTz,
      availableSlots,
    };
  }
}

export const availabilityService = new AvailabilityService();
