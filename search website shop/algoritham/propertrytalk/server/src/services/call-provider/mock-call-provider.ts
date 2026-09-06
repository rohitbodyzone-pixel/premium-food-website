import { ICallProvider, CallProviderSession, CreateSessionOptions } from './call-provider.interface';

export class MockCallProvider implements ICallProvider {
  private activeSessions = new Map<string, CallProviderSession>();

  getProviderName(): string {
    return 'mock-development-provider';
  }

  async createSession(options: CreateSessionOptions): Promise<CallProviderSession> {
    const session: CallProviderSession = {
      sessionId: options.callSessionId,
      provider: 'mock',
      roomUrl: `propertytalk://mock-room/${options.callSessionId}`,
      token: `mock_token_${options.callSessionId}_${Date.now()}`,
      callType: options.callType,
      createdAt: new Date(),
    };
    this.activeSessions.set(options.callSessionId, session);
    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
  }

  async generateClientToken(sessionId: string, userId: string, role: string): Promise<string> {
    return `mock_token_for_${userId}_in_${sessionId}_role_${role}`;
  }
}

export const callProvider: ICallProvider = new MockCallProvider();
