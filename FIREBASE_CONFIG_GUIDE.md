# دليل الحصول على Firebase Config

## الخطوة 1: إنشاء مشروع Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. اضغط على **"إضافة مشروع"** أو **"Add project"**
3. أدخل اسم المشروع (مثلاً: `student-services-platform`)
4. اضغط **"متابعة"** أو **"Continue"**
5. (اختياري) فعّل Google Analytics إذا أردت
6. اضغط **"إنشاء المشروع"** أو **"Create project"**
7. انتظر حتى يتم إنشاء المشروع (قد يستغرق دقيقة)

## الخطوة 2: إضافة تطبيق ويب

1. بعد إنشاء المشروع، ستظهر لك شاشة الترحيب
2. اضغط على أيقونة **Web** `</>` أو **"إضافة تطبيق"** → **"Web"**
3. سجل اسم التطبيق (مثلاً: `Student Services Web`)
4. (اختياري) فعّل Firebase Hosting إذا أردت
5. اضغط **"تسجيل التطبيق"** أو **"Register app"**

## الخطوة 3: نسخ بيانات التكوين (Config)

بعد تسجيل التطبيق، ستظهر لك شاشة تحتوي على كود JavaScript مثل:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

**انسخ هذه القيم!**

## الخطوة 4: تفعيل Authentication

1. من القائمة الجانبية، اضغط على **"Authentication"** أو **"المصادقة"**
2. اضغط **"Get started"** أو **"ابدأ"**
3. اذهب إلى تبويب **"Sign-in method"** أو **"طرق تسجيل الدخول"**
4. اضغط على **"Email/Password"**
5. فعّل **"Enable"** أو **"تفعيل"**
6. اضغط **"Save"** أو **"حفظ"**

## الخطوة 5: إنشاء Firestore Database

1. من القائمة الجانبية، اضغط على **"Firestore Database"** أو **"قاعدة بيانات Firestore"**
2. اضغط **"Create database"** أو **"إنشاء قاعدة بيانات"**
3. اختر **"Start in test mode"** للاختبار (أو Production mode للإنتاج)
4. اختر موقع قاعدة البيانات (اختر الأقرب لمنطقتك)
5. اضغط **"Enable"** أو **"تفعيل"**

## الخطوة 6: تحديث ملف Firebase Config

افتح ملف `src/config/firebase.ts` واستبدل القيم:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyC...", // من Firebase Console
  authDomain: "your-project.firebaseapp.com", // من Firebase Console
  projectId: "your-project-id", // من Firebase Console
  storageBucket: "your-project.appspot.com", // من Firebase Console
  messagingSenderId: "123456789", // من Firebase Console
  appId: "1:123456789:web:abcdef" // من Firebase Console
};
```

## ملاحظات مهمة:

⚠️ **لا تشارك ملف Firebase Config في GitHub** إذا كان المشروع عاماً
⚠️ **احفظ نسخة احتياطية** من بيانات Config
✅ يمكنك العثور على Config في أي وقت من: **Project Settings** → **Your apps** → **Web app**

## إذا نسيت Config:

1. اذهب إلى Firebase Console
2. اضغط على ⚙️ **"Project Settings"** أو **"إعدادات المشروع"**
3. اذهب إلى تبويب **"General"** أو **"عام"**
4. في قسم **"Your apps"** أو **"تطبيقاتك"**، ستجد تطبيق Web
5. اضغط على **"Config"** أو **"التكوين"** لرؤية القيم

## مثال على Config كامل:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz",
  authDomain: "student-services-12345.firebaseapp.com",
  projectId: "student-services-12345",
  storageBucket: "student-services-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

---

**بعد تحديث Config، سيعمل التطبيق مع Firebase! 🎉**

