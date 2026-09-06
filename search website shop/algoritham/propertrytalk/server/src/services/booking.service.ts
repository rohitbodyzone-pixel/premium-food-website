import { prisma } from '../db/prisma';
import { localToUtc } from './availability.service';
import { notificationService } from './notification.service';
import { getEmailProvider } from './email/email-provider.factory';

export interface BookAppointmentInput {
  expertId: string;
  consumerId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "10:00"
  endTime: string; // "10:45"
  startUtc?: string | Date;
  endUtc?: string | Date;
  timezone?: string;
  consultationType?: string; // "VIDEO" | "AUDIO" | "CHAT"
  durationMinutes?: number;
  notes?: string;
}

export interface RescheduleAppointmentInput {
  appointmentId: string;
  userId: string;
  userRole: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  newStartUtc?: string | Date;
  newEndUtc?: string | Date;
  reason?: string;
}

export interface CancelAppointmentInput {
  appointmentId: string;
  userId: string;
  userRole: string;
  reason?: string;
}

export class BookingService {
  /**
   * Atomically books an appointment inside a database transaction with strict conflict protection.
   */
  async bookAppointment(input: BookAppointmentInput) {
    const {
      expertId,
      consumerId,
      date,
      startTime,
      endTime,
      timezone,
      consultationType = 'VIDEO',
      durationMinutes = 45,
      notes,
    } = input;

    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        category: true,
      },
    });

    if (!expert) {
      throw new Error('Expert not found');
    }

    const consumer = await prisma.user.findUnique({
      where: { id: consumerId },
      select: { id: true, name: true, email: true },
    });

    if (!consumer) {
      throw new Error('Consumer not found');
    }

    const expertTz = expert.timezone || 'Pacific/Auckland';
    const apptTz = timezone || expertTz;

    const startUtc = input.startUtc ? new Date(input.startUtc) : localToUtc(date, startTime, apptTz);
    const endUtc = input.endUtc ? new Date(input.endUtc) : localToUtc(date, endTime, apptTz);

    if (startUtc >= endUtc) {
      throw new Error('Appointment start time must be before end time');
    }

    const bufferMs = (expert.bufferMinutes || 10) * 60 * 1000;
    const startWithBuffer = new Date(startUtc.getTime() - bufferMs);
    const endWithBuffer = new Date(endUtc.getTime() + bufferMs);

    // Concurrency Lock: Atomic check and insert inside transaction
    const appointment = await prisma.$transaction(async (tx) => {
      // 1. Conflict check: existing active appointments
      const conflict = await tx.appointment.findFirst({
        where: {
          expertId,
          status: { in: ['CONFIRMED', 'BOOKED', 'PENDING'] },
          OR: [
            // Exact date and time match
            { date, startTime },
            // Overlapping UTC intervals considering buffer
            {
              startUtc: { lt: endWithBuffer },
              endUtc: { gt: startWithBuffer },
            },
          ],
        },
      });

      if (conflict) {
        const err = new Error('The selected appointment time is no longer available. Please select another slot.');
        (err as any).statusCode = 409;
        throw err;
      }

      // 2. Conflict check: time-off blocks
      const timeOffBlocks = await tx.expertTimeOff.findMany({
        where: {
          expertProfileId: expertId,
          startDate: { lte: date },
          endDate: { gte: date },
        },
      });

      for (const to of timeOffBlocks) {
        if (to.isAllDay) {
          const err = new Error('The expert is on scheduled time-off on this date.');
          (err as any).statusCode = 409;
          throw err;
        }
        if (to.startTime && to.endTime) {
          const toStart = localToUtc(to.startDate, to.startTime, expertTz);
          const toEnd = localToUtc(to.endDate, to.endTime, expertTz);
          if (startUtc < toEnd && endUtc > toStart) {
            const err = new Error('The selected time overlaps with an expert time-off block.');
            (err as any).statusCode = 409;
            throw err;
          }
        }
      }

      // 3. Create appointment
      return tx.appointment.create({
        data: {
          expertId,
          consumerId,
          date,
          startTime,
          endTime,
          startUtc,
          endUtc,
          timezone: apptTz,
          consultationType,
          durationMinutes,
          notes,
          status: 'CONFIRMED',
        },
        include: {
          expert: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              category: true,
            },
          },
          consumer: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      });
    });

    // Post-creation notifications & emails (asynchronous / safe)
    const emailProvider = getEmailProvider();
    const formattedDate = `${appointment.date} at ${appointment.startTime} (${appointment.timezone})`;

    // In-app alert for consumer
    notificationService.createNotification({
      userId: consumer.id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment Confirmed',
      body: `Your consultation with ${expert.user.name} on ${formattedDate} has been confirmed.`,
      priority: 'HIGH',
      dataJson: { appointmentId: appointment.id, date, startTime, expertId },
    }).catch((err) => console.error('Consumer appointment notification error:', err));

    // In-app alert for expert
    notificationService.createNotification({
      userId: expert.user.id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'New Appointment Booked',
      body: `${consumer.name} booked a consultation with you for ${formattedDate}.`,
      priority: 'HIGH',
      dataJson: { appointmentId: appointment.id, date, startTime, consumerId },
    }).catch((err) => console.error('Expert appointment notification error:', err));

    // Send confirmation emails
    const apptDetails = {
      id: appointment.id,
      expertName: expert.user.name,
      consumerName: consumer.name,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      timezone: appointment.timezone,
      consultationType: appointment.consultationType,
      notes: appointment.notes,
    };

    if (consumer.email) {
      emailProvider.sendAppointmentConfirmation({
        to: consumer.email,
        name: consumer.name,
        isExpert: false,
        appointment: apptDetails,
      }).catch((err) => console.error('Consumer appointment email error:', err));
    }

    if (expert.user.email) {
      emailProvider.sendAppointmentConfirmation({
        to: expert.user.email,
        name: expert.user.name,
        isExpert: true,
        appointment: apptDetails,
      }).catch((err) => console.error('Expert appointment email error:', err));
    }

    return appointment;
  }

  /**
   * Reschedules an appointment atomically with conflict validation.
   */
  async rescheduleAppointment(input: RescheduleAppointmentInput) {
    const {
      appointmentId,
      userId,
      userRole,
      newDate,
      newStartTime,
      newEndTime,
      reason,
    } = input;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Permission check
    const isAuthorized =
      appointment.consumerId === userId ||
      appointment.expert.userId === userId ||
      userRole === 'SUPER_ADMIN';

    if (!isAuthorized) {
      const err = new Error('Unauthorized to reschedule this appointment');
      (err as any).statusCode = 403;
      throw err;
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      const err = new Error(`Cannot reschedule an appointment that is already ${appointment.status.toLowerCase()}`);
      (err as any).statusCode = 400;
      throw err;
    }

    const apptTz = appointment.timezone || appointment.expert.timezone || 'Pacific/Auckland';
    const newStartUtc = input.newStartUtc ? new Date(input.newStartUtc) : localToUtc(newDate, newStartTime, apptTz);
    const newEndUtc = input.newEndUtc ? new Date(input.newEndUtc) : localToUtc(newDate, newEndTime, apptTz);

    const bufferMs = (appointment.expert.bufferMinutes || 10) * 60 * 1000;
    const startWithBuffer = new Date(newStartUtc.getTime() - bufferMs);
    const endWithBuffer = new Date(newEndUtc.getTime() + bufferMs);

    const updated = await prisma.$transaction(async (tx) => {
      // Check conflict for new time (excluding this appointment)
      const conflict = await tx.appointment.findFirst({
        where: {
          id: { not: appointmentId },
          expertId: appointment.expertId,
          status: { in: ['CONFIRMED', 'BOOKED', 'PENDING'] },
          OR: [
            { date: newDate, startTime: newStartTime },
            {
              startUtc: { lt: endWithBuffer },
              endUtc: { gt: startWithBuffer },
            },
          ],
        },
      });

      if (conflict) {
        const err = new Error('The requested new time slot is not available. Please select another slot.');
        (err as any).statusCode = 409;
        throw err;
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          startUtc: newStartUtc,
          endUtc: newEndUtc,
          rescheduledFromId: appointment.id,
          rescheduleReason: reason || 'Rescheduled by user',
          rescheduledBy: userRole,
          rescheduledAt: new Date(),
          status: 'CONFIRMED',
          reminder24hSent: false,
          reminder1hSent: false,
        },
        include: {
          expert: { include: { user: true } },
          consumer: true,
        },
      });
    });

    const newFormattedDate = `${newDate} at ${newStartTime} (${updated.timezone})`;

    // Dispatches notifications to both parties
    notificationService.createNotification({
      userId: updated.consumerId,
      type: 'APPOINTMENT_RESCHEDULED',
      title: 'Appointment Rescheduled',
      body: `Your appointment with ${updated.expert.user.name} was rescheduled to ${newFormattedDate}.`,
      priority: 'HIGH',
      dataJson: { appointmentId, newDate, newStartTime, reason },
    }).catch(() => {});

    notificationService.createNotification({
      userId: updated.expert.userId,
      type: 'APPOINTMENT_RESCHEDULED',
      title: 'Appointment Rescheduled',
      body: `Consultation with ${updated.consumer.name} was rescheduled to ${newFormattedDate}.`,
      priority: 'HIGH',
      dataJson: { appointmentId, newDate, newStartTime, reason },
    }).catch(() => {});

    return updated;
  }

  /**
   * Cancels an appointment and notifies all participants.
   */
  async cancelAppointment(input: CancelAppointmentInput) {
    const { appointmentId, userId, userRole, reason } = input;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const isAuthorized =
      appointment.consumerId === userId ||
      appointment.expert.userId === userId ||
      userRole === 'SUPER_ADMIN';

    if (!isAuthorized) {
      const err = new Error('Unauthorized to cancel this appointment');
      (err as any).statusCode = 403;
      throw err;
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      const err = new Error(`Appointment is already ${appointment.status.toLowerCase()}`);
      (err as any).statusCode = 400;
      throw err;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        cancelledBy: userRole,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelled by user',
      },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    // Notify consumer
    notificationService.createNotification({
      userId: updated.consumerId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      body: `Your appointment on ${updated.date} at ${updated.startTime} has been cancelled.`,
      priority: 'HIGH',
      dataJson: { appointmentId, reason },
    }).catch(() => {});

    // Notify expert
    notificationService.createNotification({
      userId: updated.expert.userId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      body: `Appointment with ${updated.consumer.name} on ${updated.date} at ${updated.startTime} has been cancelled.`,
      priority: 'HIGH',
      dataJson: { appointmentId, reason },
    }).catch(() => {});

    return updated;
  }
}

export const bookingService = new BookingService();
