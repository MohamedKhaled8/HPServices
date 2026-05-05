#!/usr/bin/env node
/**
 * إعداد أتمتة التشفير دفعة واحدة (محلي + Vercel + ملف للخاص لـ Hugging Face).
 *
 *   npm run automation:setup
 *
 * خيارات:
 *   --skip-vercel     لا ترفع إلى Vercel (بدون إنترنت / بدون login)
 *   --deploy            بعد ضبط المتغيرات، نشر الواجهة: vercel deploy --prod --yes
 *
 * متغيرات بيئة:
 *   VERCEL_ENV_TARGETS=production,preview
 *   VERCEL_TOKEN=...   (بديل عن npx vercel login في CI)
 *
 * Hugging Face لا يوفّر رفعًا آمناً للأسرار من CLI للجميع؛ يُنسَخ الخاص تلقائياً إلى:
 *   secrets/AUTOMATION_RSA_PRIVATE_KEY_B64.txt
 *
 * تحذير: "npx vercel link" مع "pull environment variables" قد يستبدل .env.local ويحذف
 * VITE_AUTOMATION_RSA_PUBLIC_PEM_B64. للاستعادة: npm run automation:restore-local-env
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { upsertEnvLine } = require('./upsertEnvLine.cjs');
const { spawnVercelEnvAdd, spawnVercel } = require('./spawnVercelEnvAdd.cjs');

const root = path.join(__dirname, '..');
const ENV_LOCAL = path.join(root, '.env.local');
const SECRETS_DIR = path.join(root, 'secrets');
const HF_SECRET_FILE = path.join(SECRETS_DIR, 'AUTOMATION_RSA_PRIVATE_KEY_B64.txt');
const VERCEL_PUBLIC_FALLBACK_FILE = path.join(SECRETS_DIR, 'PASTE_IN_VERCEL_VITE_AUTOMATION_RSA_PUBLIC_PEM_B64.txt');
const KEY_PUBLIC = 'VITE_AUTOMATION_RSA_PUBLIC_PEM_B64';
const VERCEL_PROJECT_JSON = path.join(root, '.vercel', 'project.json');

const argv = process.argv.slice(2);
const skipVercel = argv.includes('--skip-vercel');
const deployProd = argv.includes('--deploy');

/** نشر Vercel على Windows: shell:true + stdio inherit يعمل أوثق من npx.cmd بدون shell */
function runVercelDeployProd(projectRoot) {
  return spawnSync('npx vercel deploy --prod --yes', {
    cwd: projectRoot,
    shell: true,
    stdio: 'inherit',
    windowsHide: false,
    env: process.env
  });
}

console.log('\n⚠️  يُولَّد مفتاح جديد: حدّث Hugging Face بالخاص من الملف أسفل، وإلا لن يعمل فك التشفير.\n');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});

const privB64 = Buffer.from(privateKey, 'utf8').toString('base64');
const pubB64 = Buffer.from(publicKey, 'utf8').toString('base64');

fs.mkdirSync(SECRETS_DIR, { recursive: true });
fs.writeFileSync(HF_SECRET_FILE, privB64, 'utf8');
fs.writeFileSync(VERCEL_PUBLIC_FALLBACK_FILE, pubB64, 'utf8');
upsertEnvLine(ENV_LOCAL, KEY_PUBLIC, pubB64);

console.log('✅', path.relative(root, ENV_LOCAL), '←', KEY_PUBLIC);
console.log('✅', path.relative(root, HF_SECRET_FILE), '← المفتاح الخاص (لـ HF فقط، لا ترفعه لـ Git)');
console.log(
  '✅',
  path.relative(root, VERCEL_PUBLIC_FALLBACK_FILE),
  '← انسخه يدويًا في Vercel إذا فشل CLI\n'
);

let vercelCliOk = true;

if (!skipVercel) {
  if (!fs.existsSync(VERCEL_PROJECT_JSON)) {
    console.error(
      '❌ لا يوجد ربط بمشروع Vercel (.vercel/project.json).\n' +
        '   من مجلد المشروع شغّل مرة واحدة:  npx vercel link\n' +
        '   ثم أعد: npm run automation:setup\n'
    );
    vercelCliOk = false;
  } else {
    // لا نمنع الرفع إذا فشل whoami بلا مخرجات — على Windows يحدث بعد login ناجح (إيجاب خاطئ).
    const who = spawnVercel({ root, args: ['vercel', 'whoami'] });
    if (who.status === 0 && String(who.stdout || '').trim()) {
      console.log('✓', String(who.stdout).trim());
    }

    const targets = (process.env.VERCEL_ENV_TARGETS || 'production')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const envName of targets) {
      const r = spawnVercelEnvAdd({
        root,
        keyName: KEY_PUBLIC,
        envName,
        value: pubB64
      });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      if (r.status !== 0) {
        console.error(
          '\n❌ فشل: npx vercel env add\n' +
            '— تأكد من: npx vercel login  أو  VERCEL_TOKEN  أو  npx vercel link\n' +
            '— أو أضف المتغير يدويًا في Vercel من الملف:\n   ' +
            VERCEL_PUBLIC_FALLBACK_FILE.replace(/\\/g, '/')
        );
        vercelCliOk = false;
        break;
      }
      console.log('✅ Vercel [' + envName + '] ←', KEY_PUBLIC);
    }
  }

  if (!vercelCliOk) {
    console.error('\n⚠️  الإعداد المحلي جاهز (.env.local + secrets). أكمل Vercel يدويًا أو أصلح CLI ثم أعد المحاولة.\n');
    process.exit(1);
  }
} else {
  console.log('⏭️  تخطّي Vercel (--skip-vercel)\n');
}

if (deployProd && !skipVercel) {
  console.log('\nDeploying to Vercel (production)...\n');
  const d = runVercelDeployProd(root);
  const deployExit = d.status == null ? 1 : d.status;
  if (deployExit !== 0) {
    console.error('\nDeploy failed (exit ' + deployExit + ').\n');
    process.exit(deployExit);
  }
  console.log('\nDeploy finished.\n');
}

const lines = [
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  'تم الإعداد — لا تعديل يدوي على الملفات البرمجية.',
  '',
  '1) Hugging Face → Space → Settings → Secrets',
  '   Name:  AUTOMATION_RSA_PRIVATE_KEY_B64',
  '   Value: محتوى الملف (سطر واحد):',
  '   ' + HF_SECRET_FILE.replace(/\\/g, '/'),
  '   ثم Rebuild الـ Space.',
  ''
];
if (skipVercel) {
  lines.push('2) Vercel: شغّل لاحقًا  npm run automation:setup  بدون --skip-vercel');
} else if (deployProd) {
  lines.push('2) Vercel: إن نجح --deploy أعلاه فالموقع محدّث؛ وإلا Redeploy من اللوحة.');
} else {
  lines.push('2) Vercel: نشر الواجهة مع أحد الخيارين:');
  lines.push('   • لوحة Vercel → Deployments → Redeploy');
  lines.push('   • أو: npm run automation:setup -- --deploy');
}
lines.push('', '3) VITE_API_URL في Vercel = رابط خادم الأتمتة (HF Space).', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
console.log(lines.join('\n'));
