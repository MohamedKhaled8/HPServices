import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';

export type AdminAccountRole = 'primary_admin' | 'telemetry_admin';
export type SessionStatus = 'active' | 'revoked' | 'expired';
export type TimeGranularity = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
export type LogSeverity = 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'auth' | 'session' | 'service' | 'system' | 'token' | 'security';

export interface GeoInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

export interface DeviceInfo {
  deviceName: string;
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';
  userAgent: string;
  screenResolution?: string;
}

export interface TelemetrySessionRecord {
  sessionId: string;
  uid: string;
  email: string;
  role: AdminAccountRole;
  status: SessionStatus;
  createdAtMs: number;
  createdAtIso: string;
  lastSeenAtMs: number;
  lastSeenAtIso: string;
  expiresAtMs: number;
  keepAliveCount: number;
  revokedAtMs?: number;
  revokedBy?: string;
  device: DeviceInfo;
  geo: GeoInfo;
  metadata: Record<string, string | number | boolean>;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  category: LogCategory;
  severity: LogSeverity;
  actorUid: string;
  actorRole: string;
  message: string;
  ip: string;
  timestampMs: number;
  timestampIso: string;
  latencyMs?: number;
  serviceId?: string;
  prevHash: string;
  entryHash: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface MetricEventRecord {
  id: string;
  kind: 'service_traffic' | 'service_sale' | 'token_usage' | 'system_health';
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: number;
  tokenUnits: number;
  latencyMs: number;
  statusCode: number;
  timestampMs: number;
  timestampIso: string;
  source: string;
}

const DEFAULT_RTDB_URL = 'https://hpservices-29a44-default-rtdb.firebaseio.com';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

class InMemoryTtlCache {
  private readonly store = new Map<string, CacheItem<unknown>>();
  public hits = 0;
  public misses = 0;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size > 500) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export const telemetryCache = new InMemoryTtlCache();

export function initTelemetryFirebaseAdmin(): void {
  if (getApps().length > 0) return;

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.VITE_FIREBASE_DATABASE_URL ||
    DEFAULT_RTDB_URL;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
    try {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountJson)),
        databaseURL
      });
      return;
    } catch {
      // Fall through to individual env vars
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Firebase Admin credentials missing on server');
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/gm, '\n')
    }),
    databaseURL
  });
}

export function getTelemetryDb(): Database {
  initTelemetryFirebaseAdmin();
  return getDatabase();
}

export function getHmacSecret(): string {
  if (process.env.TELEMETRY_HMAC_SECRET) {
    return process.env.TELEMETRY_HMAC_SECRET;
  }
  const seed = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_CLIENT_EMAIL || 'hp-fallback-seed';
  return crypto.createHash('sha256').update(`hp_telemetry_${seed}`).digest('hex');
}

export function applySecurityHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Telemetry-Client, X-Telemetry-Token'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function sanitizeText(value: unknown, maxLen = 240): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[<>`]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function signTelemetryToken(payload: {
  sessionId: string;
  uid: string;
  role: AdminAccountRole;
  exp: number;
}): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getHmacSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyTelemetryToken(token: string): {
  sessionId: string;
  uid: string;
  role: AdminAccountRole;
  exp: number;
} | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', getHmacSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sessionId: string;
      uid: string;
      role: AdminAccountRole;
      exp: number;
    };
    if (!decoded.exp || Date.now() > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

export interface VerifiedAdminContext {
  uid: string;
  email: string;
  role: AdminAccountRole;
  decoded: DecodedIdToken;
}

export async function verifyAdminRequest(
  req: VercelRequest,
  allowedRoles: readonly AdminAccountRole[]
): Promise<VerifiedAdminContext> {
  initTelemetryFirebaseAdmin();
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new Error('UNAUTHORIZED: Missing Bearer token');
  }

  // Enforce CSRF custom header for mutating requests
  if (req.method !== 'GET') {
    const clientHeader = req.headers['x-telemetry-client'];
    if (clientHeader !== 'hp-telemetry-v1') {
      throw new Error('FORBIDDEN: Invalid telemetry CSRF client header');
    }
  }

  // checkRevoked = true enforces immediate token invalidation upon rotation/revoke
  const decoded = await getAuth().verifyIdToken(match[1], true);
  const claims = decoded as Record<string, unknown>;
  let role: AdminAccountRole | null = null;

  if (claims.role === 'telemetry_admin' || claims.isTelemetryAdmin === true) {
    role = 'telemetry_admin';
  } else if (claims.role === 'primary_admin' || claims.isAdmin === true) {
    role = 'primary_admin';
  }

  if (!role || !allowedRoles.includes(role)) {
    throw new Error('FORBIDDEN: Insufficient role permissions');
  }

  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : '',
    role,
    decoded
  };
}

