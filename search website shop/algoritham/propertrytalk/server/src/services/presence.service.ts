import { Server } from 'socket.io';
import { prisma } from '../db/prisma';

export type PresenceStatus = 'ONLINE' | 'BUSY' | 'OFFLINE';

export class PresenceService {
  private io: Server | null = null;
  
  // userId -> Set of active socket IDs (multi-tab / multi-device support)
  private userSockets = new Map<string, Set<string>>();
  
  // expertProfileId -> Set of active socket IDs
  private expertSockets = new Map<string, Set<string>>();
  
  // expertProfileId -> callSessionId (atomic busy lock)
  private activeConsultations = new Map<string, string>();
  
  // expertProfileId -> Timeout ID for disconnect grace period
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();

  private readonly GRACE_PERIOD_MS = 20000; // 20 seconds grace period

  clearAllTimers() {
    for (const timer of this.disconnectGraceTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectGraceTimers.clear();
  }

  setSocketServer(io: Server) {
    this.io = io;
  }

  /**
   * Register a socket connection for an authenticated user.
   */
  registerUserSocket(userId: string, socketId: string, expertProfileId?: string) {
    // Cancel any pending grace timer for this user's expert profile
    if (expertProfileId && this.disconnectGraceTimers.has(expertProfileId)) {
      clearTimeout(this.disconnectGraceTimers.get(expertProfileId)!);
      this.disconnectGraceTimers.delete(expertProfileId);
      console.log(`⏱️ [Presence] Grace timer cancelled for expert ${expertProfileId}; reconnected via socket ${socketId}`);
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    if (expertProfileId) {
      if (!this.expertSockets.has(expertProfileId)) {
        this.expertSockets.set(expertProfileId, new Set());
      }
      this.expertSockets.get(expertProfileId)!.add(socketId);
    }
  }

  /**
   * Handle socket disconnection with multi-device awareness and grace period.
   */
  async handleSocketDisconnect(userId: string, socketId: string, expertProfileId?: string) {
    const userSet = this.userSockets.get(userId);
    if (userSet) {
      userSet.delete(socketId);
      if (userSet.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    if (!expertProfileId) return;

    const expertSet = this.expertSockets.get(expertProfileId);
    if (expertSet) {
      expertSet.delete(socketId);
      if (expertSet.size === 0) {
        this.expertSockets.delete(expertProfileId);

        // Start grace period before marking offline
        console.log(`⏱️ [Presence] All sockets closed for expert ${expertProfileId}. Starting ${this.GRACE_PERIOD_MS / 1000}s grace timer...`);
        const timer = setTimeout(async () => {
          this.disconnectGraceTimers.delete(expertProfileId);
          await this.markExpertOffline(expertProfileId);
        }, this.GRACE_PERIOD_MS);

        this.disconnectGraceTimers.set(expertProfileId, timer);
      } else {
        console.log(`ℹ️ [Presence] Expert ${expertProfileId} still has ${expertSet.size} active socket(s).`);
      }
    }
  }

  /**
   * Authoritatively mark an expert offline in database and broadcast.
   */
  async markExpertOffline(expertProfileId: string) {
    try {
      const expert = await prisma.expertProfile.update({
        where: { id: expertProfileId },
        data: { isOnline: false },
        select: { id: true, isOnline: true },
      });

      // Clear any busy lock
      this.activeConsultations.delete(expertProfileId);

      this.broadcastPresenceChange(expertProfileId, 'OFFLINE');
      console.log(`🔴 [Presence] Expert ${expertProfileId} marked OFFLINE after grace period.`);
    } catch (e) {
      console.error(`Error marking expert ${expertProfileId} offline:`, e);
    }
  }

  /**
   * Manual toggle from Expert Dashboard.
   * Authoritative rule: Can only go ONLINE if VERIFIED.
   */
  async setManualOnlineStatus(expertProfileId: string, isOnline: boolean): Promise<{ success: boolean; status: PresenceStatus; error?: string }> {
    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertProfileId },
      select: { id: true, verificationStatus: true },
    });

    if (!expert) {
      return { success: false, status: 'OFFLINE', error: 'Expert profile not found.' };
    }

    if (isOnline && expert.verificationStatus !== 'VERIFIED') {
      return {
        success: false,
        status: 'OFFLINE',
        error: 'Only verified professionals can go Online for consultations.',
      };
    }

    await prisma.expertProfile.update({
      where: { id: expertProfileId },
      data: { isOnline },
    });

    const currentStatus = isOnline
      ? (this.activeConsultations.has(expertProfileId) ? 'BUSY' : 'ONLINE')
      : 'OFFLINE';

    this.broadcastPresenceChange(expertProfileId, currentStatus);
    return { success: true, status: currentStatus };
  }

  /**
   * Atomic busy lock: Attempts to lock expert for a consultation call session.
   * Returns false if expert is already busy in another call (prevents race condition).
   */
  lockExpertBusy(expertProfileId: string, callSessionId: string): boolean {
    if (this.activeConsultations.has(expertProfileId)) {
      const existingSession = this.activeConsultations.get(expertProfileId);
      if (existingSession !== callSessionId) {
        return false; // Already busy with another call
      }
    }
    this.activeConsultations.set(expertProfileId, callSessionId);
    this.broadcastPresenceChange(expertProfileId, 'BUSY');
    console.log(`🟡 [Presence] Expert ${expertProfileId} locked as BUSY for call ${callSessionId}`);
    return true;
  }

  /**
   * Release busy lock when consultation finishes.
   */
  async releaseExpertBusy(expertProfileId: string, callSessionId: string) {
    if (this.activeConsultations.get(expertProfileId) === callSessionId) {
      this.activeConsultations.delete(expertProfileId);

      // Check current DB online status
      const expert = await prisma.expertProfile.findUnique({
        where: { id: expertProfileId },
        select: { isOnline: true },
      });

      const nextStatus: PresenceStatus = expert?.isOnline ? 'ONLINE' : 'OFFLINE';
      this.broadcastPresenceChange(expertProfileId, nextStatus);
      console.log(`🟢 [Presence] Expert ${expertProfileId} released from busy lock. Next status: ${nextStatus}`);
    }
  }

  /**
   * Check if expert is currently busy in consultation.
   */
  isExpertBusy(expertProfileId: string): boolean {
    return this.activeConsultations.has(expertProfileId);
  }

  /**
   * Check if expert has at least one active socket connected.
   */
  isExpertSocketConnected(expertProfileId: string): boolean {
    const sockets = this.expertSockets.get(expertProfileId);
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Get total number of active sockets for an expert (across tabs/devices).
   */
  getExpertSocketCount(expertProfileId: string): number {
    return this.expertSockets.get(expertProfileId)?.size || 0;
  }

  /**
   * Get current authoritative presence status and socket count for an expert.
   */
  async getExpertPresence(expertProfileId: string): Promise<{ status: PresenceStatus; socketCount: number }> {
    const isBusy = this.isExpertBusy(expertProfileId);
    const socketCount = this.getExpertSocketCount(expertProfileId);
    if (isBusy) {
      return { status: 'BUSY', socketCount };
    }
    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertProfileId },
      select: { isOnline: true },
    });
    return {
      status: expert?.isOnline ? 'ONLINE' : 'OFFLINE',
      socketCount,
    };
  }

  /**
   * Validate if an expert is eligible to receive a call.
   */
  async canExpertAcceptCall(expertProfileId: string): Promise<{ eligible: boolean; reason?: string }> {
    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertProfileId },
      select: { verificationStatus: true, isOnline: true },
    });

    if (!expert || expert.verificationStatus !== 'VERIFIED') {
      return { eligible: false, reason: 'Expert is not verified for consultations.' };
    }

    if (!expert.isOnline) {
      return { eligible: false, reason: 'Expert is currently offline.' };
    }

    if (this.isExpertBusy(expertProfileId)) {
      return { eligible: false, reason: 'Expert is currently busy in another consultation.' };
    }

    return { eligible: true };
  }

  /**
   * Validate if an expert is eligible to accept a chat consultation.
   */
  async canExpertAcceptChat(expertProfileId: string): Promise<{ eligible: boolean; reason?: string }> {
    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertProfileId },
      select: { verificationStatus: true, isOnline: true },
    });

    if (!expert || expert.verificationStatus !== 'VERIFIED') {
      return { eligible: false, reason: 'Expert is not verified for consultations.' };
    }

    if (!expert.isOnline) {
      return { eligible: false, reason: 'Expert is currently offline.' };
    }

    if (this.isExpertBusy(expertProfileId)) {
      return { eligible: false, reason: 'Expert is currently busy in another consultation.' };
    }

    return { eligible: true };
  }

  /**
   * Broadcast presence status update across all connected clients.
   */
  broadcastPresenceChange(expertProfileId: string, status: PresenceStatus) {
    if (this.io) {
      this.io.emit('expert:presence_changed', {
        expertId: expertProfileId,
        status,
        isOnline: status === 'ONLINE',
        isBusy: status === 'BUSY',
      });
    }
  }
}

export const presenceService = new PresenceService();
