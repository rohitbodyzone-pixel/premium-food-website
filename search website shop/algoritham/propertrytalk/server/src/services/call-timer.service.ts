import { Server } from 'socket.io';
import { prisma } from '../db/prisma';
import { DEFAULT_FREE_CALL_DURATION_SECONDS } from '../config/constants';
import { billingService } from './billing.service';

interface ActiveTimer {
  callSessionId: string;
  freeSecondsRemaining: number;
  totalElapsedSeconds: number;
  paidSecondsElapsed: number;
  freeMinutesAllowed: number;
  isFreeExpired: boolean;
  extendedPaid: boolean;
  rateMinorUnitsPerMinute: number;
  currency: string;
  intervalId?: NodeJS.Timeout;
}

export class CallTimerService {
  private activeTimers = new Map<string, ActiveTimer>();
  private io?: Server;

  public setSocketServer(io: Server) {
    this.io = io;
    billingService.setSocketServer(io);
  }

  /**
   * Retrieves configured free duration from SystemConfig or defaults
   */
  async getConfiguredFreeDurationSeconds(expertCountryCode?: string): Promise<number> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'free_call_duration_seconds' },
      });
      if (config && !isNaN(parseInt(config.value, 10))) {
        return parseInt(config.value, 10);
      }

      if (expertCountryCode) {
        const country = await prisma.country.findUnique({
          where: { code: expertCountryCode },
        });
        if (country?.freeCallMinutesDefault) {
          return country.freeCallMinutesDefault * 60;
        }
      }
    } catch (e) {
      console.error('Error fetching free call duration config:', e);
    }
    return DEFAULT_FREE_CALL_DURATION_SECONDS;
  }

  /**
   * Starts the server-authoritative timer when a call connects
   */
  async startCallTimer(callSessionId: string, durationSeconds?: number): Promise<ActiveTimer> {
    this.stopCallTimer(callSessionId);

    const call = await prisma.callSession.findUnique({
      where: { id: callSessionId },
      include: {
        expert: {
          include: { user: true },
        },
        consumer: true,
      },
    });

    if (!call) {
      throw new Error(`CallSession ${callSessionId} not found`);
    }

    const freeSeconds =
      durationSeconds ?? (await this.getConfiguredFreeDurationSeconds(call.expert.countryCode));
    const freeMinutesAllowed = Math.round(freeSeconds / 60);

    const rateMinorUnitsPerMinute =
      call.callType === 'VIDEO'
        ? call.expert.videoRateMinorUnits || 300
        : call.expert.audioRateMinorUnits || 250;
    const currency = call.expert.countryCode.toUpperCase() === 'AU' ? 'AUD' : 'NZD';

    const now = new Date();
    await prisma.callSession.update({
      where: { id: callSessionId },
      data: {
        status: 'IN_PROGRESS',
        connectedAt: now,
        freeMinutesAllowed,
        freeSecondsRemaining: freeSeconds,
      },
    });

    const activeTimer: ActiveTimer = {
      callSessionId,
      freeSecondsRemaining: freeSeconds,
      totalElapsedSeconds: 0,
      paidSecondsElapsed: 0,
      freeMinutesAllowed,
      isFreeExpired: false,
      extendedPaid: false,
      rateMinorUnitsPerMinute,
      currency,
    };

    activeTimer.intervalId = setInterval(async () => {
      activeTimer.totalElapsedSeconds += 1;

      if (!activeTimer.extendedPaid) {
        activeTimer.freeSecondsRemaining = Math.max(0, activeTimer.freeSecondsRemaining - 1);
      } else {
        // Paid consultation meter is ticking
        activeTimer.paidSecondsElapsed += 1;
      }

      const isJustExpired = !activeTimer.isFreeExpired && activeTimer.freeSecondsRemaining === 0;

      // Calculate estimated cost (informational UI estimate)
      const estimatedCostMinor = activeTimer.extendedPaid
        ? Math.round((activeTimer.rateMinorUnitsPerMinute * activeTimer.paidSecondsElapsed) / 60)
        : 0;
      const estimatedCost = estimatedCostMinor / 100;

      // Broadcast 1-second authoritative tick to room
      if (this.io) {
        this.io.to(`call_${callSessionId}`).emit('call:timer_tick', {
          callSessionId,
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
        });
      }

      // Warning at 30 seconds
      if (activeTimer.freeSecondsRemaining === 30 && this.io) {
        this.io.to(`call_${callSessionId}`).emit('call:timer_warning', {
          callSessionId,
          secondsRemaining: 30,
          message: '30 seconds remaining in your free consultation.',
        });
      }

      // Handle Expiration: Consultation PAUSES/LOCKS, ZERO auto charge, ask customer
      if (isJustExpired) {
        activeTimer.isFreeExpired = true;
        await prisma.callSession.update({
          where: { id: callSessionId },
          data: {
            freeTimeExpiredAt: new Date(),
            freeSecondsRemaining: 0,
          },
        });

        if (this.io) {
          this.io.to(`call_${callSessionId}`).emit('call:free_time_expired', {
            callSessionId,
            message: 'Your 1-minute free consultation has concluded.',
            expertRatePerMinute: activeTimer.rateMinorUnitsPerMinute / 100,
            rateMinorUnitsPerMinute: activeTimer.rateMinorUnitsPerMinute,
            currency: activeTimer.currency,
            currencySymbol: activeTimer.currency === 'AUD' ? 'A$' : 'NZ$',
            expertHourlyRate: call.expert.hourlyRate,
            expertId: call.expertId,
            expertName: call.expert.user.name,
          });
        }
      }
    }, 1000);

    this.activeTimers.set(callSessionId, activeTimer);
    return activeTimer;
  }

  /**
   * Consumer explicitly confirms paid continuation via billing service
   */
  async confirmPaidContinuation(
    callSessionId: string,
    consumerId: string,
    paymentMethodId?: string
  ): Promise<boolean> {
    const timer = this.activeTimers.get(callSessionId);

    const call = await prisma.callSession.findUnique({
      where: { id: callSessionId },
    });
    if (!call || call.consumerId !== consumerId) {
      return false;
    }

    // Call Billing Service to record billing session and validate payment card
    await billingService.confirmPaidContinuation({
      consultationId: callSessionId,
      consultationType: call.callType as 'AUDIO' | 'VIDEO',
      consumerId,
      paymentMethodId,
    });

    if (timer) {
      timer.extendedPaid = true;
      timer.isFreeExpired = false;
    }

    return true;
  }

  /**
   * Stops timer and finalizes consultation via billingService
   */
  async stopCallTimer(callSessionId: string): Promise<void> {
    const timer = this.activeTimers.get(callSessionId);
    if (timer?.intervalId) {
      clearInterval(timer.intervalId);
    }
    const paidSecondsUsed = timer ? timer.paidSecondsElapsed : 0;
    this.activeTimers.delete(callSessionId);

    try {
      const call = await prisma.callSession.findUnique({
        where: { id: callSessionId },
        include: { expert: true },
      });

      if (call && call.status === 'IN_PROGRESS') {
        const endedAt = new Date();
        const connectedTime = call.connectedAt ? call.connectedAt.getTime() : call.createdAt.getTime();
        const totalDurationSeconds = Math.max(1, Math.round((endedAt.getTime() - connectedTime) / 1000));

        // Finalize paid session through billing engine
        await billingService.finalizePaidSession({
          consultationId: callSessionId,
          consultationType: call.callType as 'AUDIO' | 'VIDEO',
          forcedPaidSeconds: paidSecondsUsed,
        });

        await prisma.callSession.update({
          where: { id: callSessionId },
          data: {
            status: 'COMPLETED',
            endedAt,
            durationSeconds: totalDurationSeconds,
          },
        });
      }
    } catch (err) {
      console.error('Error finalizing call session:', err);
    }
  }

  getTimerState(callSessionId: string) {
    return this.activeTimers.get(callSessionId);
  }
}

export const callTimerService = new CallTimerService();
