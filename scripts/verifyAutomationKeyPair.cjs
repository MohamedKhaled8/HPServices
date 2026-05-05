#!/usr/bin/env node
/**
 * يتحقق أن المفتاح الخاص في secrets يطابق المفتاح العام في .env.local (ونفس ما يُرفع لـ Vercel).
 *   node scripts/verifyAutomationKeyPair.cjs
 * لا يطبع أسراراً — فقط OK أو سبب الفشل.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const HF_FILE = path.join(root, 'secrets', 'AUTOMATION_RSA_PRIVATE_KEY_B64.txt');
const ENV_LOCAL = path.join(root, '.env.local');
const KEY = 'VITE_AUTOMATION_RSA_PUBLIC_PEM_B64';

function derivePubB64FromPrivB64(privB64OneLine) {
  const pem = Buffer.from(privB64OneLine, 'base64').toString('utf8');
  const pk = crypto.createPrivateKey(pem);
  const pub = crypto.createPublicKey(pk);
  const spki = pub.export({ type: 'spki', format: 'pem' });
  return Buffer.from(spki, 'utf8').toString('base64');
}

function readEnvLocalValue(name) {
  if (!fs.existsSync(ENV_LOCAL)) return null;
  const text = fs.readFileSync(ENV_LOCAL, 'utf8');
  const re = new RegExp(
    '^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*([^\\r\\n#]*)',
    'm'
  );
  const m = text.match(re);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function main() {
  if (!fs.existsSync(HF_FILE)) {
    console.error('[verify] FAIL: missing', path.relative(root, HF_FILE));
    console.error('        Run: npm run automation:setup');
    process.exit(1);
  }
  const raw = fs.readFileSync(HF_FILE, 'utf8').trim().replace(/\s/g, '');
  if (!raw) {
    console.error('[verify] FAIL: empty private key file');
    process.exit(1);
  }

  let derived;
  try {
    derived = derivePubB64FromPrivB64(raw);
  } catch (e) {
    console.error('[verify] FAIL: invalid private key PEM inside base64:', e.message);
    process.exit(1);
  }

  const fromEnv = readEnvLocalValue(KEY);
  if (!fromEnv) {
    console.error('[verify] FAIL: no', KEY, 'in .env.local');
    console.error('        Run: npm run automation:setup (updates .env.local from secrets)');
    process.exit(1);
  }

  const normEnv = fromEnv.replace(/\s/g, '');
  if (derived === normEnv) {
    console.log('[verify] OK — private key in secrets matches', KEY, 'in .env.local');
    console.log('        Sync Vercel: npm run automation:setup (without --skip-vercel)');
    process.exit(0);
  }

  console.error('[verify] FAIL — mismatch between secrets private key and .env.local public key.');
  console.error('        Keys were rotated separately. Fix: npm run automation:setup');
  console.error('        (reuses secrets file if valid; then updates .env.local + Vercel)');
  process.exit(1);
}

main();