function getFirstHeader(req: VercelRequest, name: string): string {
  const val = req.headers[name];
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}

function isLoopbackOrPrivateIp(ip: string): boolean {
  return (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('::ffff:127.')
  );
}

export async function extractGeoInfo(req: VercelRequest, clientTimezone?: string): Promise<GeoInfo> {
  const forwarded = getFirstHeader(req, 'x-forwarded-for');
  const rawIp =
    forwarded.split(',')[0]?.trim() ||
    getFirstHeader(req, 'x-real-ip') ||
    getFirstHeader(req, 'cf-connecting-ip') ||
    req.socket?.remoteAddress ||
    'unknown';
  const ip = sanitizeText(rawIp.replace(/^::ffff:/, ''), 64);

  const headerCountry = sanitizeText(getFirstHeader(req, 'x-vercel-ip-country'), 64);
  const headerRegion = sanitizeText(getFirstHeader(req, 'x-vercel-ip-country-region'), 64);
  const headerCity = sanitizeText(decodeURIComponentSafe(getFirstHeader(req, 'x-vercel-ip-city')), 64);
  const latStr = getFirstHeader(req, 'x-vercel-ip-latitude');
  const lonStr = getFirstHeader(req, 'x-vercel-ip-longitude');
  const tz = sanitizeText(clientTimezone || 'Africa/Cairo', 64);

  if (headerCountry || headerCity) {
    return {
      ip,
      country: headerCountry || 'Unknown',
      region: headerRegion || '-',
      city: headerCity || 'Unknown',
      latitude: latStr ? Number(latStr) : null,
      longitude: lonStr ? Number(lonStr) : null,
      timezone: tz
    };
  }

  if (isLoopbackOrPrivateIp(ip)) {
    const localResolved = telemetryCache.get<GeoInfo>('geo:local_public');
    if (localResolved) return localResolved;

    try {
      const pubResp = await fetch('https://ipwho.is/', {
        signal: AbortSignal.timeout(1500)
      });
      if (pubResp.ok) {
        const data = (await pubResp.json()) as Record<string, unknown>;
        if (data.success !== false && typeof data.ip === 'string' && data.ip) {
          const resolved: GeoInfo = {
            ip: sanitizeText(data.ip, 64),
            country: sanitizeText(data.country || 'Local Network', 64),
            region: sanitizeText(data.region || '-', 64),
            city: sanitizeText(data.city || 'Localhost', 64),
            latitude: typeof data.latitude === 'number' ? data.latitude : null,
            longitude: typeof data.longitude === 'number' ? data.longitude : null,
            timezone: sanitizeText((data.timezone as Record<string, unknown>)?.id || tz, 64)
          };
          telemetryCache.set('geo:local_public', resolved, 60 * 60 * 1000);
          return resolved;
        }
      }
    } catch {
      // Offline fallback
    }

    return {
      ip: ip === '::1' ? '127.0.0.1' : ip,
      country: 'شبكة محلية',
      region: 'LOCAL',
      city: 'جهاز التطوير',
      latitude: null,
      longitude: null,
      timezone: tz
    };
  }

  const cachedGeo = telemetryCache.get<GeoInfo>(`geo:${ip}`);
  if (cachedGeo) return cachedGeo;

  try {
    const resp = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(1500)
    });
    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>;
      if (data.success !== false) {
        const resolved: GeoInfo = {
          ip,
          country: sanitizeText(data.country || 'Unknown', 64),
          region: sanitizeText(data.region || '-', 64),
          city: sanitizeText(data.city || 'Unknown', 64),
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          timezone: sanitizeText((data.timezone as Record<string, unknown>)?.id || tz, 64)
        };
        telemetryCache.set(`geo:${ip}`, resolved, 24 * 60 * 60 * 1000);
        return resolved;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return {
    ip,
    country: 'Unknown',
    region: '-',
    city: 'Unknown',
    latitude: null,
    longitude: null,
    timezone: tz
  };
}

