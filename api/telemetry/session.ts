import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  applySecurityHeaders,
  appendAuditLog,
  extractGeoInfo,
  getTelemetryDb,
  sanitizeText,
  telemetryCache,
  verifyAdminRequest,
  type TelemetrySessionRecord
} from './_shared.js';
import {
  SESSION_TTL_MS,
  HEARTBEAT_WRITE_THROTTLE_MS,
  parseDeviceInput,
  handleKeepAlive,
  handleRevoke,
  handleLogout
} from './_sessionMutations.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applySecurityHeaders(req, res)) return;

  try {
    const db = getTelemetryDb();

    if (req.method === 'GET') {
      await verifyAdminRequest(req, ['telemetry_admin']);
      const cached = telemetryCache.get<TelemetrySessionRecord[]>('sessions:list');
      if (cached) {
        return res.status(200).json({ success: true, sessions: cached, cached: true });
      }

      const snap = await db.ref('telemetry_v1/sessions').get();
      const now = Date.now();
      const sessions: TelemetrySessionRecord[] = [];
      if (snap.exists()) {
        const rawMap = snap.val() as Record<string, TelemetrySessionRecord>;
        for (const item of Object.values(rawMap)) {
          if (!item || !item.sessionId) continue;
          const derivedStatus =
            item.status === 'active' && now > item.expiresAtMs ? 'expired' : item.status;
          sessions.push({ ...item, status: derivedStatus });
        }
      }
      sessions.sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);
      telemetryCache.set('sessions:list', sessions, 4000);
      return res.status(200).json({ success: true, sessions, cached: false });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const action = sanitizeText(req.body?.action, 32);
    const userAgentHeader =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';

    if (action === 'register') {
      const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const sessionId =
        sanitizeText(req.body?.sessionId, 64) ||
        `sess_${now}_${crypto.randomBytes(6).toString('hex')}`;
      const device = parseDeviceInput(req.body?.device, userAgentHeader);
      const geo = await extractGeoInfo(req, sanitizeText(req.body?.timezone, 64));

      const sessionRecord: TelemetrySessionRecord = {
        sessionId,
        uid: ctx.uid,
        email: ctx.email,
        role: ctx.role,
        status: 'active',
        createdAtMs: now,
        createdAtIso: nowIso,
        lastSeenAtMs: now,
        lastSeenAtIso: nowIso,
        expiresAtMs: now + SESSION_TTL_MS,
        keepAliveCount: 0,
        device,
        geo,
        metadata: {
          portal: ctx.role === 'telemetry_admin' ? '/telemetry' : '/admin',
          authMethod: 'firebase_id_token'
        }
      };

      await db.ref(`telemetry_v1/sessions/${sessionId}`).set(sessionRecord);
      telemetryCache.invalidate('sessions:');
      telemetryCache.set(`session:${sessionId}`, sessionRecord, 5000);

      await appendAuditLog({
        action: 'ADMIN_SESSION_STARTED',
        category: 'session',
        severity: 'info',
        actorUid: ctx.uid,
        actorRole: ctx.role,
        message: `${ctx.role} logged in from ${device.browser} on ${device.os} (${geo.city}, ${geo.country})`,
        ip: geo.ip,
        metadata: { sessionId, deviceType: device.deviceType }
      });

      return res.status(200).json({ success: true, session: sessionRecord });
    }

    if (action === 'heartbeat') {
      const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
      const sessionId = sanitizeText(req.body?.sessionId, 64);
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Missing sessionId' });
      }

      const cached = telemetryCache.get<TelemetrySessionRecord>(`session:${sessionId}`);
      let record = cached;
      if (!record) {
        const snap = await db.ref(`telemetry_v1/sessions/${sessionId}`).get();
        record = snap.exists() ? (snap.val() as TelemetrySessionRecord) : null;
      }

      // If missing from DB, do NOT logout; signal silent re-registration
      if (!record) {
        return res.status(200).json({ success: true, status: 'active', shouldLogout: false, needsReRegistration: true });
      }

      const now = Date.now();
      if (record.uid !== ctx.uid && ctx.role !== 'telemetry_admin') {
        return res.status(403).json({ success: false, error: 'Session ownership mismatch' });
      }

      // ONLY manual remote security revocation triggers forced logout
      if (record.status === 'revoked') {
        return res.status(200).json({
          success: true,
          status: 'revoked',
          shouldLogout: true,
          revokedAtMs: record.revokedAtMs
        });
      }

      // Self-heal and refresh sliding lease on active admin heartbeat
      const newExpiresAt = now + SESSION_TTL_MS;
      if (now - record.lastSeenAtMs > HEARTBEAT_WRITE_THROTTLE_MS || record.expiresAtMs < now + (SESSION_TTL_MS / 2)) {
        const nowIso = new Date(now).toISOString();
        record = {
          ...record,
          status: 'active',
          lastSeenAtMs: now,
          lastSeenAtIso: nowIso,
          expiresAtMs: newExpiresAt
        };
        await db.ref(`telemetry_v1/sessions/${sessionId}`).update({
          status: 'active',
          lastSeenAtMs: now,
          lastSeenAtIso: nowIso,
          expiresAtMs: newExpiresAt
        });
        telemetryCache.set(`session:${sessionId}`, record, 5000);
        telemetryCache.invalidate('sessions:');
      }

      return res.status(200).json({
        success: true,
        status: 'active',
        shouldLogout: false,
        expiresAtMs: record.expiresAtMs
      });
    }

    if (action === 'keep_alive') return handleKeepAlive(req, res);
    if (action === 'revoke') return handleRevoke(req, res);
    if (action === 'logout') return handleLogout(req, res);

    return res.status(400).json({ success: false, error: 'Invalid session action' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.startsWith('FORBIDDEN') ? 403 : message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}
