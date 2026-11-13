import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import {
  applySecurityHeaders,
  appendAuditLog,
  extractGeoInfo,
  getTelemetryDb,
  sanitizeText,
  telemetryCache,
  verifyAdminRequest,
  type TelemetrySessionRecord,
  type DeviceInfo
} from './_shared.js';

const SESSION_TTL_MS = 30 * 60 * 1000;
const HEARTBEAT_WRITE_THROTTLE_MS = 20 * 1000;

function parseDeviceInput(raw: unknown, userAgentHeader: string): DeviceInfo {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const deviceTypeRaw = sanitizeText(input.deviceType, 16);
  const deviceType: DeviceInfo['deviceType'] =
    deviceTypeRaw === 'Desktop' || deviceTypeRaw === 'Mobile' || deviceTypeRaw === 'Tablet'
      ? deviceTypeRaw
      : 'Unknown';

  return {
    deviceName: sanitizeText(input.deviceName || 'Unknown Device', 80),
    os: sanitizeText(input.os || 'Unknown OS', 48),
    browser: sanitizeText(input.browser || 'Unknown Browser', 48),
    deviceType,
    userAgent: sanitizeText(input.userAgent || userAgentHeader, 240),
    screenResolution: sanitizeText(input.screenResolution || '', 32)
  };
}

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

      if (!record) {
        return res.status(200).json({ success: true, status: 'expired', shouldLogout: false });
      }

      const now = Date.now();
      if (record.uid !== ctx.uid && ctx.role !== 'telemetry_admin') {
        return res.status(403).json({ success: false, error: 'Session ownership mismatch' });
      }

      if (record.status === 'revoked') {
        return res.status(200).json({
          success: true,
          status: 'revoked',
          shouldLogout: true,
          revokedAtMs: record.revokedAtMs
        });
      }

      if (now > record.expiresAtMs) {
        return res.status(200).json({
          success: true,
          status: 'expired',
          shouldLogout: true
        });
      }

      if (now - record.lastSeenAtMs > HEARTBEAT_WRITE_THROTTLE_MS) {
        const nowIso = new Date(now).toISOString();
        record = { ...record, lastSeenAtMs: now, lastSeenAtIso: nowIso };
        await db.ref(`telemetry_v1/sessions/${sessionId}`).update({
          lastSeenAtMs: now,
          lastSeenAtIso: nowIso
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

    if (action === 'keep_alive') {
      const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
      const targetSessionId = sanitizeText(req.body?.targetSessionId, 64);
      if (!targetSessionId) {
        return res.status(400).json({ success: false, error: 'Missing targetSessionId' });
      }

      const snap = await db.ref(`telemetry_v1/sessions/${targetSessionId}`).get();
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const existing = snap.val() as TelemetrySessionRecord;
      const now = Date.now();
      const updated: TelemetrySessionRecord = {
        ...existing,
        status: 'active',
        expiresAtMs: now + SESSION_TTL_MS,
        lastSeenAtMs: now,
        lastSeenAtIso: new Date(now).toISOString(),
        keepAliveCount: (existing.keepAliveCount || 0) + 1
      };

      await db.ref(`telemetry_v1/sessions/${targetSessionId}`).set(updated);
      telemetryCache.set(`session:${targetSessionId}`, updated, 5000);
      telemetryCache.invalidate('sessions:');

      const geo = await extractGeoInfo(req);
      await appendAuditLog({
        action: 'SESSION_KEPT_ALIVE',
        category: 'session',
        severity: 'info',
        actorUid: ctx.uid,
        actorRole: ctx.role,
        message: `Extended session lease for ${existing.device?.deviceName || targetSessionId} (+30m)`,
        ip: geo.ip,
        metadata: { targetSessionId, targetUid: existing.uid }
      });

      return res.status(200).json({ success: true, session: updated });
    }

    if (action === 'revoke') {
      const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
      const targetSessionId = sanitizeText(req.body?.targetSessionId, 64);
      const revokeAllTokens = Boolean(req.body?.revokeAllTokens);
      if (!targetSessionId) {
        return res.status(400).json({ success: false, error: 'Missing targetSessionId' });
      }

      const snap = await db.ref(`telemetry_v1/sessions/${targetSessionId}`).get();
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const existing = snap.val() as TelemetrySessionRecord;
      const now = Date.now();
      const updated: TelemetrySessionRecord = {
        ...existing,
        status: 'revoked',
        revokedAtMs: now,
        revokedBy: ctx.uid
      };

      await db.ref(`telemetry_v1/sessions/${targetSessionId}`).set(updated);
      telemetryCache.set(`session:${targetSessionId}`, updated, 5000);
      telemetryCache.invalidate('sessions:');

      if (revokeAllTokens && existing.uid) {
        await getAuth().revokeRefreshTokens(existing.uid);
      }

      const geo = await extractGeoInfo(req);
      await appendAuditLog({
        action: 'SESSION_FORCE_REVOKED',
        category: 'security',
        severity: 'critical',
        actorUid: ctx.uid,
        actorRole: ctx.role,
        message: `Force-revoked session ${targetSessionId} (${existing.device?.os} / ${existing.geo?.ip})`,
        ip: geo.ip,
        metadata: { targetSessionId, targetUid: existing.uid, revokeAllTokens }
      });

      return res.status(200).json({ success: true, session: updated });
    }

    if (action === 'logout') {
      const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
      const sessionId = sanitizeText(req.body?.sessionId, 64);
      if (sessionId) {
        const now = Date.now();
        await db.ref(`telemetry_v1/sessions/${sessionId}`).update({
          status: 'expired',
          lastSeenAtMs: now,
          lastSeenAtIso: new Date(now).toISOString()
        });
        telemetryCache.invalidate('sessions:');
        telemetryCache.invalidate(`session:${sessionId}`);
        const geo = await extractGeoInfo(req);
        await appendAuditLog({
          action: 'ADMIN_SESSION_LOGOUT',
          category: 'session',
          severity: 'info',
          actorUid: ctx.uid,
          actorRole: ctx.role,
          message: `${ctx.role} signed out cleanly`,
          ip: geo.ip,
          metadata: { sessionId }
        });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Invalid session action' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.startsWith('FORBIDDEN') ? 403 : message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}

