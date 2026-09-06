import { prisma } from '../db/prisma';
import { notificationService } from './notification.service';
import { getEmailProvider } from './email/email-provider.factory';

export class AppointmentReminderService {
  private timer?: NodeJS.Timeout;

  /**
   * Starts background reminder runner every 5 minutes.
   */
  startScheduler(intervalMs = 5 * 60 * 1000) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.checkAndSendReminders().catch((err) => {
        console.error('Error running appointment reminder cycle:', err);
      });
    }, intervalMs);
    console.log('⏰ [Reminders] Appointment reminder runner started (5m interval).');
  }

  stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Scans confirmed appointments and dispatches 24h and 1h reminders.
   * Deduplicates by checking reminder24hSent and reminder1hSent flags.
   */
  async checkAndSendReminders(): Promise<{ sent24h: number; sent1h: number }> {
    const now = new Date();
    const emailProvider = getEmailProvider();

    // 1. 24-Hour Reminder Window: between now + 23 hours and now + 25 hours
    const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const window24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const due24h = await prisma.appointment.findMany({
      where: {
        status: { in: ['CONFIRMED', 'BOOKED'] },
        reminder24hSent: false,
        startUtc: {
          gte: window24hStart,
          lte: window24hEnd,
        },
      },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    let sent24h = 0;
    for (const appt of due24h) {
      // Mark sent first to prevent duplicate sends
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminder24hSent: true },
      });

      const formatted = `${appt.date} at ${appt.startTime} (${appt.timezone})`;

      // Consumer alert
      await notificationService.createNotification({
        userId: appt.consumerId,
        type: 'APPOINTMENT_REMINDER_24H',
        title: 'Appointment Reminder (24 Hours)',
        body: `Reminder: Your consultation with ${appt.expert.user.name} is tomorrow at ${appt.startTime}.`,
        priority: 'NORMAL',
        dedupeKey: `reminder_24h_${appt.id}_consumer`,
        dataJson: { appointmentId: appt.id, date: appt.date, startTime: appt.startTime },
      });

      // Expert alert
      await notificationService.createNotification({
        userId: appt.expert.userId,
        type: 'APPOINTMENT_REMINDER_24H',
        title: 'Appointment Reminder (24 Hours)',
        body: `Reminder: You have an upcoming consultation with ${appt.consumer.name} tomorrow at ${appt.startTime}.`,
        priority: 'NORMAL',
        dedupeKey: `reminder_24h_${appt.id}_expert`,
        dataJson: { appointmentId: appt.id, date: appt.date, startTime: appt.startTime },
      });

      // Email
      const apptEmail = {
        id: appt.id,
        expertName: appt.expert.user.name,
        consumerName: appt.consumer.name,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
        timezone: appt.timezone,
        consultationType: appt.consultationType,
        notes: appt.notes,
      };

      if (appt.consumer.email) {
        emailProvider.sendAppointmentReminder({
          to: appt.consumer.email,
          name: appt.consumer.name,
          isExpert: false,
          appointment: apptEmail,
          reminderWindow: '24h',
        }).catch(() => {});
      }

      sent24h++;
    }

    // 2. 1-Hour Reminder Window: between now + 50 minutes and now + 70 minutes
    const window1hStart = new Date(now.getTime() + 50 * 60 * 1000);
    const window1hEnd = new Date(now.getTime() + 70 * 60 * 1000);

    const due1h = await prisma.appointment.findMany({
      where: {
        status: { in: ['CONFIRMED', 'BOOKED'] },
        reminder1hSent: false,
        startUtc: {
          gte: window1hStart,
          lte: window1hEnd,
        },
      },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    let sent1h = 0;
    for (const appt of due1h) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminder1hSent: true },
      });

      // Consumer alert
      await notificationService.createNotification({
        userId: appt.consumerId,
        type: 'APPOINTMENT_REMINDER_1H',
        title: 'Appointment in 1 Hour',
        body: `Your consultation with ${appt.expert.user.name} starts in 1 hour (${appt.startTime}).`,
        priority: 'HIGH',
        dedupeKey: `reminder_1h_${appt.id}_consumer`,
        dataJson: { appointmentId: appt.id, date: appt.date, startTime: appt.startTime },
      });

      // Expert alert
      await notificationService.createNotification({
        userId: appt.expert.userId,
        type: 'APPOINTMENT_REMINDER_1H',
        title: 'Appointment in 1 Hour',
        body: `Consultation with ${appt.consumer.name} starts in 1 hour (${appt.startTime}).`,
        priority: 'HIGH',
        dedupeKey: `reminder_1h_${appt.id}_expert`,
        dataJson: { appointmentId: appt.id, date: appt.date, startTime: appt.startTime },
      });

      // Email
      if (appt.consumer.email) {
        emailProvider.sendAppointmentReminder({
          to: appt.consumer.email,
          name: appt.consumer.name,
          isExpert: false,
          appointment: {
            id: appt.id,
            expertName: appt.expert.user.name,
            consumerName: appt.consumer.name,
            date: appt.date,
            startTime: appt.startTime,
            endTime: appt.endTime,
            timezone: appt.timezone,
            consultationType: appt.consultationType,
            notes: appt.notes,
          },
          reminderWindow: '1h',
        }).catch(() => {});
      }

      sent1h++;
    }

    return { sent24h, sent1h };
  }
}

export const appointmentReminderService = new AppointmentReminderService();
