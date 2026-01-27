# دليل نشر تطبيق AI Automation Service (Production Deployment Guide)

بما أن مشروعك يحتوي على **Frontend (React)** و **Backend (AI Automation Service with Playwright)**، فإن عملية النشر تتطلب خطوات خاصة لأن خدمة الأتمتة تحتاج إلى متصفح (Chromium) لكي تعمل.

إليك أفضل استراتيجية لدمج ورفع السيرفر في مرحلة الـ Production:

## 1. استراتيجية الاستضافة (Architecture)

يفضل فصل التطبيق إلى جزأين لسهولة الإدارة وتجنب المشاكل التقنية:

1.  **الواجهة الأمامية (Frontend):** يتم رفعها على استضافة ملفات ثابتة مثل **Vercel** أو **Netlify**.
2.  **الخادم الخلفي (Backend Service):** يتم رفعه على استضافة تدعم Node.js و Docker/Buildpacks مثل **Render** أو **Railway**، لأننا نحتاج لتثبيت بكتجات المتصفح (Playwright Browsers).

---

## 2. خطوات تجهيز الكود (Frontend Prepare)

قبل الرفع، يجب جعل كود الـ React يتصل بالسيرفر الحي بدلاً من `localhost`.

### أ. استخدام متغيرات البيئة (Environment Variables)
لقد قمت بتحديث صفحة `AdminDashboardPage.tsx` لتقرأ رابط السيرفر من متغير بيئي اسمه `VITE_API_URL`.

### ب. إعداد ملف `.env` في الإنتاج
عند رفع ال Frontend على Vercel/Netlify، ستضيف متغير بيئي في لوحة التحكم (Settings > Environment Variables):
*   **Key:** `VITE_API_URL`
*   **Value:** `https://your-backend-service-name.onrender.com` (رابط السيرفر بعد الرفع)

---

## 3. خطوات رفع السيرفر (Backend Deployment) - الخطوة الأصعب

بما أنك تستخدم `Playwright`، السيرفر يحتاج لبيئة خاصة. أرشح لك منصة **Render.com** لأنها تدعم هذا بسهولة.

### الخطوات على Render:

1.  ارفع مجلد `backend_service` إلى GitHub (يفضل أن يكون في ريبو خاص أو سب-فولدر).
2.  أنشئ حساباً على [Render.com](https://render.com).
3.  اختر **"New Web Service"**.
4.  اربط حساب GitHub واختر الريبو الخاص بك.
5.  **الإعدادات المهمة:**
    *   **Root Directory:** `backend_service` (إذا كان السيرفر داخل مجلد).
    *   **Environment:** `Node`.
    *   **Build Command:** `npm install && npx playwright install --with-deps` (هذا الأمر مهم جداً لتثبيت المتصفح).
    *   **Start Command:** `node server.js`
    
6.  سيقوم Render بالبناء وتثبيت المتصفحات وتشغيل السيرفر.
7.  ستحصل على رابط (مثلاً: `https://ai-automation.onrender.com`).
8.  انسخ هذا الرابط وضعه في إعدادات الـ Frontend (`VITE_API_URL`).

---

## 4. إعدادات بديلة (VPS / Ubuntu Server)

إذا كنت تفضل استخدام سيرفر كامل خاص بك (VPS)، ستحتاج لتثبيت التالي يدوياً:

```bash
# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# تثبيت متطلبات Playwright
npx playwright install-deps
npx playwright install

# تشغيل السيرفر باستخدام PM2 لضمان البقاء
npm install -g pm2
pm2 start server.js --name "ai-automation"
```

ثم ستحتاج لإعداد Nginx كـ Reverse Proxy لتوجيه الترافيك.

---

## ملخص سريع
1. ارفع الباك إند على **Render** واستخدم أمر البناء `npm install && npx playwright install --with-deps`.
2. انسخ رابط الباك إند الجديد.
3. ارفع الفرونت إند على **Vercel**.
4. أضف متغير `VITE_API_URL` في إعدادات Vercel بقيمة رابط الباك إند.
