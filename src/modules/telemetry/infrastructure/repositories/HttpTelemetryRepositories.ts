import type { TelemetryQueryFilter } from '../../domain/entities/AuditLogEntry';
import type { SeedMetricInput } from '../../domain/entities/ServiceMetric';
import type {
  DeviceMetadata,
  SessionHeartbeatResult,
  TelemetrySession
} from '../../domain/entities/TelemetrySession';
import type {
  ISessionRepository,
  ITelemetryQueryRepository,
  TelemetryDashboardSnapshot
} from '../../domain/repositories/ITelemetryRepositories';
import { TelemetryApiClient } from '../api/TelemetryApiClient';

export class HttpSessionRepository implements ISessionRepository {
  async registerSession(
    sessionId: string,
    device: DeviceMetadata,
    timezone: string
  ): Promise<TelemetrySession> {
    const res = await TelemetryApiClient.request<{ success: boolean; session: TelemetrySession }>(
      '/api/telemetry/session',
      {
        method: 'POST',
        body: { action: 'register', sessionId, device, timezone }
      }
    );
    return res.session;
  }

  async heartbeat(sessionId: string): Promise<SessionHeartbeatResult> {
    return TelemetryApiClient.request<SessionHeartbeatResult>('/api/telemetry/session', {
      method: 'POST',
      body: { action: 'heartbeat', sessionId }
    });
  }

  async listSessions(): Promise<readonly TelemetrySession[]> {
    const res = await TelemetryApiClient.request<{
      success: boolean;
      sessions: TelemetrySession[];
    }>('/api/telemetry/session', { method: 'GET' });
    return res.sessions;
  }

  async keepAliveSession(targetSessionId: string): Promise<TelemetrySession> {
    const res = await TelemetryApiClient.request<{ success: boolean; session: TelemetrySession }>(
      '/api/telemetry/session',
      {
        method: 'POST',
        body: { action: 'keep_alive', targetSessionId }
      }
    );
    return res.session;
  }

  async revokeSession(targetSessionId: string, revokeAllTokens: boolean): Promise<TelemetrySession> {
    const res = await TelemetryApiClient.request<{ success: boolean; session: TelemetrySession }>(
      '/api/telemetry/session',
      {
        method: 'POST',
        body: { action: 'revoke', targetSessionId, revokeAllTokens }
      }
    );
    return res.session;
  }

  async logoutSession(sessionId: string): Promise<void> {
    await TelemetryApiClient.request<{ success: boolean }>('/api/telemetry/session', {
      method: 'POST',
      body: { action: 'logout', sessionId },
      keepalive: true
    });
  }
}

export class HttpTelemetryQueryRepository implements ITelemetryQueryRepository {
  async fetchSnapshot(filter: TelemetryQueryFilter): Promise<TelemetryDashboardSnapshot> {
    const params = new URLSearchParams({
      granularity: filter.granularity,
      fromMs: String(filter.fromMs),
      toMs: String(filter.toMs),
      severity: filter.severity,
      category: filter.category,
      search: filter.search
    });

    return TelemetryApiClient.request<TelemetryDashboardSnapshot>(
      `/api/telemetry/query?${params.toString()}`,
      { method: 'GET' }
    );
  }

  async seedBackupMetrics(items: readonly SeedMetricInput[]): Promise<{ importedCount: number }> {
    return TelemetryApiClient.request<{ importedCount: number }>('/api/telemetry/ingest', {
      method: 'POST',
      body: { action: 'seed_from_backup', items }
    });
  }
}

export async function authenticateTelemetryAdmin(
  sessionId: string,
  timezone: string
): Promise<{ telemetryToken: string; expiresAt: number }> {
  return TelemetryApiClient.request<{ telemetryToken: string; expiresAt: number }>(
    '/api/telemetry/auth',
    {
      method: 'POST',
      body: { sessionId, timezone }
    }
  );
}

