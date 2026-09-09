import { ICallProvider, CallProviderSession, CreateSessionOptions } from './call-provider.interface';

export class WebRTCCallProvider implements ICallProvider {
  private activeSessions = new Map<string, CallProviderSession>();

  getProviderName(): string {
    return 'webrtc-native-p2p';
  }

  getIceServers(): Array<{ urls: string | string[]; username?: string; credential?: string }> {
    const stunUrlsEnv = process.env.WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
    const stunUrls = stunUrlsEnv.split(',').map((u) => u.trim()).filter(Boolean);

    const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: stunUrls },
    ];

    const turnUrl = process.env.WEBRTC_TURN_URL;
    const turnUsername = process.env.WEBRTC_TURN_USERNAME;
    const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      const turnUrls = turnUrl.includes(',')
        ? turnUrl.split(',').map((u) => u.trim()).filter(Boolean)
        : turnUrl.trim();

      servers.push({
        urls: turnUrls,
        username: turnUsername.trim(),
        credential: turnCredential.trim(),
      });
      console.log('🛡️ [WebRTC] Metered TURN relay servers configured with UDP/TCP/TLS fallback.');
    } else {
      console.info('ℹ️ [WebRTC] TURN not configured; some NAT/mobile-network calls may fail in strict firewall environments.');
    }

    return servers;
  }

  async createSession(options: CreateSessionOptions): Promise<CallProviderSession> {
    const iceServers = this.getIceServers();
    const session: CallProviderSession = {
      sessionId: options.callSessionId,
      provider: 'webrtc',
      roomUrl: `webrtc://${options.callSessionId}`,
      token: `webrtc_session_${options.callSessionId}_${Date.now()}`,
      callType: options.callType,
      iceServers,
      createdAt: new Date(),
    };

    this.activeSessions.set(options.callSessionId, session);
    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
  }

  async generateClientToken(sessionId: string, userId: string, role: string): Promise<string> {
    return `webrtc_token_${userId}_${sessionId}_${role}`;
  }
}

export const callProvider: ICallProvider = new WebRTCCallProvider();
