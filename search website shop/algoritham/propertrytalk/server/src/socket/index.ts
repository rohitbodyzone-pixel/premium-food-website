import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { callTimerService } from '../services/call-timer.service';
import { chatTimerService } from '../services/chat-timer.service';
import { presenceService } from '../services/presence.service';
import { notificationService } from '../services/notification.service';

const JWT_SECRET = process.env.JWT_SECRET || 'propertytalk_super_secret_jwt_key_2026';

export function setupSocketServer(io: Server) {
  callTimerService.setSocketServer(io);
  chatTimerService.setSocketServer(io);
  presenceService.setSocketServer(io);
  notificationService.setSocketServer(io);

  // Authenticate socket connections during handshake
  io.use(async (socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: { expertProfile: true },
          });
          if (user && user.accountStatus !== 'SUSPENDED') {
            socket.data.user = {
              id: user.id,
              email: user.email,
              role: user.role,
              name: user.name,
              expertProfileId: user.expertProfile?.id,
            };
          }
        } catch (err) {
          console.warn('Socket token verification failed for incoming connection');
        }
      }
      next();
    } catch (e) {
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    if (user) {
      // Register with authoritative presence service
      presenceService.registerUserSocket(user.id, socket.id, user.expertProfileId);

      // Join private user room
      socket.join(`user_${user.id}`);

      // If user is an expert, join expert room
      if (user.expertProfileId) {
        socket.join(`expert_${user.expertProfileId}`);
      }

      // If user is a super admin, join admin notifications room
      if (user.role === 'SUPER_ADMIN') {
        socket.join('admin_notifications');
      }
    }

    // Heartbeat ping from client
    socket.on('presence:heartbeat', () => {
      socket.emit('presence:heartbeat_ack', { timestamp: Date.now() });
    });

    // Join Consultation Chat Room (Must be authenticated and participant)
    socket.on('chat:join', async (chatId: string) => {
      if (!user) {
        socket.emit('chat:error', { message: 'Authentication required to join chat.' });
        return;
      }

      try {
        const chat = await prisma.consultationChat.findUnique({
          where: { id: chatId },
          include: { expert: true },
        });

        if (!chat) return;

        const isParticipant =
          chat.consumerId === user.id ||
          chat.expert.userId === user.id ||
          user.role === 'SUPER_ADMIN';

        if (!isParticipant) {
          socket.emit('chat:error', { message: 'Unauthorized to view this consultation.' });
          return;
        }

        // Join both canonical consultation room and backwards-compatible chat room
        socket.join(`consultation_${chatId}`);
        socket.join(`chat_${chatId}`);

        // Emit current chat status
        socket.emit('chat:status', {
          chatId,
          status: chat.status,
          isFreeExpired: chat.isFreeExpired,
          extendedPaid: chat.extendedPaid,
        });

        // Only start / emit live timer ticks IF chat is connected or active!
        const isConnected =
          chat.status === 'CONNECTED' ||
          chat.status === 'ACTIVE' ||
          chat.status === 'PAID_ACTIVE' ||
          chat.status === 'EXPIRED_FREE';

        if (isConnected) {
          const timer = await chatTimerService.startChatTimer(chatId);
          socket.emit('chat:timer_tick', {
            chatId,
            freeSecondsRemaining: timer.freeSecondsRemaining,
            totalElapsedSeconds: timer.totalElapsedSeconds,
            isFreeExpired: timer.isFreeExpired,
            extendedPaid: timer.extendedPaid,
          });
        }
      } catch (e) {
        console.error('Error in chat:join:', e);
      }
    });

    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`consultation_${chatId}`);
      socket.leave(`chat_${chatId}`);
    });

    // Explicit paid continuation for chat
    socket.on('chat:extend_paid', async (data: string | { chatId: string; paymentMethodId?: string }) => {
      if (!user) return;
      const chatId = typeof data === 'string' ? data : data.chatId;
      const paymentMethodId = typeof data === 'object' ? data.paymentMethodId : undefined;
      try {
        await chatTimerService.confirmPaidContinuation(chatId, user.id, paymentMethodId);
      } catch (err: any) {
        socket.emit('chat:payment_error', { message: err.message || 'Paid continuation failed' });
      }
    });

    // Explicit paid continuation for audio/video call
    socket.on('call:extend_paid', async (data: string | { callSessionId: string; paymentMethodId?: string }) => {
      if (!user) return;
      const callSessionId = typeof data === 'string' ? data : data.callSessionId;
      const paymentMethodId = typeof data === 'object' ? data.paymentMethodId : undefined;
      try {
        await callTimerService.confirmPaidContinuation(callSessionId, user.id, paymentMethodId);
      } catch (err: any) {
        socket.emit('call:payment_error', { message: err.message || 'Paid continuation failed' });
      }
    });

    // Realtime chat message
    socket.on('chat:message', async (data: { chatId: string; content: string }) => {
      try {
        if (!user) return;
        const { chatId, content } = data;
        if (!content || !content.trim()) return;

        const chat = await prisma.consultationChat.findUnique({
          where: { id: chatId },
          include: { expert: true },
        });
        if (!chat) return;

        // IDOR Check
        const isParticipant =
          chat.consumerId === user.id ||
          chat.expert.userId === user.id ||
          user.role === 'SUPER_ADMIN';
        if (!isParticipant) return;

        // State Machine Check: Expert CANNOT reply until accepted!
        if (chat.status === 'REQUESTED') {
          if (chat.expert.userId === user.id) {
            socket.emit('chat:error', {
              message: 'Please accept the consultation request before sending messages.',
            });
            return;
          }
        } else if (
          chat.status === 'DECLINED' ||
          chat.status === 'CANCELLED' ||
          chat.status === 'MISSED' ||
          chat.status === 'ENDED'
        ) {
          socket.emit('chat:error', {
            message: `Cannot send messages to a consultation that is ${chat.status.toLowerCase()}.`,
          });
          return;
        }

        // Prevent free-time abuse: block consumer messages when 1 minute expired without paid confirmation
        if (chat.consumerId === user.id && (chat.status === 'CONNECTED' || chat.status === 'ACTIVE')) {
          const timer = await chatTimerService.startChatTimer(chatId);
          if (timer.isFreeExpired && !timer.extendedPaid) {
            socket.emit('chat:error', {
              message: 'Free consultation minute has ended. Please choose an option to continue.',
              isFreeExpired: true,
            });
            return;
          }
        }

        const message = await prisma.chatMessage.create({
          data: {
            chatId,
            senderId: user.id,
            content: content.trim(),
          },
        });

        await prisma.consultationChat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        // Emit to both canonical consultation room and backwards-compatible chat room
        io.to(`consultation_${chatId}`).to(`chat_${chatId}`).emit('chat:message', message);
      } catch (err) {
        console.error('Socket message error:', err);
      }
    });

    // Join Call Room (Must be participant)
    socket.on('call:join', async (callSessionId: string) => {
      if (!user) {
        socket.emit('call:error', { message: 'Authentication required to join call.' });
        return;
      }

      const call = await prisma.callSession.findUnique({
        where: { id: callSessionId },
        include: { expert: true },
      });

      if (!call) return;

      const isParticipant =
        call.consumerId === user.id ||
        call.expert.userId === user.id ||
        user.role === 'SUPER_ADMIN';

      if (!isParticipant) {
        socket.emit('call:error', { message: 'Unauthorized call session access.' });
        return;
      }

      socket.join(`call_${callSessionId}`);

      // Send current timer state if active
      const timerState = callTimerService.getTimerState(callSessionId);
      if (timerState) {
        socket.emit('call:timer_tick', {
          callSessionId,
          freeSecondsRemaining: timerState.freeSecondsRemaining,
          totalElapsedSeconds: timerState.totalElapsedSeconds,
          isFreeExpired: timerState.isFreeExpired,
          extendedPaid: timerState.extendedPaid,
        });
      }
    });

    socket.on('call:leave', (callSessionId: string) => {
      socket.leave(`call_${callSessionId}`);
    });

    // Real WebRTC Signalling Exchange (Offer, Answer, ICE Candidates)
    socket.on('call:signal', async (data: { callSessionId: string; signal: any }) => {
      if (!user) return;
      const { callSessionId, signal } = data;
      if (!callSessionId || !signal) return;

      try {
        const call = await prisma.callSession.findUnique({
          where: { id: callSessionId },
          include: { expert: true },
        });

        if (!call) return;

        // IDOR Verification
        const isParticipant =
          call.consumerId === user.id ||
          call.expert.userId === user.id ||
          user.role === 'SUPER_ADMIN';

        if (!isParticipant) {
          console.warn(`[Security] IDOR attempt on call:signal for session ${callSessionId} by user ${user.id}`);
          return;
        }

        // Forward signalling data to peer in call room
        socket.to(`call_${callSessionId}`).emit('call:signal', {
          signal,
          from: user.id,
          callSessionId,
        });
      } catch (err) {
        console.error('Error forwarding WebRTC signal:', err);
      }
    });

    // Handle Socket Disconnect
    socket.on('disconnect', async () => {
      if (user) {
        await presenceService.handleSocketDisconnect(user.id, socket.id, user.expertProfileId);
      }
    });
  });
}
