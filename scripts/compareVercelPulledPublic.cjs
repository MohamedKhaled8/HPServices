#!/usr/bin/env node
/** يقارن المفتاح العام المشتق من secrets مع ملف env مُنزَّل من Vercel (مثلاً env pull). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const pullPath = process.argv[2] || path.join(root, '.env.vercel.production.download');
const HF_FILE = path.join(root, 'secrets', 'AUTOMATION_RSA_PRIVATE_KEY_B64.txt');

function getLineValue(text, key) {
  const re = new RegExp('^\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*([^\\r\\n]*)', 'm');
  const m = text.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function derivePubB64(privB64OneLine) {
  const pem = Buffer.from(privB64OneLine, 'base64').toString('utf8');
  const pk = crypto.createPrivateKey(pem);
  return Buffer.from(crypto.createPublicKey(pk).export({ type: 'spki', format: 'pem' }), 'utf8').toString('base64');
}

if (!fs.existsSync(pullPath)) {
  console.error('Missing file:', pullPath);
  process.exit(1);
}
if (!fs.existsSync(HF_FILE)) {
  console.error('Missing secrets file');
  process.exit(1);
}

const priv = fs.readFileSync(HF_FILE, 'utf8').trim().replace(/\s/g, '');
const derived = derivePubB64(priv);
const pullText = fs.readFileSync(pullPath, 'utf8');
const fromVercel = (getLineValue(pullText, 'VITE_AUTOMATION_RSA_PUBLIC_PEM_B64') || '').replace(/\s/g, '');
const apiUrl = getLineValue(pullText, 'VITE_API_URL');

console.log('Derived public (from secrets) vs Vercel pulled file — match:', derived === fromVercel);
console.log('VITE_API_URL present:', !!(apiUrl && apiUrl.length > 4));
if (apiUrl) {
  try {
    const u = new URL(apiUrl.startsWith('http') ? apiUrl : 'https://' + apiUrl);
    console.log('VITE_API_URL origin:', u.origin);
  } catch {
    console.log('VITE_API_URL (raw length):', apiUrl.length);
  }
}

process.exit(derived === fromVercel ? 0 : 1);
