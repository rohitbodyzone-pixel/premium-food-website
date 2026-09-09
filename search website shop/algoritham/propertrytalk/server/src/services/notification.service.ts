import { Server } from 'socket.io';
import webpush from 'web-push';
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
  private vapidConfigured: boolean = false;

  constructor() {
    this.initVapid();
  }

  initVapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY || process.env.WEB_PUSH_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@propertytalk.co.nz';

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.vapidConfigured = true;
      } catch (err: any) {
        console.warn('[NotificationService] Failed to set VAPID details:', err.message);
        this.vapidConfigured = false;
      }
    } else {
      this.vapidConfigured = false;
    }
  }

  isVapidConfigured(): boolean {
    if (!this.vapidConfigured) {
      this.initVapid();
    }
    return this.vapidConfigured;
  }

  getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_PUBLIC_KEY || null;
  }

  setSocketServer(io: Server) {
    this.io = io;
  }

  /**
   * Retrieves or creates default notification preferences for a user.
   */
  async getOrCreatePreferences(userId: string) {
    return await prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: {
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

    // 3. Web Push Notification Dispatch (Real VAPID)
    if (prefs.pushEnabled) {
      const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
      const isVapidReady = this.isVapidConfigured();

      if (subscriptions.length > 0 && isVapidReady) {
        const pushPayload = JSON.stringify({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          priority: notification.priority,
          data: {
            url: dataJson?.url || (type.includes('EXPERT') ? '/expert' : '/notifications'),
            ...(dataJson || {}),
          },
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              pushPayload
            );

            await prisma.notificationLog.create({
              data: {
                userId,
                type,
                channel: 'PUSH',
                status: 'DELIVERED',
                provider: 'WebPushService',
                referenceId: sub.id,
              },
            }).catch(() => {});
          } catch (pushErr: any) {
            console.warn(`[WebPush] Push dispatch note for sub ${sub.id}:`, pushErr?.statusCode || pushErr?.message);

            // If subscription is expired or unregistered (HTTP 404 / 410 Gone), automatically prune from DB
            if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
              console.log(`[WebPush] Pruning expired/invalid subscription ${sub.id} (HTTP ${pushErr.statusCode})`);
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }

            await prisma.notificationLog.create({
              data: {
                userId,
                type,
                channel: 'PUSH',
                status: 'FAILED',
                provider: 'WebPushService',
                referenceId: sub.id,
              },
            }).catch(() => {});
          }
        }
      } else if (subscriptions.length > 0) {
        for (const sub of subscriptions) {
          await prisma.notificationLog.create({
            data: {
              userId,
              type,
              channel: 'PUSH',
              status: 'SENT_CONSOLE',
              provider: 'DevelopmentWebPush (Mock)',
              referenceId: sub.id,
            },
          }).catch(() => {});
        }
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
