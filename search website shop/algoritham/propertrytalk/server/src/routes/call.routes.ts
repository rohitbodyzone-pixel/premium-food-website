import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { callProvider } from '../services/call-provider/webrtc-call-provider';
import { callTimerService } from '../services/call-timer.service';
import { chatTimerService } from '../services/chat-timer.service';
import { presenceService } from '../services/presence.service';
import { notificationService } from '../services/notification.service';
import { callRequestRateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

// 1. Consumer initiates Audio/Video Call Request
router.post('/request', requireAuth, callRequestRateLimiter, async (req: Request, res: Response) => {
  try {
    const { chatId, callType = 'AUDIO' } = req.body;
    const consumerId = req.user!.id;

    const chat = await prisma.consultationChat.findUnique({
      where: { id: chatId },
      include: {
        expert: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        consumer: { select: { id: true, name: true } },
      },
    });

    if (!chat) {
      res.status(404).json({ error: 'Consultation chat not found' });
      return;
    }

    if (chat.consumerId !== consumerId) {
      res.status(403).json({ error: 'Only the authorized consumer can initiate a call from this chat' });
      return;
    }

    // Presence & Availability Validation (Busy check)
    // Pass chatId and consumerId to permit same-consultation upgrade!
    const eligibility = await presenceService.canExpertAcceptCall(chat.expertId, {
      chatId: chat.id,
      consumerId,
    });
    if (!eligibility.eligible) {
      res.status(409).json({ error: eligibility.reason || 'Expert is currently busy or unavailable for calls.' });
      return;
    }

    // Free timer inheritance: Never grant a second free minute!
    const chatTimer = chatTimerService.getTimerState(chat.id);
    let inheritedFreeSecondsRemaining = 60;
    const isAlreadyExtendedPaid = chat.extendedPaid || (chatTimer?.extendedPaid ?? false);
    const isAlreadyFreeExpired = chat.isFreeExpired || (chatTimer?.isFreeExpired ?? false);

    if (isAlreadyExtendedPaid || isAlreadyFreeExpired) {
      inheritedFreeSecondsRemaining = 0;
    } else if (chatTimer) {
      inheritedFreeSecondsRemaining = Math.max(0, chatTimer.freeSecondsRemaining);
    } else if (chat.freeStartedAt) {
      const elapsed = Math.floor((Date.now() - new Date(chat.freeStartedAt).getTime()) / 1000);
      inheritedFreeSecondsRemaining = Math.max(0, 60 - elapsed);
    } else if (chat.freeSecondsRemaining !== undefined && chat.freeSecondsRemaining !== null) {
      inheritedFreeSecondsRemaining = Math.max(0, chat.freeSecondsRemaining);
    }

    // Stop active chat timer while call is being initiated
    chatTimerService.stopChatTimer(chat.id);

    // Create Call Session
    const callSession = await prisma.callSession.create({
      data: {
        chatId: chat.id,
        consumerId,
        expertId: chat.expertId,
        callType: callType === 'VIDEO' ? 'VIDEO' : 'AUDIO',
        status: 'REQUESTED',
        freeMinutesAllowed: 1,
        freeSecondsRemaining: inheritedFreeSecondsRemaining,
      },
      include: {
        expert: {
          include: { user: { select: { id: true, name: true } } },
        },
        consumer: { select: { id: true, name: true } },
      },
    });

    // Notify expert via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`expert_${chat.expertId}`).to(`user_${chat.expert.userId}`).emit('call:incoming', {
        callSessionId: callSession.id,
        chatId: chat.id,
        callType: callSession.callType,
        consumerName: chat.consumer.name,
        expertName: chat.expert.user.name,
        expertId: chat.expertId,
      });
    }

    // Dispatch persistent in-app notification to expert
    await notificationService.createNotification({
      userId: chat.expert.userId,
      type: callSession.callType === 'VIDEO' ? 'INCOMING_VIDEO_CALL' : 'INCOMING_AUDIO_CALL',
      title: `Incoming ${callSession.callType === 'VIDEO' ? 'Video' : 'Audio'} Call`,
      body: `${chat.consumer.name} is calling you for a consultation.`,
      priority: 'URGENT',
      dataJson: {
        callSessionId: callSession.id,
        chatId: chat.id,
        callType: callSession.callType,
        consumerName: chat.consumer.name,
      },
    }).catch(err => console.error('Call alert notification error:', err));

    // Unanswered timeout (30 seconds) -> Fallback to MISSED notification
    setTimeout(async () => {
      try {
        const check = await prisma.callSession.findUnique({ where: { id: callSession.id } });
        if (check && check.status === 'REQUESTED') {
          await prisma.callSession.update({
            where: { id: callSession.id },
            data: { status: 'MISSED', endReason: 'TIMEOUT_NO_ANSWER' },
          });
          if (io) {
            io.to(`call_${callSession.id}`)
              .to(`user_${callSession.consumerId}`)
              .to(`user_${chat.expert.userId}`)
              .emit('call:missed', {
                callSessionId: callSession.id,
                message: 'Call timed out: The expert did not answer in time.',
              });
          }

          // In-app missed call alert for expert
          await notificationService.createNotification({
            userId: chat.expert.userId,
            type: 'MISSED_CALL',
            title: 'Missed Consultation Call',
            body: `You missed a ${callSession.callType.toLowerCase()} consultation call from ${chat.consumer.name}.`,
            priority: 'HIGH',
            dataJson: {
              callSessionId: callSession.id,
              chatId: chat.id,
              consumerName: chat.consumer.name,
            },
          }).catch(err => console.error('Missed call alert error:', err));

          console.log(`⏱️ [Call] Session ${callSession.id} timed out after 30s with no answer.`);
        }
      } catch (err) {
        console.error('Call timeout error:', err);
      }
    }, 30000);

    res.status(201).json(callSession);
  } catch (error) {
    console.error('Error initiating call request:', error);
    res.status(500).json({ error: 'Failed to initiate call request' });
  }
});

