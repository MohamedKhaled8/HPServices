#!/usr/bin/env node
/**
 * يولّد مفتاح RSA 2048:
 * - الخاص → Hugging Face Secret: AUTOMATION_RSA_PRIVATE_KEY_B64
 * - العام → Vercel (أو .env): VITE_AUTOMATION_RSA_PUBLIC_PEM_B64  (يُشفّر الحمولة حتى لو فشل GET من المتصفح بسبب CORS)
 *
 * الاستخدام: node scripts/generateAutomationRsaKey.cjs
 */
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
});

const privB64 = Buffer.from(privateKey, 'utf8').toString('base64');
const pubB64 = Buffer.from(publicKey, 'utf8').toString('base64');

console.log('\n=== 1) Hugging Face Secret: AUTOMATION_RSA_PRIVATE_KEY_B64 ===\n');
console.log(privB64);

console.log('\n=== 2) Vercel / .env: VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 ===\n');
console.log(pubB64);

console.log(
    '\nانسخ (2) إلى Vercel Environment Variables ثم أعد بناء الواجهة. ' +
        'بهذا لا يعتمد التشفير على طلب /api/automation-crypto-public من المتصفح.\n'
);
