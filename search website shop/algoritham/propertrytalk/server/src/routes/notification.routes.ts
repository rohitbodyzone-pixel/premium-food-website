import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';

const router = Router();

// Public push configuration endpoint
router.get('/push/config', (_req: Request, res: Response) => {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || null;
  res.json({
    pushEnabled: Boolean(publicKey),
    publicKey,
    mode: publicKey ? 'PRODUCTION' : 'DEVELOPMENT_MOCK',
    instructions: publicKey
      ? 'Web Push is active with configured VAPID credentials.'
      : 'DEVELOPMENT NOTIFICATION MODE: In-app real-time alerts are fully active. Set WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY for external browser push.',
  });
});

// All following routes require authentication
router.use(requireAuth);

/**
 * Get user's notifications with pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await notificationService.getUserNotifications(userId, limit, offset);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

/**
 * Mark a single notification as read (Strict IDOR protection)
 */
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const updated = await notificationService.markAsRead(id, userId);
    res.json(updated);
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 403 : error.message === 'Notification not found' ? 404 : 500;
    res.status(status).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

/**
 * Mark all user notifications as read
 */
router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await notificationService.markAllAsRead(userId);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark all notifications as read' });
  }
});

/**
 * Delete a notification (Strict IDOR protection)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await notificationService.deleteNotification(id, userId);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 403 : error.message === 'Notification not found' ? 404 : 500;
    res.status(status).json({ error: error.message || 'Failed to delete notification' });
  }
});

/**
 * Clear all notifications for user
 */
router.delete('/clear-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await notificationService.clearAllNotifications(userId);
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clear notifications' });
  }
});

/**
 * Get notification preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const prefs = await notificationService.getOrCreatePreferences(userId);
    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch preferences' });
  }
});

/**
 * Update notification preferences
 */
router.patch('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      inAppEnabled,
      emailEnabled,
      pushEnabled,
      chatAlerts,
      callAlerts,
      bookingUpdates,
      appointmentReminders,
      paymentReceipts,
      verificationUpdates,
    } = req.body;

    const updated = await notificationService.updatePreferences(userId, {
      ...(inAppEnabled !== undefined && { inAppEnabled }),
      ...(emailEnabled !== undefined && { emailEnabled }),
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(chatAlerts !== undefined && { chatAlerts }),
      ...(callAlerts !== undefined && { callAlerts }),
      ...(bookingUpdates !== undefined && { bookingUpdates }),
      ...(appointmentReminders !== undefined && { appointmentReminders }),
      ...(paymentReceipts !== undefined && { paymentReceipts }),
      ...(verificationUpdates !== undefined && { verificationUpdates }),
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update preferences' });
  }
});

/**
 * Save browser push subscription
 */
router.post('/push/subscribe', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Valid push subscription object is required.' });
      return;
    }

    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    // Also enable push in preferences
    await notificationService.updatePreferences(userId, { pushEnabled: true });

    res.json({ success: true, subscriptionId: sub.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save push subscription' });
  }
});

/**
 * Unsubscribe browser push
 */
router.post('/push/unsubscribe', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { endpoint } = req.body;

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    }

    await notificationService.updatePreferences(userId, { pushEnabled: false });

    res.json({ success: true, message: 'Push subscription removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to unsubscribe' });
  }
});

export default router;
