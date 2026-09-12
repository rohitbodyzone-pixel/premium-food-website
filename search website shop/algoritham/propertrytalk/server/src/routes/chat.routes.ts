import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { chatTimerService } from '../services/chat-timer.service';
import { notificationService } from '../services/notification.service';
import { presenceService } from '../services/presence.service';

const router = Router();

// Helper to check if a chat is in an active / connected state
export function isChatConnected(status: string): boolean {
  return status === 'CONNECTED' || status === 'ACTIVE' || status === 'PAID_ACTIVE';
}

// 1. Initiate Consultation Chat Request (Talk Now)
// Flow: Customer requests chat -> Creates ConsultationChat with status REQUESTED -> Notifies Expert
// CRITICAL: Free timer must NOT run while status is REQUESTED!
router.post(['/talk-now', '/request'], requireAuth, async (req: Request, res: Response) => {
  try {
    const { expertId, initialMessage } = req.body;
    const consumerId = req.user!.id;

    if (!expertId) {
      res.status(400).json({ error: 'Expert ID is required' });
      return;
    }

    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        category: true,
        country: true,
      },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }

    if (expert.userId === consumerId) {
      res.status(400).json({ error: 'You cannot initiate a consultation with yourself.' });
      return;
    }

    // Availability validation: Expert must be verified and online
    if (expert.verificationStatus !== 'VERIFIED') {
      res.status(403).json({ error: 'Expert is not verified to receive consultations.' });
      return;
    }

    if (!expert.isOnline) {
      res.status(400).json({ error: 'Expert is currently offline. Please book an appointment or choose an online expert.' });
      return;
    }

    // Check if expert is currently busy on another active consultation
    if (presenceService.isExpertBusy(expert.id)) {
      res.status(409).json({
        error: 'Expert is currently busy on another consultation. Please try again shortly.',
        code: 'EXPERT_BUSY',
      });
      return;
    }

    // Check if there is already an ongoing REQUESTED or CONNECTED chat between this consumer and expert
    let chat = await prisma.consultationChat.findFirst({
      where: {
        consumerId,
        expertId,
        status: { in: ['REQUESTED', 'CONNECTED', 'ACTIVE', 'PAID_ACTIVE'] },
      },
      include: {
        expert: {
          include: {
            user: { select: { id: true, name: true } },
            category: true,
            country: true,
          },
        },
        consumer: { select: { id: true, name: true, phone: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!chat) {
      const now = new Date();
      chat = await prisma.consultationChat.create({
        data: {
          consumerId,
          expertId,
          status: 'REQUESTED',
          requestedAt: now,
          initialMessage: initialMessage ? initialMessage.trim() : null,
          freeSecondsRemaining: 60,
          freeStartedAt: null, // STRICT RULE: null until Expert ACCEPT!
          isFreeExpired: false,
        },
        include: {
          expert: {
            include: {
              user: { select: { id: true, name: true } },
              category: true,
              country: true,
            },
          },
          consumer: { select: { id: true, name: true, phone: true } },
          messages: true,
        },
      });

      // Save initial customer request message if provided
      if (initialMessage && initialMessage.trim()) {
        await prisma.chatMessage.create({
          data: {
            chatId: chat.id,
            senderId: consumerId,
            content: initialMessage.trim(),
          },
        });
      }

      // Add system advisory message
      await prisma.chatMessage.create({
        data: {
          chatId: chat.id,
          senderId: expert.user.id,
          isSystem: true,
          content: `Consultation requested with ${expert.user.name} (${expert.title}). Waiting for expert to accept. Your First 1 Minute FREE timer begins only after connection.`,
        },
      });

      // Dispatch real-time socket event to Expert
      const io = req.app.get('io');
      if (io) {
        const requestPayload = {
          chatId: chat.id,
          consumerId,
          consumerName: req.user!.name,
          expertId: expert.id,
          expertName: expert.user.name,
          initialMessage: initialMessage ? initialMessage.trim() : null,
          requestedAt: chat.requestedAt,
        };
        io.to(`expert_${expert.id}`).to(`user_${expert.user.id}`).emit('chat:incoming_request', requestPayload);
      }

      // Dispatch in-app notification to Expert
      await notificationService.createNotification({
        userId: expert.user.id,
        type: 'CHAT_REQUEST',
        title: 'New Consultation Chat Request',
        body: `${req.user!.name || 'A customer'} requested a consultation: "${(initialMessage || 'New inquiry').substring(0, 60)}"`,
        priority: 'URGENT',
        dataJson: { chatId: chat.id, consumerId, initialMessage },
      }).catch(err => console.error('Chat notification error:', err));

      // 90-Second Request Timeout Runner
      setTimeout(async () => {
        try {
          const check = await prisma.consultationChat.findUnique({ where: { id: chat!.id } });
          if (check && check.status === 'REQUESTED') {
            await prisma.consultationChat.update({
              where: { id: chat!.id },
              data: { status: 'MISSED' },
            });
            if (io) {
              io.to(`consultation_${chat!.id}`)
                .to(`chat_${chat!.id}`)
                .to(`user_${consumerId}`)
                .emit('chat:request_timeout', {
                  chatId: chat!.id,
                  message: 'Expert did not respond in time. Please try again or choose another expert.',
                });
            }
          }
        } catch (tErr) {
          console.error('Chat request timeout check error:', tErr);
        }
      }, 90000);
    }

    res.json(chat);
  } catch (error) {
    console.error('Error starting Talk Now chat:', error);
    res.status(500).json({ error: 'Failed to initiate chat' });
  }
});

// 2. Expert ACCEPTS Consultation Chat Request
// State Transition: REQUESTED -> CONNECTED
// Server-Authoritative: Sets acceptedAt, connectedAt, freeStartedAt = now, locks expert BUSY, starts timer
router.post('/:id/accept', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const chat = await prisma.consultationChat.findUnique({
      where: { id },
      include: {
        expert: { include: { user: true, category: true, country: true } },
        consumer: true,
      },
    });

    if (!chat) {
      res.status(404).json({ error: 'Consultation chat not found' });
      return;
    }

    // Role & Identity check: Only assigned expert or super admin can accept
    if (chat.expert.userId !== userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the assigned expert can accept this consultation request.' });
      return;
    }

    // Status check
    if (chat.status !== 'REQUESTED') {
      if (isChatConnected(chat.status)) {
        res.status(200).json({ success: true, message: 'Consultation already connected', chat });
        return;
      }
      res.status(400).json({ error: `Cannot accept consultation in ${chat.status} status.`, status: chat.status });
      return;
    }

    // Verification check
    if (chat.expert.verificationStatus !== 'VERIFIED') {
      res.status(403).json({ error: 'Expert must be verified by Super Admin before accepting consultations.' });
      return;
    }

    // Online check
    if (!chat.expert.isOnline) {
      res.status(400).json({ error: 'You must be Online to accept consultations.' });
      return;
    }

    // Busy check: Allow if lock already belongs to this chat
    const activeLock = presenceService.getActiveConsultation(chat.expertId);
    if (activeLock && activeLock.sessionId !== id && activeLock.chatId !== id) {
      res.status(409).json({ error: 'You are currently registered in another active consultation.' });
      return;
    }

    const now = new Date();

    // Atomically acquire busy lock
    const locked = presenceService.lockExpertBusy(chat.expertId, id, {
      chatId: id,
      consumerId: chat.consumerId,
    });
    if (!locked) {
      res.status(409).json({ error: 'You are currently registered in another active consultation.' });
      return;
    }

    // Atomically transition status to CONNECTED and set authoritative timestamps
    const updatedChat = await prisma.consultationChat.update({
      where: { id },
      data: {
        status: 'CONNECTED',
        acceptedAt: now,
        connectedAt: now,
        freeStartedAt: now, // SERVER-AUTHORITATIVE START!
        freeSecondsRemaining: 60,
        isFreeExpired: false,
      },
      include: {
        expert: { include: { user: true, category: true, country: true } },
        consumer: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Start authoritative server timer
    await chatTimerService.startChatTimer(id);

    // Broadcast connection event to both parties
    const io = req.app.get('io');
    if (io) {
      const payload = {
        chatId: id,
        status: 'CONNECTED',
        acceptedAt: now,
        connectedAt: now,
        freeStartedAt: now,
        freeSecondsRemaining: 60,
        expert: {
          id: chat.expert.id,
          name: chat.expert.user.name,
          title: chat.expert.title,
          photoUrl: chat.expert.photoUrl,
        },
      };

      io.to(`consultation_${id}`)
        .to(`chat_${id}`)
        .to(`user_${chat.consumerId}`)
        .to(`user_${chat.expert.userId}`)
        .emit('chat:accepted', payload);

      io.to(`consultation_${id}`)
        .to(`chat_${id}`)
        .to(`user_${chat.consumerId}`)
        .to(`user_${chat.expert.userId}`)
        .emit('chat:connected', payload);
    }

    // In-app notification for Consumer
    await notificationService.createNotification({
      userId: chat.consumerId,
      type: 'CHAT_REQUEST',
      title: 'Consultation Accepted',
      body: `${chat.expert.user.name} accepted your chat request! Your First 1 Minute FREE consultation is now active.`,
      priority: 'HIGH',
      dataJson: { chatId: id, expertId: chat.expertId },
    }).catch(() => {});

    res.json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error('Error accepting chat:', error);
    res.status(500).json({ error: 'Failed to accept consultation request.' });
  }
});

// 3. Expert DECLINES Consultation Chat Request
// State Transition: REQUESTED -> DECLINED
// Rule: No free timer consumed, expert remains online
router.post('/:id/decline', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    const chat = await prisma.consultationChat.findUnique({
      where: { id },
      include: { expert: { include: { user: true } }, consumer: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    if (chat.expert.userId !== userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the assigned expert can decline this request.' });
      return;
    }

    if (chat.status !== 'REQUESTED') {
      res.status(400).json({ error: `Cannot decline consultation in ${chat.status} status.` });
      return;
    }

    const updated = await prisma.consultationChat.update({
      where: { id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        declineReason: reason || 'Expert is currently unavailable for consultation.',
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`consultation_${id}`)
        .to(`chat_${id}`)
        .to(`user_${chat.consumerId}`)
        .emit('chat:declined', {
          chatId: id,
          reason: updated.declineReason,
        });
    }

    await notificationService.createNotification({
      userId: chat.consumerId,
      type: 'CHAT_REQUEST',
      title: 'Consultation Request Declined',
      body: `${chat.expert.user.name} is currently unable to take your chat request.`,
      priority: 'NORMAL',
      dataJson: { chatId: id },
    }).catch(() => {});

    res.json({ success: true, chat: updated });
  } catch (error) {
    console.error('Error declining chat:', error);
    res.status(500).json({ error: 'Failed to decline chat' });
  }
});

// 4. Consumer CANCELS Consultation Chat Request while waiting
// State Transition: REQUESTED -> CANCELLED
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const chat = await prisma.consultationChat.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    if (chat.consumerId !== userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the customer can cancel this request.' });
      return;
    }

    if (chat.status !== 'REQUESTED') {
      res.status(400).json({ error: `Cannot cancel consultation in ${chat.status} status.` });
      return;
    }

    const updated = await prisma.consultationChat.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`consultation_${id}`)
        .to(`chat_${id}`)
        .to(`user_${chat.expert.userId}`)
        .emit('chat:cancelled', {
          chatId: id,
          message: 'Customer cancelled the chat request.',
        });
    }

    res.json({ success: true, chat: updated });
  } catch (error) {
    console.error('Error cancelling chat:', error);
    res.status(500).json({ error: 'Failed to cancel chat request' });
  }
});

