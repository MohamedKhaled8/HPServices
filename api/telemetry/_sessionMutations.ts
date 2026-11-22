import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import {
  appendAuditLog,
  extractGeoInfo,
  getTelemetryDb,
  sanitizeText,
  telemetryCache,
  verifyAdminRequest,
  type TelemetrySessionRecord,
  type DeviceInfo
} from './_shared.js';

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const HEARTBEAT_WRITE_THROTTLE_MS = 20 * 1000;

export function parseDeviceInput(raw: unknown, userAgentHeader: string): DeviceInfo {
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

export async function handleKeepAlive(req: VercelRequest, res: VercelResponse) {
  const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
  const targetSessionId = sanitizeText(req.body?.targetSessionId, 64);
  if (!targetSessionId) {
    return res.status(400).json({ success: false, error: 'Missing targetSessionId' });
  }

  const db = getTelemetryDb();
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

export async function handleRevoke(req: VercelRequest, res: VercelResponse) {
  const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
  const targetSessionId = sanitizeText(req.body?.targetSessionId, 64);
  const revokeAllTokens = Boolean(req.body?.revokeAllTokens);
  if (!targetSessionId) {
    return res.status(400).json({ success: false, error: 'Missing targetSessionId' });
  }

  const db = getTelemetryDb();
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

export async function handleLogout(req: VercelRequest, res: VercelResponse) {
  const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
  const sessionId = sanitizeText(req.body?.sessionId, 64);
  if (sessionId) {
    const now = Date.now();
    const db = getTelemetryDb();
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
