# إعداد Cloudinary

## خطوات الإعداد المطلوبة:

### 1. إنشاء Unsigned Upload Preset في Cloudinary Dashboard:

1. اذهب إلى [Cloudinary Dashboard](https://console.cloudinary.com/)
2. اختر Settings > Upload
3. انتقل إلى Upload presets
4. أنشئ preset جديد باسم `unsigned`
5. في الإعدادات:
   - **Signing mode**: اختر `Unsigned`
   - **Folder**: `serviceRequests` (اختياري)
   - **Allowed formats**: اختر الصيغ المطلوبة (JPEG, PNG, PDF)
   - **Max file size**: 10 MB (أو حسب الحاجة)

### 2. استخدام Preset:

بعد إنشاء الـ preset، سيتم استخدامه تلقائياً في الكود.

**ملاحظة أمنية:**
- Unsigned preset آمن للاستخدام من العميل لأنه لا يتطلب API secret
- لا تضع API secret في كود العميل (client-side)

### 3. اختبار الرفع:

بعد إنشاء الـ preset، جرب رفع ملف من التطبيق للتأكد من أن كل شيء يعمل.

