import type { LogCategory, LogSeverity } from '../../domain/entities/AuditLogEntry';
import type { MetricEventKind } from '../../domain/entities/ServiceMetric';
import { TelemetryApiClient } from '../api/TelemetryApiClient';

export interface EmitTelemetryPayload {
  readonly kind: MetricEventKind;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly count?: number;
  readonly revenue?: number;
  readonly tokenUnits?: number;
  readonly latencyMs?: number;
  readonly statusCode?: number;
  readonly source?: string;
  readonly actionName?: string;
  readonly category?: LogCategory;
  readonly severity?: LogSeverity;
  readonly logMessage?: string;
  readonly actorUid?: string;
  readonly actorRole?: string;
}

/**
 * Non-blocking, zero-Firestore telemetry emitter for service traffic, revenue, and token quota usage.
 */
export class PlatformTelemetryEmitter {
  static emit(payload: EmitTelemetryPayload): void {
    void TelemetryApiClient.request('/api/telemetry/ingest', {
      method: 'POST',
      requireAuth: false,
      keepalive: true,
      body: {
        action: 'event',
        ...payload
      }
    }).catch(() => {
      // Telemetry emission must never break primary student/admin workflows
    });
  }
}