// 2. Expert responds to call request (ACCEPT or DECLINE)
router.post('/:id/respond', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'ACCEPT' | 'DECLINE'
    const userId = req.user!.id;

    const callSession = await prisma.callSession.findUnique({
      where: { id },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    if (!callSession) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // IDOR check: Only assigned expert or admin can respond
    if (callSession.expert.userId !== userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the assigned expert can respond to this call' });
      return;
    }

    const io = req.app.get('io');

    if (action === 'DECLINE') {
      const updated = await prisma.callSession.update({
        where: { id },
        data: { status: 'DECLINED', endReason: 'DECLINED' },
      });

      if (io) {
        io.to(`call_${id}`).to(`user_${callSession.consumerId}`).emit('call:declined', {
          callSessionId: id,
          reason: 'Expert is currently unable to take your call.',
        });
      }

      res.json(updated);
      return;
    }

    // Action is ACCEPT: Atomically lock expert as busy (allowing upgrade from same consultation)
    const locked = presenceService.lockExpertBusy(callSession.expertId, id, {
      chatId: callSession.chatId,
      consumerId: callSession.consumerId,
    });
    if (!locked) {
      res.status(409).json({ error: 'You are currently registered in another active consultation.' });
      return;
    }

    // Create real WebRTC session with STUN/TURN ICE config
    const providerSession = await callProvider.createSession({
      callSessionId: id,
      consumerId: callSession.consumerId,
      expertId: callSession.expertId,
      callType: callSession.callType as 'AUDIO' | 'VIDEO',
    });

    const updated = await prisma.callSession.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        startedAt: new Date(),
      },
    });

    if (io) {
      io.to(`call_${id}`).to(`user_${callSession.consumerId}`).emit('call:accepted', {
        callSessionId: id,
        callType: callSession.callType,
        providerSession,
      });
    }

    res.json({
      ...updated,
      providerSession,
    });
  } catch (error) {
    console.error('Error responding to call:', error);
    res.status(500).json({ error: 'Failed to respond to call' });
  }
});

