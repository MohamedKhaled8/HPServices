import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  applySecurityHeaders,
  appendAuditLog,
  extractGeoInfo,
  getTelemetryDb,
  sanitizeText,
  telemetryCache,
  verifyAdminRequest,
  type LogCategory,
  type LogSeverity,
  type MetricEventRecord
} from './_shared.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_INGEST_PER_IP = 120;
const ipRateStore = new Map<string, { count: number; resetAt: number }>();

function checkIpIngestRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateStore.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_INGEST_PER_IP) return false;
  entry.count += 1;
  return true;
}

function clampFinite(val: unknown, fallback = 0, max = 1_000_000_000): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applySecurityHeaders(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const clientHeader = req.headers['x-telemetry-client'];
    if (clientHeader !== 'hp-telemetry-v1') {
      return res.status(403).json({ success: false, error: 'Missing telemetry client header' });
    }

    const geo = await extractGeoInfo(req);
    if (!checkIpIngestRate(geo.ip)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
    }

    const db = getTelemetryDb();
    const action = sanitizeText(req.body?.action, 32) || 'event';

    if (action === 'seed_from_backup') {
      const ctx = await verifyAdminRequest(req, ['telemetry_admin', 'primary_admin']);
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (items.length === 0) {
        return res.status(400).json({ success: false, error: 'No backup metric items supplied' });
      }

      const capped = items.slice(0, 500);
      const updates: Record<string, MetricEventRecord> = {};
      for (let i = 0; i < capped.length; i++) {
        const raw = capped[i] as Record<string, unknown>;
        const tsMs = clampFinite(raw.timestampMs, Date.now());
        const key = `seed_${tsMs}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        updates[key] = {
          id: key,
          kind: raw.kind === 'service_sale' ? 'service_sale' : 'service_traffic',
          serviceId: sanitizeText(raw.serviceId || 'unknown', 32),
          serviceName: sanitizeText(raw.serviceName || 'خدمة غير محددة', 80),
          count: clampFinite(raw.count, 1, 100000),
          revenue: clampFinite(raw.revenue, 0, 100_000_000),
          tokenUnits: clampFinite(raw.tokenUnits, 0, 100_000_000),
          latencyMs: clampFinite(raw.latencyMs, 0, 60000),
          statusCode: clampFinite(raw.statusCode, 200, 599),
          timestampMs: tsMs,
          timestampIso: new Date(tsMs).toISOString(),
          source: sanitizeText(raw.source || 'supabase_backup_seed', 48)
        };
      }

      await db.ref('telemetry_v1/metrics').update(updates);
      telemetryCache.invalidate('query:');

      await appendAuditLog({
        action: 'TELEMETRY_BACKUP_SEEDED',
        category: 'system',
        severity: 'info',
        actorUid: ctx.uid,
        actorRole: ctx.role,
        message: `Imported ${capped.length} historical service metrics from Supabase backup (0 Firestore reads)`,
        ip: geo.ip
      });

      return res.status(200).json({ success: true, importedCount: capped.length });
    }

    // Standard single telemetry event ingestion
    const kindRaw = sanitizeText(req.body?.kind, 32);
    const kind: MetricEventRecord['kind'] =
      kindRaw === 'service_sale' ||
      kindRaw === 'token_usage' ||
      kindRaw === 'system_health'
        ? kindRaw
        : 'service_traffic';

    const now = Date.now();
    const metricRef = db.ref('telemetry_v1/metrics').push();
    const record: MetricEventRecord = {
      id: metricRef.key || `m_${now}`,
      kind,
      serviceId: sanitizeText(req.body?.serviceId || 'platform', 32),
      serviceName: sanitizeText(req.body?.serviceName || 'Platform Service', 80),
      count: clampFinite(req.body?.count, 1, 10000),
      revenue: clampFinite(req.body?.revenue, 0, 1_000_000),
      tokenUnits: clampFinite(req.body?.tokenUnits, 0, 1_000_000),
      latencyMs: clampFinite(req.body?.latencyMs, 0, 120000),
      statusCode: clampFinite(req.body?.statusCode, 200, 599),
      timestampMs: now,
      timestampIso: new Date(now).toISOString(),
      source: sanitizeText(req.body?.source || 'web_client', 48)
    };

    await metricRef.set(record);
    telemetryCache.invalidate('query:');

    if (req.body?.logMessage) {
      const catRaw = sanitizeText(req.body?.category, 16);
      const sevRaw = sanitizeText(req.body?.severity, 16);
      const category: LogCategory =
        catRaw === 'auth' ||
        catRaw === 'session' ||
        catRaw === 'service' ||
        catRaw === 'token' ||
        catRaw === 'security'
          ? catRaw
          : 'system';
      const severity: LogSeverity =
        sevRaw === 'warn' || sevRaw === 'error' || sevRaw === 'critical' ? sevRaw : 'info';

      await appendAuditLog({
        action: sanitizeText(req.body?.actionName || kind.toUpperCase(), 64),
        category,
        severity,
        actorUid: sanitizeText(req.body?.actorUid || 'client', 64),
        actorRole: sanitizeText(req.body?.actorRole || 'student', 32),
        message: sanitizeText(req.body?.logMessage, 320),
        ip: geo.ip,
        latencyMs: record.latencyMs,
        serviceId: record.serviceId
      });
    }

    return res.status(200).json({ success: true, id: record.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.startsWith('FORBIDDEN') ? 403 : message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}

