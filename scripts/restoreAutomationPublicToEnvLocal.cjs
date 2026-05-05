#!/usr/bin/env node
/**
 * يعيد إدراج VITE_AUTOMATION_RSA_PUBLIC_PEM_B64 في .env.local من ملف secrets (بدون توليد مفاتيح جديدة).
 * استخدمه بعد: npx vercel link → pull variables → حذف السطر من .env.local
 *
 *   npm run automation:restore-local-env
 *
 * أو من ملف آخر:
 *   node scripts/restoreAutomationPublicToEnvLocal.cjs path/to/pub.b64.txt
 */
const fs = require('fs');
const path = require('path');
const { upsertEnvLine } = require('./upsertEnvLine.cjs');

const root = path.join(__dirname, '..');
const ENV_LOCAL = path.join(root, '.env.local');
const DEFAULT_PASTE = path.join(root, 'secrets', 'PASTE_IN_VERCEL_VITE_AUTOMATION_RSA_PUBLIC_PEM_B64.txt');
const KEY_PUBLIC = 'VITE_AUTOMATION_RSA_PUBLIC_PEM_B64';

const customPath = process.argv[2];
const srcPath = customPath ? path.resolve(process.cwd(), customPath) : DEFAULT_PASTE;

if (!fs.existsSync(srcPath)) {
  console.error(
    'لا يوجد ملف المفتاح العام:\n  ' +
      srcPath +
      '\n\nانسخ القيمة من لوحة Vercel → Environment Variables أو شغّل سابقًا npm run automation:setup'
  );
  process.exit(1);
}

const pubB64 = fs.readFileSync(srcPath, 'utf8').trim().replace(/\s/g, '');
if (!pubB64) {
  console.error('الملف فارغ.');
  process.exit(1);
}

upsertEnvLine(ENV_LOCAL, KEY_PUBLIC, pubB64);
console.log('✅ تمت إضافة/تحديث', KEY_PUBLIC, 'في', path.relative(root, ENV_LOCAL));
console.log('   (باقي الأسطر من vercel pull لم تُمسّ)\n');
