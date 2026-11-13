const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_RTDB_URL = 'https://hpservices-29a44-default-rtdb.firebaseio.com';
const LOG_DIR = path.join(__dirname, 'telemetry_logs');
const SESSION_TTL_MS = 30 * 60 * 1000;
const HEARTBEAT_WRITE_THROTTLE_MS = 20 * 1000;
const VALID_GRANULARITIES = new Set(['second', 'minute', 'hour', 'day', 'month', 'year']);

class InMemoryTtlCache {
    constructor() {
        this.store = new Map();
        this.hits = 0;
        this.misses = 0;
    }
    get(key) {
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
        return entry.value;
    }
    set(key, value, ttlMs) {
        if (this.store.size > 500) {
            const oldestKey = this.store.keys().next().value;
            if (oldestKey) this.store.delete(oldestKey);
        }
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    invalidate(prefix) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
    }
}

const cache = new InMemoryTtlCache();
const ipRateStore = new Map();
const memoryRingLogs = [];
const memoryRingMetrics = [];
const memorySessions = new Map();

function pushRing(arr, item, max = 2000) {
    arr.push(item);
    if (arr.length > max) arr.shift();
}

function appendNdjson(prefix, record) {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        const day = new Date(record.timestampMs || Date.now()).toISOString().slice(0, 10);
        const filePath = path.join(LOG_DIR, `${prefix}-${day}.ndjson`);
        fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8', () => {});
    } catch {
        // Non-blocking append
    }
}

function loadLocalEnvFallback() {
    const rootEnvLocal = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(rootEnvLocal) && !process.env.FIREBASE_PRIVATE_KEY) {
        try {
            require('dotenv').config({ path: rootEnvLocal });
        } catch {
            // Optional in standalone backend_service container
        }
    }
}

function getTelemetryApp() {
    loadLocalEnvFallback();
    const existing = admin.apps.find((a) => a && a.name === 'telemetry_isolated_app');
    if (existing) return existing;

    const databaseURL =
        process.env.FIREBASE_DATABASE_URL ||
        process.env.VITE_FIREBASE_DATABASE_URL ||
        DEFAULT_RTDB_URL;

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saJson && String(saJson).trim().startsWith('{')) {
        try {
            return admin.initializeApp(
                {
                    credential: admin.credential.cert(JSON.parse(saJson)),
                    databaseURL
                },
                'telemetry_isolated_app'
            );
        } catch {
            // Fall through to individual env vars if JSON contains unescaped characters
        }
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
        return admin.initializeApp(
            {
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: privateKey.replace(/\\n/gm, '\n')
                }),
                databaseURL
            },
            'telemetry_isolated_app'
        );
    }
    return null;
}

function getRtdbSafe() {
    const app = getTelemetryApp();
    return app ? admin.database(app) : null;
}

function getAuthSafe() {
    const app = getTelemetryApp();
    return app ? admin.auth(app) : null;
}

function getHmacSecret() {
    if (process.env.TELEMETRY_HMAC_SECRET) return process.env.TELEMETRY_HMAC_SECRET;
    const seed = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_CLIENT_EMAIL || 'hp-fallback-seed';
    return crypto.createHash('sha256').update(`hp_telemetry_${seed}`).digest('hex');
}

