import type { TelemetrySession } from '../entities/TelemetrySession.ts';
import type { ISessionRepository } from '../repositories/ITelemetryRepositories.ts';

export class ManageSessionUseCase {
  private readonly sessionRepo: ISessionRepository;

  constructor(sessionRepo: ISessionRepository) {
    this.sessionRepo = sessionRepo;
  }

  async keepAlive(targetSessionId: string): Promise<TelemetrySession> {
    if (!targetSessionId.trim()) {
      throw new Error('معرّف الجلسة مطلوب لإبقائها نشطة');
    }
    return this.sessionRepo.keepAliveSession(targetSessionId);
  }

  async forceRevoke(targetSessionId: string, revokeAllTokens: boolean): Promise<TelemetrySession> {
    if (!targetSessionId.trim()) {
      throw new Error('معرّف الجلسة مطلوب لإنهائها');
    }
    return this.sessionRepo.revokeSession(targetSessionId, revokeAllTokens);
  }

  static computeRemainingLeaseSeconds(session: TelemetrySession, nowMs: number): number {
    if (session.status !== 'active') return 0;
    return Math.max(0, Math.floor((session.expiresAtMs - nowMs) / 1000));
  }

  static shouldTriggerLogout(heartbeatResult: { shouldLogout?: boolean; status: string }): boolean {
    return Boolean(heartbeatResult.shouldLogout && heartbeatResult.status === 'revoked');
  }

  static shouldReRegister(heartbeatResult: { status: string; needsReRegistration?: boolean }): boolean {
    return heartbeatResult.status === 'expired' || Boolean(heartbeatResult.needsReRegistration);
  }
}
