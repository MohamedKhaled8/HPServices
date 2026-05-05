import { auth } from '../config/firebase';
import {
  fetchAutomationCryptoPublic,
  encryptAutomationPayloadEnvelope,
  decryptAutomationResponseEnvelope
} from './automationPayloadEncrypt';

/**
 * رؤوس الطلب لخادم الأتمتة — يضيف Firebase idToken للمشرف حتى يتحقق السيرفر من الهوية.
 */
export async function getAutomationAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      /* بدون رمز إن فشل — السيرفر بدون FIREBASE_SERVICE_ACCOUNT_JSON يتخطى التحقق */
    }
  }
  return headers;
}

/**
 * قاعدة URL لخدمة الأتمتة (Playwright).
 * - التطوير: نفس أصل Vite + proxy في vite.config → ‎/api‎ → localhost:3001
 * - الإنتاج: يجب تعيين VITE_API_URL عند البناء (مثلاً رابط Render/Railway).
 */
export function getAutomationApiBaseUrl(): string | null {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (raw && raw !== 'undefined' && raw !== 'null') {
    const normalized = normalizeAutomationApiUrl(raw);
    if (normalized) return normalized;
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return null;
}

function normalizeAutomationApiUrl(raw: string): string | null {
  let value = String(raw).trim();
  value = value.replace(/^VITE_API_URL\s*=\s*/i, '');
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value) return null;

  // دعم صيغة //host/path
  if (value.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    value = `${protocol}${value}`;
  }

  // في حال نُسخ الدومين بدون protocol نضيفه تلقائيًا.
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) {
    const lower = value.toLowerCase();
    const isLocal = lower.startsWith('localhost') || lower.startsWith('127.0.0.1');
    value = `${isLocal ? 'http' : 'https'}://${value}`;
  }

  try {
    const url = new URL(value);
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (isHttpsPage && url.protocol === 'http:' && !isLocal) {
      // تجنب mixed-content الذي يظهر كـ network error في المتصفح.
      url.protocol = 'https:';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function automationApiMissingMessage(): string {
  return 'خدمة الأتمتة غير مضبوطة للإنتاج: أضف VITE_API_URL (رابط خادم الأتمتة) في Vercel. لتوليد مفاتيح التشفير ورفعها تلقائيًا: npm run automation:setup ثم Redeploy (أو npm run automation:setup -- --deploy).';
}

/** لو نُسخ سطر .env كامل بالخطأ داخل قيمة المتغير (KEY=value) نأخذ الجزء بعد = فقط. */
function stripEnvAssignmentPrefix(raw: string, keyName: string): string {
  const s = String(raw).trim();
  const re = new RegExp(`^${keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*`, 'i');
  return s.replace(re, '');
}

/** بعض لوحات الاستضافة تلف القيمة بين quotes؛ أو مسافات/ZWSP من اللصق. */
function unwrapQuotesAndTrim(raw: string): string {
  let s = String(raw).trim().replace(/\u200b/g, '');
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** فك base64 مع معالجة مسافات ولصق URL-safe ولو بدون padding */
function decodeSpkiPemFromBase64(b64Raw: string): string | null {
  let cleaned = stripEnvAssignmentPrefix(b64Raw, 'VITE_AUTOMATION_RSA_PUBLIC_PEM_B64')
    .replace(/\s/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!cleaned) return null;
  const pad = (4 - (cleaned.length % 4)) % 4;
  if (pad) cleaned += '='.repeat(pad);
  try {
    const bin = atob(cleaned);
    if (!bin.includes('BEGIN PUBLIC KEY')) return null;
    return bin;
  } catch {
    return null;
  }
}

/** مفتاح RSA العام (SPKI PEM) من Vercel — يتجاوز طلب /api/automation-crypto-public (مفيد إن كان الطلب يُحظر أو يفشل). */
function getAutomationPublicPemFromEnv(): string | null {
  const pemRaw = (import.meta.env as { VITE_AUTOMATION_RSA_PUBLIC_PEM?: string }).VITE_AUTOMATION_RSA_PUBLIC_PEM;
  if (pemRaw && String(pemRaw).trim()) {
    const u = unwrapQuotesAndTrim(pemRaw);
    return stripEnvAssignmentPrefix(u, 'VITE_AUTOMATION_RSA_PUBLIC_PEM').replace(/\\n/g, '\n');
  }
  const b64 = (import.meta.env as { VITE_AUTOMATION_RSA_PUBLIC_PEM_B64?: string }).VITE_AUTOMATION_RSA_PUBLIC_PEM_B64;
  if (b64 !== undefined && b64 !== null && String(b64).trim() !== '') {
    const pem = decodeSpkiPemFromBase64(unwrapQuotesAndTrim(String(b64)));
    if (pem) return pem;
  }
  return null;
}

export type PreparedAutomationPostBody = {
  body: Record<string, unknown>;
  /** مفتاح AES لجلسة الطلب/الرد — يُستخدَم لفك تشفير الاستجابة عندما يعيد الخادم { encrypted: true } */
  sessionAesKey: ArrayBuffer | null;
};

/**
 * يفك JSON قادم من خادم الأتمتة إن كان مشفّرًا بمفتاح الجلسة.
 */
export async function parseAutomationApiJsonResponse<T = unknown>(
  raw: unknown,
  sessionAesKey: ArrayBuffer | null
): Promise<T> {
  if (
    sessionAesKey &&
    raw &&
    typeof raw === 'object' &&
    (raw as Record<string, unknown>).encrypted === true &&
    (raw as Record<string, unknown>).v === 1
  ) {
    const dec = await decryptAutomationResponseEnvelope(sessionAesKey, raw as Record<string, unknown>);
    return dec as T;
  }
  return raw as T;
}

/**
 * إذا خادم الأتمتة يعلن مفتاحًا عامًا (أو عرّفت VITE_AUTOMATION_RSA_PUBLIC_PEM*)، تُشفّر الحمولة.
 * في الإنتاج: لا نُرسل JSON صريحًا إذا فشل جلب المفتاح بينما السيرفر يفرض التشفير (سترى خطأ واضحًا).
 */
export async function prepareAutomationPostBody(
  apiBase: string | null,
  payload: Record<string, unknown>
): Promise<PreparedAutomationPostBody> {
  if (!apiBase) {
    return { body: payload, sessionAesKey: null };
  }

  const envPem = getAutomationPublicPemFromEnv();
  if (envPem) {
    const { envelope, sessionAesKey } = await encryptAutomationPayloadEnvelope(envPem, payload);
    return { body: envelope, sessionAesKey };
  }

  const isProd = import.meta.env.PROD;

  try {
    const cfg = await fetchAutomationCryptoPublic(apiBase);

    if (cfg.unreachable && isProd) {
      throw new Error(
        'تعذر الاتصال بـ /api/automation-crypto-public (CORS أو السيرفر أو رابط خاطئ). ' +
          'للتجاوز: في Vercel أضف VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 = المفتاح العام (سطر base64 من secrets/PASTE_... فقط). ' +
          'فعّل نفس المتغير لبيئة البناء التي تفتح منها الموقع (Production و/أو Preview) ثم أعد Deploy (المتغيرات VITE تُخبأ أثناء البناء). ' +
          'تأكد أن VITE_API_URL = رابط خادم الأتمتة. توليد ورفع: npm run automation:setup -- --deploy.'
      );
    }

    if (!cfg.enabled || !cfg.publicKeySpkiPem) {
      return { body: payload, sessionAesKey: null };
    }

    const { envelope, sessionAesKey } = await encryptAutomationPayloadEnvelope(cfg.publicKeySpkiPem, payload);
    return { body: envelope, sessionAesKey };
  } catch (e) {
    if (isProd) {
      throw e instanceof Error
        ? e
        : new Error('فشل تشفير حمولة الأتمتة. لا يُرسل الطلب نصًا صريحًا في الإنتاج.');
    }
    return { body: payload, sessionAesKey: null };
  }
}
