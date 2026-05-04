#!/usr/bin/env node
/**
 * يولّد مفتاح RSA 2048 لـ AUTOMATION_RSA_PRIVATE_KEY_B64 (ضعه في Hugging Face Secrets).
 * الاستخدام: node scripts/generateAutomationRsaKey.cjs
 */
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

const b64 = Buffer.from(privateKey, 'utf8').toString('base64');
console.log('\nضع السطر التالي في Secrets (اسم المتغير: AUTOMATION_RSA_PRIVATE_KEY_B64):\n');
console.log(b64);
console.log('\nثم أعد بناء الـ Space. الواجهة ستجلب المفتاح العام تلقائيًا من /api/automation-crypto-public.\n');
