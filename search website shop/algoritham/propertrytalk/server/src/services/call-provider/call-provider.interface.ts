export interface CallProviderSession {
  sessionId: string;
  provider: string; // 'mock' | 'webrtc' | 'agora' | 'daily'
  roomUrl?: string;
  token?: string;
  callType: 'AUDIO' | 'VIDEO';
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  createdAt: Date;
}

export interface CreateSessionOptions {
  callSessionId: string;
  consumerId: string;
  expertId: string;
  callType: 'AUDIO' | 'VIDEO';
}

export interface ICallProvider {
  getProviderName(): string;
  createSession(options: CreateSessionOptions): Promise<CallProviderSession>;
  endSession(sessionId: string): Promise<void>;
  generateClientToken(sessionId: string, userId: string, role: string): Promise<string>;
}
