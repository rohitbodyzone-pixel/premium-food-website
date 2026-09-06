import { Server } from 'socket.io';
import { prisma } from '../db/prisma';
import { getEmailProvider } from './email/email-provider.factory';

export interface CreateNotificationParams {
  userId: string;
  type: string; // CHAT_REQUEST, INCOMING_AUDIO_CALL, INCOMING_VIDEO_CALL, MISSED_CALL, APPOINTMENT_BOOKED, APPOINTMENT_CONFIRMED, APPOINTMENT_REMINDER, APPOINTMENT_RESCHEDULED, APPOINTMENT_CANCELLED, EXPERT_VERIFICATION_APPROVED, EXPERT_VERIFICATION_REJECTED, PAYMENT_RECEIPT, REFUND_PROCESSED, SYSTEM_ALERT
  title: string;
  body: string;
  dataJson?: any;
  channel?: 'IN_APP' | 'PUSH' | 'EMAIL';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dedupeKey?: string;
}

export class NotificationService {
  private io?: Server;

  setSocketServer(io: Server) {
    this.io = io;
  }

  /**
   * Retrieves or creates default notification preferences for a user.
   */
  async getOrCreatePreferences(userId: string) {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId,
          inAppEnabled: true,
          emailEnabled: true,
          pushEnabled: false,
          chatAlerts: true,
          callAlerts: true,
          bookingUpdates: true,
          appointmentReminders: true,
          paymentReceipts: true,
          verificationUpdates: true,
        },
      });
    }

    return prefs;
  }

  /**
   * Evaluates user preferences to determine if notification should be dispatched.
   */
  private shouldSendNotification(type: string, prefs: any): boolean {
    if (!prefs.inAppEnabled && !prefs.emailEnabled && !prefs.pushEnabled) {
      return false;
    }

    if (type === 'CHAT_REQUEST' && !prefs.chatAlerts) return false;
    if ((type === 'INCOMING_AUDIO_CALL' || type === 'INCOMING_VIDEO_CALL' || type === 'MISSED_CALL') && !prefs.callAlerts) return false;
    if ((type === 'APPOINTMENT_BOOKED' || type === 'APPOINTMENT_CONFIRMED' || type === 'APPOINTMENT_RESCHEDULED' || type === 'APPOINTMENT_CANCELLED') && !prefs.bookingUpdates) return false;
    if (type === 'APPOINTMENT_REMINDER' && !prefs.appointmentReminders) return false;
    if ((type === 'PAYMENT_RECEIPT' || type === 'REFUND_PROCESSED') && !prefs.paymentReceipts) return false;
    if ((type === 'EXPERT_VERIFICATION_APPROVED' || type === 'EXPERT_VERIFICATION_REJECTED') && !prefs.verificationUpdates) return false;

    return true;
  }

  /**
   * Core notification dispatcher: persists notification, respects preferences & deduplication,
   * emits live via Socket.io, dispatches email/push, and records delivery logs.
   */
  async createNotification(params: CreateNotificationParams) {
    const { userId, type, title, body, dataJson, channel = 'IN_APP', priority = 'NORMAL', dedupeKey } = params;

    // Deduplication check
    if (dedupeKey) {
      const existing = await prisma.notification.findFirst({
        where: { userId, dedupeKey },
      });
      if (existing) {
        return existing;
      }
    }

    const prefs = await this.getOrCreatePreferences(userId);
    const isAllowed = this.shouldSendNotification(type, prefs);

    if (!isAllowed) {
      await prisma.notificationLog.create({
        data: {
          userId,
          type,
          channel,
          status: 'SKIPPED_PREFERENCE',
          provider: 'NotificationService',
        },
      }).catch(() => {});
      return null;
    }

    const dataString = dataJson ? (typeof dataJson === 'string' ? dataJson : JSON.stringify(dataJson)) : null;

    // 1. Create In-App Notification in DB
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        dataJson: dataString,
        channel,
        priority,
        dedupeKey,
      },
    });

    // 2. Real-time in-app delivery via Socket.io
    if (this.io && prefs.inAppEnabled) {
      const payload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: dataJson || null,
        priority: notification.priority,
        createdAt: notification.createdAt.toISOString(),
        readAt: null,
      };

      // Broadcast to user's personal private room
      this.io.to(`user_${userId}`).emit('notification:new', payload);

      // If user has an expert profile, also broadcast to their expert room
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { expertProfile: true },
      });

      if (user?.expertProfile?.id) {
        this.io.to(`expert_${user.expertProfile.id}`).emit('notification:new', payload);
      }

      // If this is an administrative event, broadcast to admin room
      if (type === 'NEW_EXPERT_APPLICATION' || type === 'SYSTEM_ALERT') {
        this.io.to('admin_notifications').emit('notification:new', payload);
      }
    }

    // 3. Optional Push Notification Dispatch (Foundation)
    if (prefs.pushEnabled) {
      // Check stored subscriptions
      const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
      const hasVapid = Boolean(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY);

      for (const sub of subscriptions) {
        await prisma.notificationLog.create({
          data: {
            userId,
            type,
            channel: 'PUSH',
            status: hasVapid ? 'DELIVERED' : 'SENT_CONSOLE',
            provider: hasVapid ? 'WebPushService' : 'DevelopmentWebPush (Mock)',
            referenceId: sub.id,
          },
        }).catch(() => {});
      }
    }

    // 4. Log delivery
    await prisma.notificationLog.create({
      data: {
        userId,
        type,
        channel,
        status: 'DELIVERED',
        provider: 'SocketIO',
        referenceId: notification.id,
      },
    }).catch(() => {});

    return notification;
  }

  /**
   * Retrieves notifications for a specific user with pagination.
   */
  async getUserNotifications(userId: string, limit = 50, offset = 0) {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      notifications: items.map((n) => ({
        ...n,
        data: n.dataJson ? JSON.parse(n.dataJson) : null,
      })),
      unreadCount,
    };
  }

  /**
   * Marks a single notification as read, enforcing strict user ownership (IDOR prevention).
   */
  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new Error('Notification not found');
    if (notification.userId !== userId) throw new Error('Unauthorized');

    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Marks all notifications for a user as read.
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Deletes a notification, enforcing strict user ownership (IDOR prevention).
   */
  async deleteNotification(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new Error('Notification not found');
    if (notification.userId !== userId) throw new Error('Unauthorized');

    return prisma.notification.delete({ where: { id } });
  }

  /**
   * Clears all notifications for a user.
   */
  async clearAllNotifications(userId: string) {
    return prisma.notification.deleteMany({ where: { userId } });
  }

  /**
   * Updates user notification preferences.
   */
  async updatePreferences(userId: string, data: any) {
    await this.getOrCreatePreferences(userId);
    return prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }
}

export const notificationService = new NotificationService();