// 3. Mark call as Connected & Start Server Timer
// RULE: Timer starts ONLY after WebRTC peer connection is established
router.post('/:id/connect', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const call = await prisma.callSession.findUnique({
      where: { id },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    if (!call) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // IDOR check: Must be caller or callee
    const isParticipant = call.consumerId === userId || call.expert.userId === userId || req.user!.role === 'SUPER_ADMIN';
    if (!isParticipant) {
      res.status(403).json({ error: 'Unauthorized: You are not a participant in this call session' });
      return;
    }

    // Start server-authoritative timer with inherited remaining free seconds and paid state
    const chat = call.chatId ? await prisma.consultationChat.findUnique({ where: { id: call.chatId } }) : null;
    const isExtendedPaid = Boolean(chat?.extendedPaid);
    const timer = await callTimerService.startCallTimer(id, call.freeSecondsRemaining, isExtendedPaid);

    // Update status to IN_PROGRESS
    await prisma.callSession.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        connectedAt: new Date(),
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`call_${id}`).emit('call:connected', {
        callSessionId: id,
        freeSecondsRemaining: timer.freeSecondsRemaining,
        connectedAt: new Date(),
      });
    }

    console.log(`📞 [Call] WebRTC Call ${id} connected! 1-Minute free server timer started.`);

    res.json({
      success: true,
      callSessionId: id,
      freeSecondsRemaining: timer.freeSecondsRemaining,
    });
  } catch (error) {
    console.error('Error connecting call:', error);
    res.status(500).json({ error: 'Failed to start call connection' });
  }
});

// 4. Cancel Call (Consumer cancels before answer)
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const call = await prisma.callSession.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!call) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    if (call.consumerId !== userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the caller can cancel this request' });
      return;
    }

    const updated = await prisma.callSession.update({
      where: { id },
      data: { status: 'CANCELLED', endReason: 'CALLER_CANCELLED' },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`call_${id}`).to(`expert_${call.expertId}`).emit('call:cancelled', {
        callSessionId: id,
        message: 'Caller cancelled the request.',
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel call request' });
  }
});

// 5. Explicit confirmation from Consumer to extend consultation after free minute
router.post('/:id/extend', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const consumerId = req.user!.id;

    const success = await callTimerService.confirmPaidContinuation(id, consumerId);

    if (!success) {
      res.status(400).json({ error: 'Unable to extend call or call is not currently active' });
      return;
    }

    res.json({ success: true, message: 'Paid consultation extension activated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extend call' });
  }
});

// 6. End Call (Consumer or Expert)
router.post('/:id/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const callBefore = await prisma.callSession.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!callBefore) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const isParticipant = callBefore.consumerId === userId || callBefore.expert.userId === userId || req.user!.role === 'SUPER_ADMIN';
    if (!isParticipant) {
      res.status(403).json({ error: 'Unauthorized: You are not a participant in this call session' });
      return;
    }

    // Stop server timer and capture remaining state
    const activeTimer = callTimerService.getTimerState(id);
    const finalRemainingSeconds = activeTimer ? activeTimer.freeSecondsRemaining : callBefore.freeSecondsRemaining;
    const finalExtendedPaid = activeTimer?.extendedPaid ?? false;
    const finalFreeExpired = activeTimer?.isFreeExpired ?? (finalRemainingSeconds <= 0);

    await callTimerService.stopCallTimer(id);

    // Sync remaining seconds and paid state back to chat if consultation chat exists
    if (callBefore.chatId) {
      await prisma.consultationChat.update({
        where: { id: callBefore.chatId },
        data: {
          freeSecondsRemaining: finalRemainingSeconds,
          isFreeExpired: finalFreeExpired,
          extendedPaid: finalExtendedPaid,
        },
      });
      const activeChatTimer = chatTimerService.getTimerState(callBefore.chatId);
      if (activeChatTimer) {
        activeChatTimer.freeSecondsRemaining = finalRemainingSeconds;
        activeChatTimer.isFreeExpired = finalFreeExpired;
        activeChatTimer.extendedPaid = finalExtendedPaid;
      }
    }

    // Release expert presence busy lock
    await presenceService.releaseExpertBusy(callBefore.expertId, id);

    // End WebRTC provider session
    await callProvider.endSession(id);

    const finalizedCall = await prisma.callSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endReason: 'NORMAL',
      },
      include: {
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`call_${id}`).emit('call:ended', {
        callSessionId: id,
        durationSeconds: finalizedCall.durationSeconds,
        costCharged: finalizedCall.costCharged,
        promptReview: true,
        expertId: finalizedCall.expertId,
      });
    }

    res.json({ success: true, call: finalizedCall });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

// 7. Get user call history
router.get('/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isExpert = req.user!.role === 'EXPERT' && req.user!.expertProfileId;

    const calls = await prisma.callSession.findMany({
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
        consumer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

export default router;
