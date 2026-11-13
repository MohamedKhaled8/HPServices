import type { AuditLogEntry, TelemetryQueryFilter } from '../entities/AuditLogEntry';
import type {
  SeedMetricInput,
  ServiceLeaderboardItem,
  SystemHealthSnapshot,
  TelemetrySummaryKPIs,
  TimeBucketPoint
} from '../entities/ServiceMetric';
import type {
  DeviceMetadata,
  SessionHeartbeatResult,
  TelemetrySession
} from '../entities/TelemetrySession';

export interface TelemetryDashboardSnapshot {
  readonly granularity: TelemetryQueryFilter['granularity'];
  readonly summary: TelemetrySummaryKPIs;
  readonly health: SystemHealthSnapshot;
  readonly topSelling: readonly ServiceLeaderboardItem[];
  readonly highestTraffic: readonly ServiceLeaderboardItem[];
  readonly tokenLeaderboard: readonly ServiceLeaderboardItem[];
  readonly timeSeries: readonly TimeBucketPoint[];
  readonly sessions: readonly TelemetrySession[];
  readonly logs: readonly AuditLogEntry[];
  readonly cached?: boolean;
}

export interface ISessionRepository {
  registerSession(sessionId: string, device: DeviceMetadata, timezone: string): Promise<TelemetrySession>;
  heartbeat(sessionId: string): Promise<SessionHeartbeatResult>;
  listSessions(): Promise<readonly TelemetrySession[]>;
  keepAliveSession(targetSessionId: string): Promise<TelemetrySession>;
  revokeSession(targetSessionId: string, revokeAllTokens: boolean): Promise<TelemetrySession>;
  logoutSession(sessionId: string): Promise<void>;
}

export interface ITelemetryQueryRepository {
  fetchSnapshot(filter: TelemetryQueryFilter): Promise<TelemetryDashboardSnapshot>;
  seedBackupMetrics(items: readonly SeedMetricInput[]): Promise<{ importedCount: number }>;
}

