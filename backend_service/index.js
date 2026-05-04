/**
 * بعض منصات النشر (وملف package.json هنا main: index.js) تشغّل `node index.js`.
 * نوحّد التشغيل على نفس منطق server.js حتى لا يُستخدم ملف قديم بالخطأ.
 */
require('./server.js');
