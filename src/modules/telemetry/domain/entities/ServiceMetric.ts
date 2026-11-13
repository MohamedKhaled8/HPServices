export type TimeGranularity = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

export type MetricEventKind =
  | 'service_traffic'
  | 'service_sale'
  | 'token_usage'
  | 'system_health';

export interface ServiceLeaderboardItem {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly salesCount: number;
  readonly revenue: number;
  readonly trafficCount: number;
  readonly tokenUnits: number;
  readonly latencySum: number;
  readonly latencyCount: number;
  readonly errors: number;
}

export interface TimeBucketPoint {
  readonly bucket: string;
  readonly traffic: number;
  readonly sales: number;
  readonly revenue: number;
  readonly tokens: number;
  readonly logs: number;
}

export interface ChainIntegrityStatus {
  readonly valid: boolean;
  readonly checkedCount: number;
  readonly brokenAtId?: string;
}

export interface SystemHealthSnapshot {
  readonly avgLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly errorRatePercent: number;
  readonly cacheHitRatio: number;
  readonly firestoreReadsUsed: number;
  readonly storageEngine: string;
  readonly chainIntegrity: ChainIntegrityStatus;
}

export interface TelemetrySummaryKPIs {
  readonly activeSessions: number;
  readonly totalSessions: number;
  readonly totalTraffic: number;
  readonly totalSalesCount: number;
  readonly totalRevenue: number;
  readonly totalTokens: number;
  readonly totalLogs: number;
}

export interface SeedMetricInput {
  readonly kind: 'service_sale' | 'service_traffic';
  readonly serviceId: string;
  readonly serviceName: string;
  readonly count: number;
  readonly revenue: number;
  readonly tokenUnits: number;
  readonly timestampMs: number;
  readonly source: string;
}

