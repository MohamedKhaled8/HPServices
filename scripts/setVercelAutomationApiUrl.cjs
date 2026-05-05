#!/usr/bin/env node
/**
 * يضبط VITE_API_URL على Vercel (production + preview) ليشير إلى خادم Hugging Face.
 * الافتراضي: نفس الـ Space المرتبط بـ remote "space" في git إن وُجد، وإلا من وسيطات الأوامر.
 *
 *   node scripts/setVercelAutomationApiUrl.cjs
 *   node scripts/setVercelAutomationApiUrl.cjs https://user-space.hf.space
 */
const fs = require('fs');
const path = require('path');
const { spawnVercelEnvAdd } = require('./spawnVercelEnvAdd.cjs');

const root = path.join(__dirname, '..');

function hfSpaceOriginFromGitRemote() {
  const p = path.join(root, '.git', 'config');
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/\[remote "space"\][\s\S]*?url\s*=\s*(\S+)/);
  if (!m) return null;
  const url = m[1].trim();
  // https://huggingface.co/spaces/user/repo-name
  const sm = url.match(/huggingface\.co\/spaces\/([^/]+)\/([^/?#]+)/i);
  if (!sm) return null;
  const user = sm[1];
  const repo = sm[2];
  const slug = `${user}-${repo}`.toLowerCase();
  return `https://${slug}.hf.space`;
}

const argUrl = process.argv[2];
const defaultUrl = hfSpaceOriginFromGitRemote();
const baseUrl = (argUrl || defaultUrl || '').replace(/\/$/, '');

if (!baseUrl || !baseUrl.startsWith('http')) {
  console.error('Usage: node scripts/setVercelAutomationApiUrl.cjs <https://....hf.space>');
  console.error('Or add git remote "space" pointing to huggingface.co/spaces/...');
  process.exit(1);
}

const targets = (process.env.VERCEL_ENV_TARGETS || 'production,preview')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const envName of targets) {
  const r = spawnVercelEnvAdd({
    root,
    keyName: 'VITE_API_URL',
    envName,
    value: baseUrl
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('Failed', envName, r.stderr);
    process.exit(r.status == null ? 1 : r.status);
  }
  console.log('OK Vercel [' + envName + '] VITE_API_URL =', baseUrl);
}

console.log('\nRedeploy the frontend (e.g. npx vercel deploy --prod --yes) so the new URL is baked into the build.');
