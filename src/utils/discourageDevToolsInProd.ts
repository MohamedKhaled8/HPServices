/**
 * في الإنتاج فقط: يقلّل فتح DevTools عبر اختصارات لوحة المفاتيح وقائمة النقر الأيمن.
 *
 * ⚠️ ليس أمانًا حقيقيًا: أي مستخدم يمكنه تعطيل JS، نسخ الرابط لمتصفح آخر، أو فتح
 * DevTools قبل تحميل الصفحة. لا يستبدل حماية الخادم أو عدم وضع أسرار في الواجهة.
 *
 * لتجاوز ذلك عند تصحيح إنتاج: VITE_ALLOW_DEVTOOLS=true في بيئة البناء (Vercel) ثم redeploy.
 */
export function initDiscourageDevToolsInProd(): void {
  if (!import.meta.env.PROD) return;
  if (import.meta.env.VITE_ALLOW_DEVTOOLS === 'true') return;

  const block = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  document.addEventListener('contextmenu', block, { capture: true });

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        return;
      }
      if (e.metaKey && e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        return;
      }
    },
    { capture: true }
  );
}
