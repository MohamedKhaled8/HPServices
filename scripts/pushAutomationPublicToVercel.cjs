#!/usr/bin/env node
/**
 * يولّد زوج RSA جديد، يطبع الخاص لنسخه إلى Hugging Face، ويرفع العام إلى Vercel عبر CLI.
 *
 * المتطلبات:
 *   - تسجيل دخول مسبق: `npx vercel login`
 *   - أو تعيين VERCEL_TOKEN (من Vercel → Account → Tokens)
 *
 * الاستخدام:
 *   npm run vercel:push-automation-public-key
 *
 * للتوليد + .env.local + Vercel + ملف HF استخدم بدلًا منه:
 *   npm run automation:setup
 *   npm run automation:setup -- --deploy
 *
 * بيئات Vercel (افتراضي production فقط):
 *   set VERCEL_ENV_TARGETS=production,preview   (Windows)
 *   VERCEL_ENV_TARGETS=production,preview npm run vercel:push-automation-public-key   (Unix)
 *
 * لو عندك مفتاح عام جاهز ولا تريد توليدًا جديدًا:
 *   set VITE_AUTOMATION_RSA_PUBLIC_PEM_B64=.... && npm run vercel:push-automation-public-key -- --no-generate
 */
const crypto = require('crypto');
const path = require('path');
const { spawnVercelEnvAdd } = require('./spawnVercelEnvAdd.cjs');

const root = path.join(__dirname, '..');
const KEY_NAME = 'VITE_AUTOMATION_RSA_PUBLIC_PEM_B64';

const noGenerate = process.argv.includes('--no-generate');

let privB64 = '';
let pubB64 = '';

if (noGenerate) {
  pubB64 = (process.env.VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 || '').trim().replace(/\s/g, '');
  if (!pubB64) {
    console.error('مع --no-generate يجب تعيين VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 في البيئة.');
    process.exit(1);
  }
  console.log('استخدام مفتاح عام من المتغير VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 (بدون توليد جديد).\n');
} else {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  privB64 = Buffer.from(privateKey, 'utf8').toString('base64');
  pubB64 = Buffer.from(publicKey, 'utf8').toString('base64');

  console.log('\n=== 1) Hugging Face Secret: AUTOMATION_RSA_PRIVATE_KEY_B64 (انسخه إلى HF ثم Rebuild) ===\n');
  console.log(privB64);
  console.log('\n');
}

const targets = (process.env.VERCEL_ENV_TARGETS || 'production')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const envName of targets) {
  const r = spawnVercelEnvAdd({
    root,
    keyName: KEY_NAME,
    envName,
    value: pubB64
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error(`فشل: vercel env add → ${envName} (رمز الخروج ${r.status}). تأكد من npx vercel login أو VERCEL_TOKEN.`);
    process.exit(r.status || 1);
  }
  console.log(`تم رفع ${KEY_NAME} إلى بيئة Vercel: ${envName}`);
}

console.log('\nأعد نشر المشروع على Vercel (Redeploy) لتضمين المتغير في البناء.\n');
