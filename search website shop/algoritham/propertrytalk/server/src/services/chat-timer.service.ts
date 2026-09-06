import { Server } from 'socket.io';
import { prisma } from '../db/prisma';
import { DEFAULT_FREE_CALL_DURATION_SECONDS } from '../config/constants';
import { billingService } from './billing.service';

interface ActiveChatTimer {
  chatId: string;
  freeSecondsRemaining: number;
  totalElapsedSeconds: number;
  paidSecondsElapsed: number;
  isFreeExpired: boolean;
  extendedPaid: boolean;
  rateMinorUnitsPerMinute: number;
  currency: string;
  intervalId?: NodeJS.Timeout;
}

export class ChatTimerService {
  private activeTimers = new Map<string, ActiveChatTimer>();
  private io?: Server;

  public setSocketServer(io: Server) {
    this.io = io;
    billingService.setSocketServer(io);
  }

  /**
   * Retrieves configured free duration from SystemConfig or defaults
   */
  async getConfiguredFreeDurationSeconds(): Promise<number> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'free_call_duration_seconds' },
      });
      if (config && !isNaN(parseInt(config.value, 10))) {
        return parseInt(config.value, 10);
      }
    } catch (e) {
      console.error('Error fetching free consultation duration config:', e);
    }
    return DEFAULT_FREE_CALL_DURATION_SECONDS;
  }

  /**
   * Starts or resumes the server-authoritative timer for a qualifying consultation chat
   */
  async startChatTimer(chatId: string, customDurationSeconds?: number): Promise<ActiveChatTimer> {
    const existing = this.activeTimers.get(chatId);
    if (existing && existing.intervalId) {
      return existing;
    }

    const chat = await prisma.consultationChat.findUnique({
      where: { id: chatId },
      include: {
        expert: {
          include: { user: true },
        },
        consumer: true,
      },
    });

    if (!chat) {
      throw new Error(`ConsultationChat ${chatId} not found`);
    }

    const configuredDuration = customDurationSeconds || await this.getConfiguredFreeDurationSeconds();
    const rateMinorUnitsPerMinute = chat.expert.chatRateMinorUnits || 250;
    const currency = chat.expert.countryCode.toUpperCase() === 'AU' ? 'AUD' : 'NZD';

    // If chat is still in REQUESTED state, DO NOT start the timer!
    if (chat.status === 'REQUESTED') {
      return {
        chatId,
        freeSecondsRemaining: configuredDuration,
        totalElapsedSeconds: 0,
        paidSecondsElapsed: 0,
        isFreeExpired: false,
        extendedPaid: false,
        rateMinorUnitsPerMinute,
        currency,
      };
    }

    let freeStartedAt = chat.freeStartedAt;
    let isFreeExpired = chat.isFreeExpired;
    let extendedPaid = chat.extendedPaid;
    let freeSecondsRemaining = chat.freeSecondsRemaining;
    let totalElapsedSeconds = 0;

    const now = new Date();

    if (!freeStartedAt) {
      freeStartedAt = now;
      freeSecondsRemaining = configuredDuration;
      isFreeExpired = false;

      await prisma.consultationChat.update({
        where: { id: chatId },
        data: {
          freeStartedAt,
          freeSecondsRemaining,
          isFreeExpired: false,
        },
      });
    } else {
      const elapsedSeconds = Math.floor((now.getTime() - freeStartedAt.getTime()) / 1000);
      totalElapsedSeconds = elapsedSeconds;

      if (extendedPaid) {
        isFreeExpired = false;
        freeSecondsRemaining = 0;
      } else {
        freeSecondsRemaining = Math.max(0, configuredDuration - elapsedSeconds);
        isFreeExpired = freeSecondsRemaining === 0;

        if (isFreeExpired && !chat.isFreeExpired) {
          await prisma.consultationChat.update({
            where: { id: chatId },
            data: {
              isFreeExpired: true,
              freeExpiredAt: chat.freeExpiredAt || now,
              freeSecondsRemaining: 0,
              status: chat.status === 'CONNECTED' ? 'EXPIRED_FREE' : chat.status,
            },
          });
        }
      }
    }

    const activeTimer: ActiveChatTimer = {
      chatId,
      freeSecondsRemaining,
      totalElapsedSeconds,
      paidSecondsElapsed: 0,
      isFreeExpired,
      extendedPaid,
      rateMinorUnitsPerMinute,
      currency,
    };

    // Run ticker
    activeTimer.intervalId = setInterval(async () => {
      activeTimer.totalElapsedSeconds += 1;

      if (!activeTimer.extendedPaid) {
        activeTimer.freeSecondsRemaining = Math.max(0, activeTimer.freeSecondsRemaining - 1);
      } else {
        activeTimer.paidSecondsElapsed += 1;
      }

      const isJustExpired = !activeTimer.isFreeExpired && activeTimer.freeSecondsRemaining === 0;

      const estimatedCostMinor = activeTimer.extendedPaid
        ? Math.round((activeTimer.rateMinorUnitsPerMinute * activeTimer.paidSecondsElapsed) / 60)
        : 0;
      const estimatedCost = estimatedCostMinor / 100;

      // Broadcast 1-second authoritative tick to both canonical consultation room and legacy chat room
      if (this.io) {
        const tickData = {
          chatId,
          freeSecondsRemaining: activeTimer.freeSecondsRemaining,
          totalElapsedSeconds: activeTimer.totalElapsedSeconds,
          paidSecondsElapsed: activeTimer.paidSecondsElapsed,
          isFreeExpired: activeTimer.freeSecondsRemaining === 0,
          extendedPaid: activeTimer.extendedPaid,
          rateMinorUnitsPerMinute: activeTimer.rateMinorUnitsPerMinute,
          ratePerMinute: activeTimer.rateMinorUnitsPerMinute / 100,
          estimatedCost,
          currency: activeTimer.currency,
          currencySymbol: activeTimer.currency === 'AUD' ? 'A$' : 'NZ$',
        };
        this.io.to(`consultation_${chatId}`).to(`chat_${chatId}`).emit('chat:timer_tick', tickData);
      }

      // Warning at 15 seconds
      if (activeTimer.freeSecondsRemaining === 15 && this.io) {
        this.io.to(`consultation_${chatId}`).to(`chat_${chatId}`).emit('chat:timer_warning', {
          chatId,
          secondsRemaining: 15,
          message: '15 seconds remaining in your free introductory chat.',
        });
      }

      // When free consultation concludes: lock and alert
      if (isJustExpired) {
        activeTimer.isFreeExpired = true;
        await prisma.consultationChat.update({
          where: { id: chatId },
          data: {
            isFreeExpired: true,
            freeExpiredAt: new Date(),
            freeSecondsRemaining: 0,
            status: 'EXPIRED_FREE',
          },
        });

        if (this.io) {
          this.io.to(`consultation_${chatId}`).to(`chat_${chatId}`).emit('chat:free_time_expired', {
            chatId,
            message: 'Your 1-minute free consultation has concluded.',
            expertRatePerMinute: activeTimer.rateMinorUnitsPerMinute / 100,
            rateMinorUnitsPerMinute: activeTimer.rateMinorUnitsPerMinute,
            currency: activeTimer.currency,
            currencySymbol: activeTimer.currency === 'AUD' ? 'A$' : 'NZ$',
            expertHourlyRate: chat.expert.hourlyRate,
            expertId: chat.expertId,
            expertName: chat.expert.user.name,
          });
        }
      }
    }, 1000);

    this.activeTimers.set(chatId, activeTimer);
    return activeTimer;
  }

  /**
   * Consumer explicitly confirms paid continuation via billing service
   */
  async confirmPaidContinuation(
    chatId: string,
    consumerId: string,
    paymentMethodId?: string
  ): Promise<boolean> {
    const chat = await prisma.consultationChat.findUnique({
      where: { id: chatId },
    });

    if (!chat || chat.consumerId !== consumerId) {
      return false;
    }

    // Call Billing Service to record billing session and validate payment card
    await billingService.confirmPaidContinuation({
      consultationId: chatId,
      consultationType: 'CHAT',
      consumerId,
      paymentMethodId,
    });

    await prisma.consultationChat.update({
      where: { id: chatId },
      data: {
        extendedPaid: true,
        isFreeExpired: false,
        status: 'PAID_ACTIVE',
      },
    });

    const timer = this.activeTimers.get(chatId);
    if (timer) {
      timer.extendedPaid = true;
      timer.isFreeExpired = false;
    }

    if (this.io) {
      this.io.to(`consultation_${chatId}`).to(`chat_${chatId}`).emit('chat:paid_continuation_activated', {
        chatId,
        status: 'PAID_ACTIVE',
      });
    }

    return true;
  }

  /**
   * Stops timer for chat and finalizes paid session via billingService
   */
  async stopAndFinalizeChat(chatId: string): Promise<void> {
    const timer = this.activeTimers.get(chatId);
    if (timer?.intervalId) {
      clearInterval(timer.intervalId);
    }
    const paidSecondsUsed = timer ? timer.paidSecondsElapsed : 0;
    this.activeTimers.delete(chatId);

    await billingService.finalizePaidSession({
      consultationId: chatId,
      consultationType: 'CHAT',
      forcedPaidSeconds: paidSecondsUsed,
    });
  }

  stopChatTimer(chatId: string): void {
    const timer = this.activeTimers.get(chatId);
    if (timer?.intervalId) {
      clearInterval(timer.intervalId);
    }
    this.activeTimers.delete(chatId);
  }

  getTimerState(chatId: string) {
    return this.activeTimers.get(chatId);
  }
}

export const chatTimerService = new ChatTimerService();
