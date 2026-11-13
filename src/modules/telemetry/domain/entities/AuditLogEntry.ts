import type { TimeGranularity } from './ServiceMetric';

export type LogSeverity = 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'auth' | 'session' | 'service' | 'system' | 'token' | 'security';

export interface AuditLogEntry {
  readonly id: string;
  readonly action: string;
  readonly category: LogCategory;
  readonly severity: LogSeverity;
  readonly actorUid: string;
  readonly actorRole: string;
  readonly message: string;
  readonly ip: string;
  readonly timestampMs: number;
  readonly timestampIso: string;
  readonly latencyMs?: number;
  readonly serviceId?: string;
  readonly prevHash: string;
  readonly entryHash: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface TelemetryQueryFilter {
  readonly granularity: TimeGranularity;
  readonly fromMs: number;
  readonly toMs: number;
  readonly severity: LogSeverity | 'all';
  readonly category: LogCategory | 'all';
  readonly search: string;
}