function decodeURIComponentSafe(str: string): string {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function computeDeterministicAuditHash(
  prevHash: string,
  entry: {
    action: string;
    category: string;
    severity: string;
    actorUid: string;
    actorRole: string;
    message: string;
    ip: string;
    timestampMs: number;
  }
): string {
  const canonicalString = [
    prevHash,
    entry.action,
    entry.category,
    entry.severity,
    entry.actorUid,
    entry.actorRole,
    entry.message,
    entry.ip,
    String(entry.timestampMs)
  ].join('|');
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

let auditChainTail: Promise<void> = Promise.resolve();

export async function appendAuditLog(
  input: Omit<AuditLogRecord, 'id' | 'prevHash' | 'entryHash' | 'timestampMs' | 'timestampIso'> & {
    timestampMs?: number;
  }
): Promise<AuditLogRecord> {
  let resultRecord!: AuditLogRecord;
  const runStep = async () => {
    const db = getTelemetryDb();
    const timestampMs = input.timestampMs ?? Date.now();
    const timestampIso = new Date(timestampMs).toISOString();

    let prevHash = telemetryCache.get<string>('audit:lastHash');
    if (!prevHash) {
      const metaSnap = await db.ref('telemetry_v1/audit_meta/lastHash').get();
      prevHash = metaSnap.exists() ? String(metaSnap.val()) : 'GENESIS';
    }

    const canonical = {
      action: sanitizeText(input.action, 80),
      category: input.category,
      severity: input.severity,
      actorUid: sanitizeText(input.actorUid, 64),
      actorRole: sanitizeText(input.actorRole, 32),
      message: sanitizeText(input.message, 400),
      ip: sanitizeText(input.ip, 64),
      timestampMs,
      timestampIso,
      latencyMs: typeof input.latencyMs === 'number' ? input.latencyMs : undefined,
      serviceId: input.serviceId ? sanitizeText(input.serviceId, 32) : undefined,
      metadata: input.metadata
    };

    const entryHash = computeDeterministicAuditHash(prevHash, canonical);
    telemetryCache.set('audit:lastHash', entryHash, 60 * 60 * 1000);

    const logRef = db.ref('telemetry_v1/audit_logs').push();
    const fullRecord: AuditLogRecord = {
      id: logRef.key || `log_${timestampMs}`,
      ...canonical,
      prevHash,
      entryHash
    };

    await Promise.all([
      logRef.set(fullRecord),
      db.ref('telemetry_v1/audit_meta').set({ lastHash: entryHash, updatedAtMs: timestampMs })
    ]);

    telemetryCache.invalidate('query:');
    resultRecord = fullRecord;
  };

  const next = auditChainTail.then(runStep, runStep);
  auditChainTail = next.catch(() => {});
  await next;
  return resultRecord;
}

export function formatTimeBucket(timestampMs: number, granularity: TimeGranularity): string {
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());

  switch (granularity) {
    case 'second':
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    case 'minute':
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    case 'hour':
      return `${yyyy}-${mm}-${dd} ${hh}:00`;
    case 'day':
      return `${yyyy}-${mm}-${dd}`;
    case 'month':
      return `${yyyy}-${mm}`;
    case 'year':
      return `${yyyy}`;
  }
}
