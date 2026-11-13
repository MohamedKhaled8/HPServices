import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  applySecurityHeaders,
  computeDeterministicAuditHash,
  formatTimeBucket,
  getTelemetryDb,
  sanitizeText,
  telemetryCache,
  verifyAdminRequest,
  type AuditLogRecord,
  type MetricEventRecord,
  type TelemetrySessionRecord,
  type TimeGranularity
} from './_shared.js';

const VALID_GRANULARITIES: ReadonlySet<TimeGranularity> = new Set([
  'second',
  'minute',
  'hour',
  'day',
  'month',
  'year'
]);

function verifyAuditChainIntegrity(logsAsc: AuditLogRecord[]): {
  valid: boolean;
  checkedCount: number;
  brokenAtId?: string;
} {
  if (logsAsc.length === 0) return { valid: true, checkedCount: 0 };
  for (let i = 0; i < logsAsc.length; i++) {
    const entry = logsAsc[i];
    if (i > 0 && entry.prevHash !== logsAsc[i - 1].entryHash) {
      return { valid: false, checkedCount: i + 1, brokenAtId: entry.id };
    }
    const recomputed = computeDeterministicAuditHash(entry.prevHash, entry);
    if (recomputed !== entry.entryHash) {
      return { valid: false, checkedCount: i + 1, brokenAtId: entry.id };
    }
  }
  return { valid: true, checkedCount: logsAsc.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applySecurityHeaders(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    await verifyAdminRequest(req, ['telemetry_admin']);

    const granRaw = sanitizeText(req.query.granularity, 16) as TimeGranularity;
    const granularity: TimeGranularity = VALID_GRANULARITIES.has(granRaw) ? granRaw : 'hour';
    const fromMs = req.query.fromMs ? Number(req.query.fromMs) : 0;
    const toMs = req.query.toMs ? Number(req.query.toMs) : Date.now() + 60_000;
    const severityFilter = sanitizeText(req.query.severity, 16);
    const categoryFilter = sanitizeText(req.query.category, 16);
    const searchFilter = sanitizeText(req.query.search, 100).toLowerCase();

    const cacheKey = `query:${granularity}:${fromMs}:${toMs}:${severityFilter}:${categoryFilter}:${searchFilter}`;
    const cached = telemetryCache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    const db = getTelemetryDb();
    const [metricsSnap, logsSnap, sessionsSnap] = await Promise.all([
      db.ref('telemetry_v1/metrics').limitToLast(500).get(),
      db.ref('telemetry_v1/audit_logs').limitToLast(400).get(),
      db.ref('telemetry_v1/sessions').get()
    ]);

    const allMetrics: MetricEventRecord[] = metricsSnap.exists()
      ? Object.values(metricsSnap.val() as Record<string, MetricEventRecord>)
      : [];
    const allLogsRaw: AuditLogRecord[] = logsSnap.exists()
      ? Object.entries(logsSnap.val() as Record<string, AuditLogRecord>).map(([id, item]) => ({
          ...item,
          id: item.id || id
        }))
      : [];
    const allSessionsRaw: TelemetrySessionRecord[] = sessionsSnap.exists()
      ? Object.values(sessionsSnap.val() as Record<string, TelemetrySessionRecord>)
      : [];

    const now = Date.now();
    const sessions = allSessionsRaw
      .map((s) => ({
        ...s,
        status: s.status === 'active' && now > s.expiresAtMs ? ('expired' as const) : s.status
      }))
      .sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);

    const inWindowMetrics = allMetrics.filter(
      (m) => m && m.timestampMs >= fromMs && m.timestampMs <= toMs
    );

    const logsAsc = [...allLogsRaw].sort((a, b) => a.timestampMs - b.timestampMs);
    const chainIntegrity = verifyAuditChainIntegrity(logsAsc);

    const filteredLogs = logsAsc
      .filter((l) => l.timestampMs >= fromMs && l.timestampMs <= toMs)
      .filter((l) => (!severityFilter || severityFilter === 'all' ? true : l.severity === severityFilter))
      .filter((l) => (!categoryFilter || categoryFilter === 'all' ? true : l.category === categoryFilter))
      .filter((l) => {
        if (!searchFilter) return true;
        return (
          l.action.toLowerCase().includes(searchFilter) ||
          l.message.toLowerCase().includes(searchFilter) ||
          l.ip.toLowerCase().includes(searchFilter) ||
          l.actorUid.toLowerCase().includes(searchFilter)
        );
      })
      .reverse();

    // Aggregate per-service sales, traffic, and tokens
    const serviceAggMap = new Map<
      string,
      {
        serviceId: string;
        serviceName: string;
        salesCount: number;
        revenue: number;
        trafficCount: number;
        tokenUnits: number;
        latencySum: number;
        latencyCount: number;
        errors: number;
      }
    >();

    const bucketsMap = new Map<
      string,
      { bucket: string; traffic: number; sales: number; revenue: number; tokens: number; logs: number }
    >();

    const latencies: number[] = [];
    let totalErrors = 0;

    for (const m of inWindowMetrics) {
      const sid = m.serviceId || 'unknown';
      const current = serviceAggMap.get(sid) || {
        serviceId: sid,
        serviceName: m.serviceName || sid,
        salesCount: 0,
        revenue: 0,
        trafficCount: 0,
        tokenUnits: 0,
        latencySum: 0,
        latencyCount: 0,
        errors: 0
      };

      if (m.kind === 'service_sale') {
        current.salesCount += m.count || 1;
        current.revenue += m.revenue || 0;
        current.trafficCount += m.count || 1;
      } else if (m.kind === 'token_usage') {
        current.tokenUnits += m.tokenUnits || 0;
        current.trafficCount += m.count || 1;
      } else {
        current.trafficCount += m.count || 1;
      }

      if (m.latencyMs > 0) {
        current.latencySum += m.latencyMs;
        current.latencyCount += 1;
        latencies.push(m.latencyMs);
      }
      if (m.statusCode >= 400) {
        current.errors += 1;
        totalErrors += 1;
      }
      serviceAggMap.set(sid, current);

      const bKey = formatTimeBucket(m.timestampMs, granularity);
      const b = bucketsMap.get(bKey) || {
        bucket: bKey,
        traffic: 0,
        sales: 0,
        revenue: 0,
        tokens: 0,
        logs: 0
      };
      b.traffic += m.count || 1;
      if (m.kind === 'service_sale') {
        b.sales += m.count || 1;
        b.revenue += m.revenue || 0;
      }
      b.tokens += m.tokenUnits || 0;
      bucketsMap.set(bKey, b);
    }

    for (const l of filteredLogs) {
      const bKey = formatTimeBucket(l.timestampMs, granularity);
      const b = bucketsMap.get(bKey) || {
        bucket: bKey,
        traffic: 0,
        sales: 0,
        revenue: 0,
        tokens: 0,
        logs: 0
      };
      b.logs += 1;
      bucketsMap.set(bKey, b);
    }

    const servicesList = Array.from(serviceAggMap.values());
    const topSelling = [...servicesList]
      .sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount)
      .slice(0, 12);
    const highestTraffic = [...servicesList]
      .sort((a, b) => b.trafficCount - a.trafficCount)
      .slice(0, 12);
    const tokenLeaderboard = [...servicesList]
      .sort((a, b) => b.tokenUnits - a.tokenUnits)
      .slice(0, 12);

    const timeSeries = Array.from(bucketsMap.values())
      .sort((a, b) => a.bucket.localeCompare(b.bucket))
      .slice(-60);

    latencies.sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length)
        : 0;
    const p95LatencyMs =
      latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : 0;

    const totalCacheLookups = telemetryCache.hits + telemetryCache.misses;
    const cacheHitRatio =
      totalCacheLookups > 0 ? Math.round((telemetryCache.hits / totalCacheLookups) * 100) : 100;

    const payload = {
      success: true,
      granularity,
      summary: {
        activeSessions: sessions.filter((s) => s.status === 'active').length,
        totalSessions: sessions.length,
        totalTraffic: servicesList.reduce((acc, s) => acc + s.trafficCount, 0),
        totalSalesCount: servicesList.reduce((acc, s) => acc + s.salesCount, 0),
        totalRevenue: servicesList.reduce((acc, s) => acc + s.revenue, 0),
        totalTokens: servicesList.reduce((acc, s) => acc + s.tokenUnits, 0),
        totalLogs: filteredLogs.length
      },
      health: {
        avgLatencyMs,
        p95LatencyMs,
        errorRatePercent:
          inWindowMetrics.length > 0
            ? Number(((totalErrors / inWindowMetrics.length) * 100).toFixed(2))
            : 0,
        cacheHitRatio,
        firestoreReadsUsed: 0,
        storageEngine: 'Firebase RTDB + In-Memory TTL Cache',
        chainIntegrity
      },
      topSelling,
      highestTraffic,
      tokenLeaderboard,
      timeSeries,
      sessions,
      logs: filteredLogs.slice(0, 500)
    };

    telemetryCache.set(cacheKey, payload, 3000);
    return res.status(200).json({ ...payload, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.startsWith('FORBIDDEN') ? 403 : message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}
