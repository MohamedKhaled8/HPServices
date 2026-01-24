# إعداد Firebase

## الخطوات المطلوبة:

### 1. إنشاء مشروع Firebase
1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. أنشئ مشروع جديد أو استخدم مشروع موجود
3. سجل اسم المشروع

### 2. تفعيل Authentication
1. في Firebase Console، اذهب إلى **Authentication**
2. اضغط على **Get Started**
3. في تبويب **Sign-in method**، فعّل **Email/Password**

### 3. إنشاء Firestore Database
1. في Firebase Console، اذهب إلى **Firestore Database**
2. اضغط على **Create database**
3. اختر **Start in test mode** (للاختبار) أو **Production mode** (للإنتاج)
4. اختر موقع قاعدة البيانات

### 4. الحصول على Firebase Config
1. في Firebase Console، اذهب إلى **Project Settings** (⚙️)
2. في قسم **Your apps**، اضغط على **Web** (</>)
3. سجل اسم التطبيق
4. انسخ بيانات التكوين (config)

### 5. تحديث ملف Firebase Config
افتح ملف `src/config/firebase.ts` واستبدل القيم التالية:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

ببيانات التكوين التي حصلت عليها من Firebase Console.

### 6. تثبيت Firebase Package
```bash
npm install firebase
```

### 7. قواعد Firestore (Security Rules)
للاختبار، يمكنك استخدام:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**تحذير:** القواعد أعلاه تسمح بالقراءة والكتابة للجميع. للبيئة الإنتاجية، يجب استخدام قواعد أكثر أماناً.

### 8. البنية في Firestore
سيتم إنشاء المجموعات التالية تلقائياً:
- `students` - بيانات الطلاب المسجلين
- `serviceRequests` - طلبات الخدمات

## الميزات المضافة:
✅ تسجيل مستخدمين جدد مع Firebase Authentication
✅ تسجيل الدخول مع Firebase Authentication  
✅ حفظ جميع بيانات المستخدمين في Firestore
✅ عرض جميع المستخدمين المسجلين في الوقت الفعلي
✅ عرض كلمات المرور (كما طلبت)
✅ تحديث البيانات في الوقت الفعلي (Real-time)
✅ حفظ طلبات الخدمات في Firestore

## ملاحظات:
- جميع البيانات محفوظة في Firestore
- التحديثات تحدث في الوقت الفعلي
- كلمات المرور محفوظة في Firestore (كما طلبت)
- يمكن عرض جميع المستخدمين من Dashboard

