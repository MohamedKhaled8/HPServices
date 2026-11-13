import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  applySecurityHeaders,
  appendAuditLog,
  extractGeoInfo,
  getTelemetryDb,
  signTelemetryToken,
  verifyAdminRequest,
  verifyTelemetryToken,
  sanitizeText
} from './_shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applySecurityHeaders(req, res)) return;

  try {
    if (req.method === 'GET') {
      const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
      const tokenHeader =
        typeof req.headers['x-telemetry-token'] === 'string' ? req.headers['x-telemetry-token'] : '';
      const tokenPayload = tokenHeader ? verifyTelemetryToken(tokenHeader) : null;

      return res.status(200).json({
        authenticated: true,
        uid: ctx.uid,
        email: ctx.email,
        role: ctx.role,
        sessionTokenValid: Boolean(tokenPayload && tokenPayload.uid === ctx.uid)
      });
    }

    if (req.method === 'POST') {
      const geo = await extractGeoInfo(req, sanitizeText(req.body?.timezone, 64));
      let ctx;
      try {
        ctx = await verifyAdminRequest(req, ['telemetry_admin']);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unauthorized';
        await appendAuditLog({
          action: 'TELEMETRY_LOGIN_DENIED',
          category: 'security',
          severity: 'warn',
          actorUid: 'anonymous',
          actorRole: 'unknown',
          message: `Denied telemetry portal access attempt: ${msg}`,
          ip: geo.ip
        }).catch(() => {});
        const status = msg.startsWith('FORBIDDEN') ? 403 : 401;
        return res.status(status).json({ success: false, error: msg });
      }

      const db = getTelemetryDb();
      const regSnap = await db.ref(`telemetry_v1/auth_registry/${ctx.uid}`).get();
      const regData = regSnap.exists() ? (regSnap.val() as { role?: string; credentialEpoch?: number }) : null;

      if (regData && regData.role !== 'telemetry_admin') {
        await appendAuditLog({
          action: 'TELEMETRY_RBAC_VIOLATION',
          category: 'security',
          severity: 'critical',
          actorUid: ctx.uid,
          actorRole: ctx.role,
          message: 'Non-telemetry role attempted access to isolated telemetry module',
          ip: geo.ip
        }).catch(() => {});
        return res.status(403).json({ success: false, error: 'Telemetry admin role required' });
      }

      const sessionId = sanitizeText(req.body?.sessionId, 64) || `tsec_${Date.now()}_${ctx.uid.slice(0, 6)}`;
      const expiresAt = Date.now() + 30 * 60 * 1000;
      const telemetryToken = signTelemetryToken({
        sessionId,
        uid: ctx.uid,
        role: ctx.role,
        exp: expiresAt
      });

      await appendAuditLog({
        action: 'TELEMETRY_LOGIN_SUCCESS',
        category: 'auth',
        severity: 'info',
        actorUid: ctx.uid,
        actorRole: ctx.role,
        message: `Tracking admin authenticated from ${geo.city}, ${geo.country}`,
        ip: geo.ip,
        metadata: { sessionId }
      });

      return res.status(200).json({
        success: true,
        uid: ctx.uid,
        email: ctx.email,
        role: ctx.role,
        telemetryToken,
        expiresAt
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.startsWith('FORBIDDEN') ? 403 : message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}

