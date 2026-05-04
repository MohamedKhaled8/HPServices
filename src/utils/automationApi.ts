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