// 5. End Consultation Chat (Consumer or Expert)
// State Transition: CONNECTED -> ENDED
// Action: Stops timer, releases busy lock, returns expert ONLINE
router.post('/:id/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const chat = await prisma.consultationChat.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const isParticipant =
      chat.consumerId === userId ||
      chat.expert.userId === userId ||
      req.user!.role === 'SUPER_ADMIN';

    if (!isParticipant) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    chatTimerService.stopChatTimer(id);
    await presenceService.releaseExpertBusy(chat.expertId, id);

    const updated = await prisma.consultationChat.update({
      where: { id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`consultation_${id}`)
        .to(`chat_${id}`)
        .to(`user_${chat.consumerId}`)
        .to(`user_${chat.expert.userId}`)
        .emit('chat:ended', { chatId: id });
    }

    res.json({ success: true, chat: updated });
  } catch (error) {
    console.error('Error ending chat:', error);
    res.status(500).json({ error: 'Failed to end consultation' });
  }
});

// Get user's active consultations / chats
router.get('/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isExpert = req.user!.role === 'EXPERT' && req.user!.expertProfileId;

    const chats = await prisma.consultationChat.findMany({
      where: isExpert
        ? { expertId: req.user!.expertProfileId }
        : { consumerId: userId },
      include: {
        expert: {
          include: {
            user: { select: { id: true, name: true } },
            category: true,
            country: true,
          },
        },
        consumer: {
          select: { id: true, name: true, phone: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get chat by ID and message history with live timer state
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const chat = await prisma.consultationChat.findUnique({
      where: { id },
      include: {
        expert: {
          include: {
            user: { select: { id: true, name: true } },
            category: true,
            country: true,
          },
        },
        consumer: {
          select: { id: true, name: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        billingSession: {
          include: { transaction: true },
        },
      },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Security check: only the consumer, expert, or super admin can access this chat
    const isParticipant =
      chat.consumerId === userId ||
      chat.expert.userId === userId ||
      req.user!.role === 'SUPER_ADMIN';

    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this consultation' });
      return;
    }

    // Timer state rule:
    // Only run / sync timer IF consultation is in a connected or expired free state!
    let timerState = null;
    if (isChatConnected(chat.status) || chat.status === 'EXPIRED_FREE') {
      const activeTimer = await chatTimerService.startChatTimer(id);
      timerState = {
        freeSecondsRemaining: activeTimer.freeSecondsRemaining,
        isFreeExpired: activeTimer.isFreeExpired,
        extendedPaid: activeTimer.extendedPaid,
        isStarted: true,
      };
    } else {
      timerState = {
        freeSecondsRemaining: 60,
        isFreeExpired: false,
        extendedPaid: false,
        isStarted: false,
      };
    }

    res.json({
      ...chat,
      timerState,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch consultation chat' });
  }
});

// Explicit confirmation from Consumer to extend consultation chat after free minute expires
router.post('/:id/extend', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const consumerId = req.user!.id;

    const success = await chatTimerService.confirmPaidContinuation(id, consumerId);

    if (!success) {
      res.status(400).json({ error: 'Unable to extend chat or invalid consultation' });
      return;
    }

    res.json({ success: true, message: 'Paid chat consultation continuation activated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extend chat' });
  }
});

// Send message via REST endpoint (also supported via socket.io)
router.post('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const senderId = req.user!.id;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }

    const chat = await prisma.consultationChat.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const isParticipant =
      chat.consumerId === senderId ||
      chat.expert.userId === senderId ||
      req.user!.role === 'SUPER_ADMIN';

    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Role and status checks:
    // Before acceptance: Neither party can send messages in REQUESTED state (expert hasn't accepted yet)
    if (chat.status === 'REQUESTED') {
      if (chat.expert.userId === senderId) {
        res.status(403).json({ error: 'Please accept the consultation request before sending messages.' });
        return;
      }
      res.status(403).json({ error: 'Please wait for the expert to accept your consultation request before sending messages.' });
      return;
    } else if (
      chat.status === 'DECLINED' ||
      chat.status === 'CANCELLED' ||
      chat.status === 'MISSED' ||
      chat.status === 'ENDED'
    ) {
      res.status(400).json({ error: `Cannot send messages to a consultation that is ${chat.status.toLowerCase()}.` });
      return;
    }

    // Check free chat timer expiration for both consumers and experts
    if (isChatConnected(chat.status) || chat.status === 'EXPIRED_FREE') {
      const timerState = await chatTimerService.startChatTimer(id);
      if (timerState.isFreeExpired && !timerState.extendedPaid && req.user!.role !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: 'Free consultation minute has ended. Please confirm paid continuation to continue messaging.',
          isFreeExpired: true,
        });
        return;
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderId,
        content: content.trim(),
      },
    });

    await prisma.consultationChat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Broadcast via socket to both canonical consultation room and legacy chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`consultation_${id}`).to(`chat_${id}`).emit('chat:message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
