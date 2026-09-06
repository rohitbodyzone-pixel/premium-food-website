import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { availabilityService } from '../services/availability.service';
import { bookingService } from '../services/booking.service';

const router = Router();

// 1. Get timezone-safe availability slots for an expert
router.get('/slots/:expertId', async (req: Request, res: Response) => {
  try {
    const { expertId } = req.params;
    const { date, duration, timezone } = req.query;

    const dateStr = (date as string) || new Date().toISOString().split('T')[0];
    const durationMinutes = duration ? parseInt(duration as string, 10) : 30;

    const result = await availabilityService.generateSlots(
      expertId,
      dateStr,
      durationMinutes,
      timezone as string | undefined
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching appointment slots:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch appointment slots' });
  }
});

// 2. Book an appointment with atomic concurrency conflict protection
router.post('/book', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      expertId,
      date,
      slotTime,
      startTime: directStartTime,
      endTime: directEndTime,
      startUtc,
      endUtc,
      notes,
      timezone,
      consultationType = 'VIDEO',
      durationMinutes = 45,
    } = req.body;
    const consumerId = req.user!.id;

    if (!expertId || !date || (!slotTime && !directStartTime)) {
      res.status(400).json({ error: 'Expert ID, date, and slot time are required' });
      return;
    }

    let startTime = directStartTime;
    let endTime = directEndTime;

    if (slotTime && !startTime) {
      const parts = slotTime.split(' - ');
      startTime = parts[0];
      endTime = parts[1] || '10:45';
    }

    const appointment = await bookingService.bookAppointment({
      expertId,
      consumerId,
      date,
      startTime,
      endTime: endTime || '10:45',
      startUtc,
      endUtc,
      timezone,
      consultationType,
      durationMinutes: typeof durationMinutes === 'string' ? parseInt(durationMinutes, 10) : durationMinutes,
      notes,
    });

    res.status(201).json(appointment);
  } catch (error: any) {
    console.error('Error booking appointment:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to book appointment' });
  }
});

// 3. List appointments for authenticated user (Consumer or Expert)
router.get('/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isExpert = req.user!.role === 'EXPERT' && req.user!.expertProfileId;

    const appointments = await prisma.appointment.findMany({
      where: isExpert
        ? { expertId: req.user!.expertProfileId }
        : { consumerId: userId },
      include: {
        expert: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            category: true,
            country: true,
          },
        },
        consumer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// 4. Reschedule appointment
router.patch('/:id/reschedule', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, slotTime, reason, startUtc, endUtc } = req.body;

    let finalStartTime = startTime;
    let finalEndTime = endTime;

    if (slotTime && !finalStartTime) {
      const parts = slotTime.split(' - ');
      finalStartTime = parts[0];
      finalEndTime = parts[1] || '10:45';
    }

    if (!date || !finalStartTime) {
      res.status(400).json({ error: 'New date and startTime/slotTime are required' });
      return;
    }

    const updated = await bookingService.rescheduleAppointment({
      appointmentId: id,
      userId: req.user!.id,
      userRole: req.user!.role,
      newDate: date,
      newStartTime: finalStartTime,
      newEndTime: finalEndTime || '10:45',
      newStartUtc: startUtc,
      newEndUtc: endUtc,
      reason,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error rescheduling appointment:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to reschedule appointment' });
  }
});

// 5. Cancel appointment
router.patch('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const updated = await bookingService.cancelAppointment({
      appointmentId: id,
      userId: req.user!.id,
      userRole: req.user!.role,
      reason,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error cancelling appointment:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to cancel appointment' });
  }
});

// 6. Expert: Get weekly availability schedule & settings
router.get('/expert/availability', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'EXPERT' && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only experts can access availability configuration' });
      return;
    }

    const expertProfileId = req.user!.expertProfileId;
    if (!expertProfileId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'Expert profile not found for user' });
      return;
    }

    const targetId = (req.query.expertProfileId as string) || expertProfileId!;
    const expert = await prisma.expertProfile.findUnique({
      where: { id: targetId },
      include: { availabilitySlots: true },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    res.json({
      expertProfileId: targetId,
      timezone: expert.timezone || 'Pacific/Auckland',
      bufferMinutes: expert.bufferMinutes,
      minimumNoticeMinutes: expert.minimumNoticeMinutes,
      maxAdvanceDays: expert.maxAdvanceDays,
      appointmentDurations: JSON.parse(expert.appointmentDurations || '[15,30,45,60]'),
      slots: expert.availabilitySlots,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability schedule' });
  }
});

// 7. Expert: Save weekly availability schedule & settings
router.put('/expert/availability', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'EXPERT' && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only experts can update availability schedule' });
      return;
    }

    const expertProfileId = req.user!.expertProfileId;
    if (!expertProfileId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'Expert profile not found for user' });
      return;
    }

    const targetId = (req.body.expertProfileId as string) || expertProfileId!;
    const { slots, timezone, bufferMinutes, minimumNoticeMinutes, maxAdvanceDays, appointmentDurations } = req.body;

    // Update settings if provided
    const updateData: any = {};
    if (timezone) updateData.timezone = timezone;
    if (bufferMinutes !== undefined) updateData.bufferMinutes = bufferMinutes;
    if (minimumNoticeMinutes !== undefined) updateData.minimumNoticeMinutes = minimumNoticeMinutes;
    if (maxAdvanceDays !== undefined) updateData.maxAdvanceDays = maxAdvanceDays;
    if (appointmentDurations) updateData.appointmentDurations = JSON.stringify(appointmentDurations);

    if (Object.keys(updateData).length > 0) {
      await prisma.expertProfile.update({
        where: { id: targetId },
        data: updateData,
      });
    }

    // Update weekly schedule slots if provided
    let updatedSlots = [];
    if (Array.isArray(slots)) {
      updatedSlots = await availabilityService.saveWeeklySchedule(targetId, slots);
    } else {
      updatedSlots = await availabilityService.getWeeklySchedule(targetId);
    }

    res.json({
      success: true,
      expertProfileId: targetId,
      slots: updatedSlots,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to save availability schedule' });
  }
});

// 8. Expert: Get time-off blocks
router.get('/expert/time-off', requireAuth, async (req: Request, res: Response) => {
  try {
    const expertProfileId = req.user!.expertProfileId;
    if (!expertProfileId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'Expert profile not found for user' });
      return;
    }

    const targetId = (req.query.expertProfileId as string) || expertProfileId!;
    const timeOff = await availabilityService.getTimeOff(targetId);
    res.json(timeOff);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch time-off blocks' });
  }
});

// 9. Expert: Add time-off block
router.post('/expert/time-off', requireAuth, async (req: Request, res: Response) => {
  try {
    const expertProfileId = req.user!.expertProfileId;
    if (!expertProfileId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'Expert profile not found for user' });
      return;
    }

    const targetId = (req.body.expertProfileId as string) || expertProfileId!;
    const { startDate, endDate, startTime, endTime, isAllDay = true, reason } = req.body;

    const created = await availabilityService.createTimeOff(targetId, {
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      reason,
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create time-off block' });
  }
});

// 10. Expert: Delete time-off block
router.delete('/expert/time-off/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const expertProfileId = req.user!.expertProfileId;
    if (!expertProfileId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'Expert profile not found for user' });
      return;
    }

    const targetId = (req.query.expertProfileId as string) || expertProfileId!;
    await availabilityService.deleteTimeOff(targetId, req.params.id);

    res.json({ success: true, message: 'Time-off block deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete time-off block' });
  }
});

export default router;
