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

/**
 * إذا خادم الأتمتة يعلن مفتاحًا عامًا، تُشفّر الحمولة (لا تظهر بيانات الطالب صريحة في Network).
 */
export async function prepareAutomationPostBody(
  apiBase: string | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!apiBase) return payload;
  try {
    const cfg = await fetchAutomationCryptoPublic(apiBase);
    if (!cfg.enabled || !cfg.publicKeySpkiPem) return payload;
    return encryptAutomationPayloadEnvelope(cfg.publicKeySpkiPem, payload);
  } catch {
    return payload;
  }
}