function sanitizeText(value, maxLen = 240) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/[<>`]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .trim()
        .slice(0, maxLen);
}

function signTelemetryToken(payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', getHmacSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

function verifyTelemetryToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = crypto.createHmac('sha256', getHmacSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!decoded.exp || Date.now() > decoded.exp) return null;
        return decoded;
    } catch {
        return null;
    }
}

async function verifyAdminRequest(req, allowedRoles) {
    const auth = getAuthSafe();
    if (!auth) throw new Error('UNAUTHORIZED: Telemetry auth provider not configured');

    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) throw new Error('UNAUTHORIZED: Missing Bearer token');

    if (req.method !== 'GET' && req.headers['x-telemetry-client'] !== 'hp-telemetry-v1') {
        throw new Error('FORBIDDEN: Invalid telemetry CSRF client header');
    }

    const decoded = await auth.verifyIdToken(match[1], true);
    let role = null;
    if (decoded.role === 'telemetry_admin' || decoded.isTelemetryAdmin === true) {
        role = 'telemetry_admin';
    } else if (decoded.role === 'primary_admin' || decoded.isAdmin === true) {
        role = 'primary_admin';
    }

    if (!role || !allowedRoles.includes(role)) {
        throw new Error('FORBIDDEN: Insufficient role permissions');
    }

    return { uid: decoded.uid, email: decoded.email || '', role, decoded };
}

function getHeader(req, name) {
    const val = req.headers[name];
    return Array.isArray(val) ? val[0] || '' : val || '';
}

async function extractGeoInfo(req, clientTimezone) {
    const forwarded = getHeader(req, 'x-forwarded-for');
    const rawIp =
        forwarded.split(',')[0]?.trim() ||
        getHeader(req, 'x-real-ip') ||
        getHeader(req, 'cf-connecting-ip') ||
        req.socket?.remoteAddress ||
        'unknown';
    const ip = sanitizeText(rawIp.replace(/^::ffff:/, ''), 64);
    const tz = sanitizeText(clientTimezone || 'Africa/Cairo', 64);

    if (
        !ip ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('172.16.')
    ) {
        const cachedLocal = cache.get('geo:local_public');
        if (cachedLocal) return cachedLocal;

        try {
            const pubResp = await fetch('https://ipwho.is/', {
                signal: AbortSignal.timeout(1500)
            });
            if (pubResp.ok) {
                const data = await pubResp.json();
                if (data.success !== false && data.ip) {
                    const resolved = {
                        ip: sanitizeText(data.ip, 64),
                        country: sanitizeText(data.country || 'Local Network', 64),
                        region: sanitizeText(data.region || '-', 64),
                        city: sanitizeText(data.city || 'Localhost', 64),
                        latitude: typeof data.latitude === 'number' ? data.latitude : null,
                        longitude: typeof data.longitude === 'number' ? data.longitude : null,
                        timezone: sanitizeText((data.timezone && data.timezone.id) || tz, 64)
                    };
                    cache.set('geo:local_public', resolved, 60 * 60 * 1000);
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

    const cachedGeo = cache.get(`geo:${ip}`);
    if (cachedGeo) return cachedGeo;

    try {
        const resp = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
            signal: AbortSignal.timeout(1500)
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.success !== false) {
                const resolved = {
                    ip,
                    country: sanitizeText(data.country || 'Unknown', 64),
                    region: sanitizeText(data.region || '-', 64),
                    city: sanitizeText(data.city || 'Unknown', 64),
                    latitude: typeof data.latitude === 'number' ? data.latitude : null,
                    longitude: typeof data.longitude === 'number' ? data.longitude : null,
                    timezone: sanitizeText((data.timezone && data.timezone.id) || tz, 64)
                };
                cache.set(`geo:${ip}`, resolved, 24 * 60 * 60 * 1000);
                return resolved;
            }
        }
    } catch {
        // Non-blocking fallback
    }

    return { ip, country: 'Unknown', region: '-', city: 'Unknown', latitude: null, longitude: null, timezone: tz };
}

function computeDeterministicAuditHash(prevHash, entry) {
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

let auditChainTail = Promise.resolve();

async function appendAuditLog(input) {
    let resultRecord = null;
    const runStep = async () => {
        const rtdb = getRtdbSafe();
        const timestampMs = input.timestampMs || Date.now();
        const timestampIso = new Date(timestampMs).toISOString();

        let prevHash = cache.get('audit:lastHash');
        if (!prevHash && rtdb) {
            const metaSnap = await rtdb.ref('telemetry_v1/audit_meta/lastHash').get();
            prevHash = metaSnap.exists() ? String(metaSnap.val()) : 'GENESIS';
        }
        if (!prevHash) prevHash = 'GENESIS';

        const canonical = {
            action: sanitizeText(input.action, 80),
            category: input.category || 'system',
            severity: input.severity || 'info',
            actorUid: sanitizeText(input.actorUid || 'system', 64),
            actorRole: sanitizeText(input.actorRole || 'system', 32),
            message: sanitizeText(input.message, 400),
            ip: sanitizeText(input.ip || 'unknown', 64),
            timestampMs,
            timestampIso,
            ...(typeof input.latencyMs === 'number' ? { latencyMs: input.latencyMs } : {}),
            ...(input.serviceId ? { serviceId: sanitizeText(input.serviceId, 32) } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {})
        };

        const entryHash = computeDeterministicAuditHash(prevHash, canonical);
        cache.set('audit:lastHash', entryHash, 60 * 60 * 1000);

        const id = `log_${timestampMs}_${crypto.randomBytes(3).toString('hex')}`;
        const fullRecord = { id, ...canonical, prevHash, entryHash };

        if (rtdb) {
            const logRef = rtdb.ref('telemetry_v1/audit_logs').push();
            fullRecord.id = logRef.key || id;
            await Promise.all([
                logRef.set(fullRecord),
                rtdb.ref('telemetry_v1/audit_meta').set({ lastHash: entryHash, updatedAtMs: timestampMs })
            ]);
        }

        cache.invalidate('query:');
        pushRing(memoryRingLogs, fullRecord);
        appendNdjson('audit', fullRecord);
        resultRecord = fullRecord;
    };

    const next = auditChainTail.then(runStep, runStep);
    auditChainTail = next.catch(() => {});
    await next;
    return resultRecord;
}

function formatTimeBucket(timestampMs, granularity) {
    const d = new Date(timestampMs);
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    switch (granularity) {
        case 'second': return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
        case 'minute': return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
        case 'hour': return `${yyyy}-${mm}-${dd} ${hh}:00`;
        case 'day': return `${yyyy}-${mm}-${dd}`;
        case 'month': return `${yyyy}-${mm}`;
        case 'year': return `${yyyy}`;
        default: return `${yyyy}-${mm}-${dd} ${hh}:00`;
    }
}

function clampFinite(val, fallback = 0, max = 1_000_000_000) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(n, max);
}

function checkIpIngestRate(ip) {
    const now = Date.now();
    const entry = ipRateStore.get(ip);
    if (!entry || now > entry.resetAt) {
        ipRateStore.set(ip, { count: 1, resetAt: now + 60_000 });
        return true;
    }
    if (entry.count >= 120) return false;
    entry.count += 1;
    return true;
}

function verifyAuditChainIntegrity(logsAsc) {
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

function registerTelemetryMiddlewareAndRoutes(app) {
    // 1. Lightweight non-blocking API performance & token capture middleware
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/telemetry') || req.path === '/' || req.path === '/api/automation-health') {
            return next();
        }
        const startNs = process.hrtime.bigint();
        res.on('finish', () => {
            const latencyMs = Math.round(Number(process.hrtime.bigint() - startNs) / 1_000_000);
            const isOcr = req.path.includes('extract-data');
            const isAutomation = req.path.includes('automation');
            const isWhatsapp = req.path.includes('whatsapp');
            const serviceId = isOcr ? 'ocr' : isAutomation ? 'automation' : isWhatsapp ? 'whatsapp' : 'api';
            const serviceName = isOcr
                ? 'استخراج المستندات (OCR)'
                : isAutomation
                  ? 'أتمتة التحول الرقمي والدفع'
                  : isWhatsapp
                    ? 'بوابة إشعارات الواتساب'
                    : 'خادم الـ API';
            const tokenUnits = isOcr ? 120 : isAutomation ? 85 : isWhatsapp ? 25 : 5;
            const now = Date.now();
            const metric = {
                id: `srv_${now}_${crypto.randomBytes(3).toString('hex')}`,
                kind: 'token_usage',
                serviceId,
                serviceName,
                count: 1,
                revenue: 0,
                tokenUnits,
                latencyMs,
                statusCode: res.statusCode,
                timestampMs: now,
                timestampIso: new Date(now).toISOString(),
                source: 'express_backend'
            };
            pushRing(memoryRingMetrics, metric);
            appendNdjson('metrics', metric);
            const rtdb = getRtdbSafe();
            if (rtdb) {
                rtdb.ref('telemetry_v1/metrics').push(metric).catch(() => {});
            }
        });
        return next();
    });

    app.all('/api/telemetry/auth', handleAuthRoute);
    app.all('/api/telemetry/session', handleSessionRoute);
    app.post('/api/telemetry/ingest', handleIngestRoute);
    app.get('/api/telemetry/query', handleQueryRoute);
}

async function handleAuthRoute(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        try {
            if (req.method === 'GET') {
                const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
                const tokenHeader = getHeader(req, 'x-telemetry-token');
                const tokenPayload = tokenHeader ? verifyTelemetryToken(tokenHeader) : null;
                return res.json({
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
                } catch (err) {
                    await appendAuditLog({
                        action: 'TELEMETRY_LOGIN_DENIED',
                        category: 'security',
                        severity: 'warn',
                        actorUid: 'anonymous',
                        actorRole: 'unknown',
                        message: `Denied telemetry portal access attempt: ${err.message}`,
                        ip: geo.ip
                    }).catch(() => {});
                    return res.status(err.message.startsWith('FORBIDDEN') ? 403 : 401).json({ success: false, error: err.message });
                }

                const sessionId = sanitizeText(req.body?.sessionId, 64) || `tsec_${Date.now()}_${ctx.uid.slice(0, 6)}`;
                const expiresAt = Date.now() + SESSION_TTL_MS;
                const telemetryToken = signTelemetryToken({ sessionId, uid: ctx.uid, role: ctx.role, exp: expiresAt });

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

                return res.json({
                    success: true,
                    uid: ctx.uid,
                    email: ctx.email,
                    role: ctx.role,
                    telemetryToken,
                    expiresAt
                });
            }

            return res.status(405).json({ success: false, error: 'Method not allowed' });
        } catch (err) {
            const msg = err.message || 'Internal error';
            return res.status(msg.startsWith('FORBIDDEN') ? 403 : msg.startsWith('UNAUTHORIZED') ? 401 : 500).json({ success: false, error: msg });
        }
}

async function handleSessionRoute(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        try {
            const rtdb = getRtdbSafe();

            if (req.method === 'GET') {
                await verifyAdminRequest(req, ['telemetry_admin']);
                const cached = cache.get('sessions:list');
                if (cached) return res.json({ success: true, sessions: cached, cached: true });

                const now = Date.now();
                const sessions = [];
                if (rtdb) {
                    const snap = await rtdb.ref('telemetry_v1/sessions').get();
                    if (snap.exists()) {
                        for (const item of Object.values(snap.val())) {
                            if (!item || !item.sessionId) continue;
                            sessions.push({
                                ...item,
                                status: item.status === 'active' && now > item.expiresAtMs ? 'expired' : item.status
                            });
                        }
                    }
                } else {
                    for (const item of memorySessions.values()) {
                        sessions.push({
                            ...item,
                            status: item.status === 'active' && now > item.expiresAtMs ? 'expired' : item.status
                        });
                    }
                }
                sessions.sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);
                cache.set('sessions:list', sessions, 4000);
                return res.json({ success: true, sessions, cached: false });
            }

            if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

            const action = sanitizeText(req.body?.action, 32);
            const uaHeader = getHeader(req, 'user-agent');

            if (action === 'register') {
                const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
                const now = Date.now();
                const nowIso = new Date(now).toISOString();
                const sessionId = sanitizeText(req.body?.sessionId, 64) || `sess_${now}_${crypto.randomBytes(6).toString('hex')}`;
                const devIn = req.body?.device || {};
                const deviceTypeRaw = sanitizeText(devIn.deviceType, 16);
                const device = {
                    deviceName: sanitizeText(devIn.deviceName || 'Unknown Device', 80),
                    os: sanitizeText(devIn.os || 'Unknown OS', 48),
                    browser: sanitizeText(devIn.browser || 'Unknown Browser', 48),
                    deviceType: ['Desktop', 'Mobile', 'Tablet'].includes(deviceTypeRaw) ? deviceTypeRaw : 'Unknown',
                    userAgent: sanitizeText(devIn.userAgent || uaHeader, 240),
                    screenResolution: sanitizeText(devIn.screenResolution || '', 32)
                };
                const geo = await extractGeoInfo(req, sanitizeText(req.body?.timezone, 64));
                const record = {
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
                    metadata: { portal: ctx.role === 'telemetry_admin' ? '/telemetry' : '/admin', authMethod: 'firebase_id_token' }
                };
                memorySessions.set(sessionId, record);
                if (rtdb) await rtdb.ref(`telemetry_v1/sessions/${sessionId}`).set(record);
                cache.invalidate('sessions:');
                cache.set(`session:${sessionId}`, record, 5000);
                appendNdjson('sessions', record);

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
                return res.json({ success: true, session: record });
            }

            if (action === 'heartbeat') {
                const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
                const sessionId = sanitizeText(req.body?.sessionId, 64);
                if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' });

                let record = cache.get(`session:${sessionId}`) || memorySessions.get(sessionId);
                if (!record && rtdb) {
                    const snap = await rtdb.ref(`telemetry_v1/sessions/${sessionId}`).get();
                    record = snap.exists() ? snap.val() : null;
                }
                if (!record) return res.json({ success: true, status: 'expired', shouldLogout: false });
                if (record.uid !== ctx.uid && ctx.role !== 'telemetry_admin') {
                    return res.status(403).json({ success: false, error: 'Session ownership mismatch' });
                }
                if (record.status === 'revoked') {
                    return res.json({ success: true, status: 'revoked', shouldLogout: true, revokedAtMs: record.revokedAtMs });
                }
                const now = Date.now();
                if (now > record.expiresAtMs) {
                    return res.json({ success: true, status: 'expired', shouldLogout: true });
                }
                if (now - record.lastSeenAtMs > HEARTBEAT_WRITE_THROTTLE_MS) {
                    const nowIso = new Date(now).toISOString();
                    record = { ...record, lastSeenAtMs: now, lastSeenAtIso: nowIso };
                    memorySessions.set(sessionId, record);
                    if (rtdb) await rtdb.ref(`telemetry_v1/sessions/${sessionId}`).update({ lastSeenAtMs: now, lastSeenAtIso: nowIso });
                    cache.set(`session:${sessionId}`, record, 5000);
                    cache.invalidate('sessions:');
                }
                return res.json({ success: true, status: 'active', shouldLogout: false, expiresAtMs: record.expiresAtMs });
            }

            if (action === 'keep_alive') {
                const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
                const targetSessionId = sanitizeText(req.body?.targetSessionId, 64);
                if (!targetSessionId) return res.status(400).json({ success: false, error: 'Missing targetSessionId' });

                let existing = memorySessions.get(targetSessionId);
                if (rtdb) {
                    const snap = await rtdb.ref(`telemetry_v1/sessions/${targetSessionId}`).get();
                    if (snap.exists()) existing = snap.val();
                }
                if (!existing) return res.status(404).json({ success: false, error: 'Session not found' });

                const now = Date.now();
                const updated = {
                    ...existing,
                    status: 'active',
                    expiresAtMs: now + SESSION_TTL_MS,
                    lastSeenAtMs: now,
                    lastSeenAtIso: new Date(now).toISOString(),
                    keepAliveCount: (existing.keepAliveCount || 0) + 1
                };
                memorySessions.set(targetSessionId, updated);
                if (rtdb) await rtdb.ref(`telemetry_v1/sessions/${targetSessionId}`).set(updated);
                cache.set(`session:${targetSessionId}`, updated, 5000);
                cache.invalidate('sessions:');

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
                return res.json({ success: true, session: updated });
            }

            if (action === 'revoke') {
                const ctx = await verifyAdminRequest(req, ['telemetry_admin']);
                const targetSessionId = sanitizeText(req.body?.targetSessionId, 64);
                const revokeAllTokens = Boolean(req.body?.revokeAllTokens);
                if (!targetSessionId) return res.status(400).json({ success: false, error: 'Missing targetSessionId' });

                let existing = memorySessions.get(targetSessionId);
                if (rtdb) {
                    const snap = await rtdb.ref(`telemetry_v1/sessions/${targetSessionId}`).get();
                    if (snap.exists()) existing = snap.val();
                }
                if (!existing) return res.status(404).json({ success: false, error: 'Session not found' });

                const now = Date.now();
                const updated = { ...existing, status: 'revoked', revokedAtMs: now, revokedBy: ctx.uid };
                memorySessions.set(targetSessionId, updated);
                if (rtdb) await rtdb.ref(`telemetry_v1/sessions/${targetSessionId}`).set(updated);
                cache.set(`session:${targetSessionId}`, updated, 5000);
                cache.invalidate('sessions:');

                if (revokeAllTokens && existing.uid) {
                    const auth = getAuthSafe();
                    if (auth) await auth.revokeRefreshTokens(existing.uid);
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
                return res.json({ success: true, session: updated });
            }

            if (action === 'logout') {
                const ctx = await verifyAdminRequest(req, ['primary_admin', 'telemetry_admin']);
                const sessionId = sanitizeText(req.body?.sessionId, 64);
                if (sessionId) {
                    const now = Date.now();
                    const prev = memorySessions.get(sessionId);
                    if (prev) memorySessions.set(sessionId, { ...prev, status: 'expired', lastSeenAtMs: now });
                    if (rtdb) {
                        await rtdb.ref(`telemetry_v1/sessions/${sessionId}`).update({
                            status: 'expired',
                            lastSeenAtMs: now,
                            lastSeenAtIso: new Date(now).toISOString()
                        });
                    }
                    cache.invalidate('sessions:');
                    cache.invalidate(`session:${sessionId}`);
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
                return res.json({ success: true });
            }

            return res.status(400).json({ success: false, error: 'Invalid session action' });
        } catch (err) {
            const msg = err.message || 'Internal error';
            return res.status(msg.startsWith('FORBIDDEN') ? 403 : msg.startsWith('UNAUTHORIZED') ? 401 : 500).json({ success: false, error: msg });
        }
}

async function handleIngestRoute(req, res) {
        if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
        try {
            if (req.headers['x-telemetry-client'] !== 'hp-telemetry-v1') {
                return res.status(403).json({ success: false, error: 'Missing telemetry client header' });
            }
            const geo = await extractGeoInfo(req);
            if (!checkIpIngestRate(geo.ip)) {
                return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            }

            const rtdb = getRtdbSafe();
            const action = sanitizeText(req.body?.action, 32) || 'event';

            if (action === 'seed_from_backup') {
                const ctx = await verifyAdminRequest(req, ['telemetry_admin', 'primary_admin']);
                const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
                if (items.length === 0) return res.status(400).json({ success: false, error: 'No backup metric items supplied' });

                const updates = {};
                for (let i = 0; i < items.length; i++) {
                    const raw = items[i];
                    const tsMs = clampFinite(raw.timestampMs, Date.now());
                    const key = `seed_${tsMs}_${i}_${crypto.randomBytes(2).toString('hex')}`;
                    const record = {
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
                    updates[key] = record;
                    pushRing(memoryRingMetrics, record);
                    appendNdjson('metrics', record);
                }
                if (rtdb) await rtdb.ref('telemetry_v1/metrics').update(updates);
                cache.invalidate('query:');

                await appendAuditLog({
                    action: 'TELEMETRY_BACKUP_SEEDED',
                    category: 'system',
                    severity: 'info',
                    actorUid: ctx.uid,
                    actorRole: ctx.role,
                    message: `Imported ${items.length} historical service metrics from Supabase backup (0 Firestore reads)`,
                    ip: geo.ip
                });
                return res.json({ success: true, importedCount: items.length });
            }

            const kindRaw = sanitizeText(req.body?.kind, 32);
            const kind = ['service_sale', 'token_usage', 'system_health'].includes(kindRaw) ? kindRaw : 'service_traffic';
            const now = Date.now();
            const record = {
                id: `m_${now}_${crypto.randomBytes(3).toString('hex')}`,
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

            pushRing(memoryRingMetrics, record);
            appendNdjson('metrics', record);
            if (rtdb) {
                const ref = rtdb.ref('telemetry_v1/metrics').push();
                record.id = ref.key || record.id;
                await ref.set(record);
            }
            cache.invalidate('query:');

            if (req.body?.logMessage) {
                const catRaw = sanitizeText(req.body?.category, 16);
                const sevRaw = sanitizeText(req.body?.severity, 16);
                await appendAuditLog({
                    action: sanitizeText(req.body?.actionName || kind.toUpperCase(), 64),
                    category: ['auth', 'session', 'service', 'token', 'security'].includes(catRaw) ? catRaw : 'system',
                    severity: ['warn', 'error', 'critical'].includes(sevRaw) ? sevRaw : 'info',
                    actorUid: sanitizeText(req.body?.actorUid || 'client', 64),
                    actorRole: sanitizeText(req.body?.actorRole || 'student', 32),
                    message: sanitizeText(req.body?.logMessage, 320),
                    ip: geo.ip,
                    latencyMs: record.latencyMs,
                    serviceId: record.serviceId
                });
            }

            return res.json({ success: true, id: record.id });
        } catch (err) {
            const msg = err.message || 'Internal error';
            return res.status(msg.startsWith('FORBIDDEN') ? 403 : msg.startsWith('UNAUTHORIZED') ? 401 : 500).json({ success: false, error: msg });
        }
}

async function handleQueryRoute(req, res) {
        if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
        res.setHeader('Cache-Control', 'no-store');
        try {
            await verifyAdminRequest(req, ['telemetry_admin']);
            const granRaw = sanitizeText(req.query.granularity, 16);
            const granularity = VALID_GRANULARITIES.has(granRaw) ? granRaw : 'hour';
            const fromMs = req.query.fromMs ? Number(req.query.fromMs) : 0;
            const toMs = req.query.toMs ? Number(req.query.toMs) : Date.now() + 60_000;
            const severityFilter = sanitizeText(req.query.severity, 16);
            const categoryFilter = sanitizeText(req.query.category, 16);
            const searchFilter = sanitizeText(req.query.search, 100).toLowerCase();

            const cacheKey = `query:${granularity}:${fromMs}:${toMs}:${severityFilter}:${categoryFilter}:${searchFilter}`;
            const cached = cache.get(cacheKey);
            if (cached) return res.json({ ...cached, cached: true });

            const rtdb = getRtdbSafe();
            let allMetrics = [...memoryRingMetrics];
            let allLogsRaw = [...memoryRingLogs];
            let allSessionsRaw = Array.from(memorySessions.values());

            if (rtdb) {
                const [mSnap, lSnap, sSnap] = await Promise.all([
                    rtdb.ref('telemetry_v1/metrics').limitToLast(500).get(),
                    rtdb.ref('telemetry_v1/audit_logs').limitToLast(400).get(),
                    rtdb.ref('telemetry_v1/sessions').get()
                ]);
                allMetrics = mSnap.exists() ? Object.values(mSnap.val()) : allMetrics;
                allLogsRaw = lSnap.exists()
                    ? Object.entries(lSnap.val()).map(([id, item]) => ({ ...item, id: item.id || id }))
                    : allLogsRaw;
                allSessionsRaw = sSnap.exists() ? Object.values(sSnap.val()) : allSessionsRaw;
            }

            const now = Date.now();
            const sessions = allSessionsRaw
                .map((s) => ({ ...s, status: s.status === 'active' && now > s.expiresAtMs ? 'expired' : s.status }))
                .sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);

            const inWindowMetrics = allMetrics.filter((m) => m && m.timestampMs >= fromMs && m.timestampMs <= toMs);
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

            const serviceAggMap = new Map();
            const bucketsMap = new Map();
            const latencies = [];
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
                const b = bucketsMap.get(bKey) || { bucket: bKey, traffic: 0, sales: 0, revenue: 0, tokens: 0, logs: 0 };
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
                const b = bucketsMap.get(bKey) || { bucket: bKey, traffic: 0, sales: 0, revenue: 0, tokens: 0, logs: 0 };
                b.logs += 1;
                bucketsMap.set(bKey, b);
            }

            const servicesList = Array.from(serviceAggMap.values());
            const topSelling = [...servicesList].sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount).slice(0, 12);
            const highestTraffic = [...servicesList].sort((a, b) => b.trafficCount - a.trafficCount).slice(0, 12);
            const tokenLeaderboard = [...servicesList].sort((a, b) => b.tokenUnits - a.tokenUnits).slice(0, 12);
            const timeSeries = Array.from(bucketsMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-60);

            latencies.sort((a, b) => a - b);
            const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length) : 0;
            const p95LatencyMs = latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : 0;
            const totalCacheLookups = cache.hits + cache.misses;
            const cacheHitRatio = totalCacheLookups > 0 ? Math.round((cache.hits / totalCacheLookups) * 100) : 100;

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
                    errorRatePercent: inWindowMetrics.length > 0 ? Number(((totalErrors / inWindowMetrics.length) * 100).toFixed(2)) : 0,
                    cacheHitRatio,
                    firestoreReadsUsed: 0,
                    storageEngine: rtdb ? 'Firebase RTDB + Append-Only NDJSON + In-Memory Cache' : 'Append-Only NDJSON + In-Memory Cache',
                    chainIntegrity
                },
                topSelling,
                highestTraffic,
                tokenLeaderboard,
                timeSeries,
                sessions,
                logs: filteredLogs.slice(0, 500)
            };

            cache.set(cacheKey, payload, 3000);
            return res.json({ ...payload, cached: false });
        } catch (err) {
            const msg = err.message || 'Internal error';
            return res.status(msg.startsWith('FORBIDDEN') ? 403 : msg.startsWith('UNAUTHORIZED') ? 401 : 500).json({ success: false, error: msg });
        }
}

function createViteTelemetryMiddleware() {
    return async (req, res, next) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith('/api/telemetry')) {
            return next();
        }

        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', getHeader(req, 'origin') || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telemetry-Client, X-Telemetry-Token');

        if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
        }

        const parsedUrl = new URL(rawUrl, 'http://localhost');
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());

        if (req.method === 'POST' && req.body === undefined) {
            req.body = await new Promise((resolve) => {
                let raw = '';
                req.on('data', (chunk) => { raw += chunk; });
                req.on('end', () => {
                    try {
                        resolve(raw ? JSON.parse(raw) : {});
                    } catch {
                        resolve({});
                    }
                });
                req.on('error', () => resolve({}));
            });
        }

        const resShim = {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => {
                res.statusCode = code;
                return resShim;
            },
            json: (data) => {
                if (!res.getHeader('Content-Type')) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                }
                res.end(JSON.stringify(data));
            }
        };

        const p = parsedUrl.pathname;
        if (p === '/api/telemetry/auth') return handleAuthRoute(req, resShim);
        if (p === '/api/telemetry/session') return handleSessionRoute(req, resShim);
        if (p === '/api/telemetry/ingest') return handleIngestRoute(req, resShim);
        if (p === '/api/telemetry/query') return handleQueryRoute(req, resShim);
        return next();
    };
}

module.exports = { registerTelemetryMiddlewareAndRoutes, createViteTelemetryMiddleware };
