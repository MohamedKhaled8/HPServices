import { auth } from '../config/firebase';
import { fetchAutomationCryptoPublic, encryptAutomationPayloadEnvelope } from './automationPayloadEncrypt';

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
    return raw.replace(/\/$/, '');
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return null;
}

export function automationApiMissingMessage(): string {
  return 'خدمة الأتمتة غير مضبوطة للإنتاج: أضف المتغير VITE_API_URL في لوحة الاستضافة (مثل Vercel) بقيمة رابط السيرفر الكامل (مثلاً https://your-api.onrender.com) ثم أعد بناء الموقع.';
}

/** مفتاح RSA العام (SPKI PEM) من Vercel — يتجاوز طلب /api/automation-crypto-public (مفيد إن كان الطلب يُحظر أو يفشل). */
function getAutomationPublicPemFromEnv(): string | null {
  const pemRaw = (import.meta.env as { VITE_AUTOMATION_RSA_PUBLIC_PEM?: string }).VITE_AUTOMATION_RSA_PUBLIC_PEM;
  if (pemRaw && String(pemRaw).trim()) {
    return String(pemRaw).trim().replace(/\\n/g, '\n');
  }
  const b64 = (import.meta.env as { VITE_AUTOMATION_RSA_PUBLIC_PEM_B64?: string }).VITE_AUTOMATION_RSA_PUBLIC_PEM_B64;
  if (b64 && String(b64).trim()) {
    try {
      const bin = atob(String(b64).trim().replace(/\s/g, ''));
      return bin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * إذا خادم الأتمتة يعلن مفتاحًا عامًا (أو عرّفت VITE_AUTOMATION_RSA_PUBLIC_PEM*)، تُشفّر الحمولة.
 * في الإنتاج: لا نُرسل JSON صريحًا إذا فشل جلب المفتاح بينما السيرفر يفرض التشفير (سترى خطأ واضحًا).
 */
export async function prepareAutomationPostBody(
  apiBase: string | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!apiBase) return payload;

  const envPem = getAutomationPublicPemFromEnv();
  if (envPem) {
    return encryptAutomationPayloadEnvelope(envPem, payload);
  }

  const isProd = import.meta.env.PROD;

  try {
    const cfg = await fetchAutomationCryptoPublic(apiBase);

    if (cfg.unreachable && isProd) {
      throw new Error(
        'تعذر الاتصال بـ /api/automation-crypto-public (تحقق من CORS أو نشر السيرفر). ' +
          'أضف في Vercel المتغير VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 (المفتاح العام base64 من سكربت التوليد) لتجاوز هذا الطلب، أو أصلح الرابط.'
      );
    }

    if (!cfg.enabled || !cfg.publicKeySpkiPem) {
      return payload;
    }

    return await encryptAutomationPayloadEnvelope(cfg.publicKeySpkiPem, payload);
  } catch (e) {
    if (isProd) {
      throw e instanceof Error
        ? e
        : new Error('فشل تشفير حمولة الأتمتة. لا يُرسل الطلب نصًا صريحًا في الإنتاج.');
    }
    return payload;
  }
}
