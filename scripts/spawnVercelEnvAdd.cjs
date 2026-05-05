/**
 * رفع متغير بيئة إلى Vercel عبر إعادة توجيه ملف (موثوق على Windows؛ stdin مع npx.cmd غالبًا يفشل).
 * الوثائق: vercel env add NAME production < file.txt
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function npxExecutable() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

/**
 * @param {{ root: string; keyName: string; envName: string; value: string }} o
 * @returns {{ status: number|null; stdout: string; stderr: string }}
 */
function spawnVercelEnvAdd(o) {
  const tmpPath = path.join(
    os.tmpdir(),
    `vercel-env-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.txt`
  );
  fs.writeFileSync(tmpPath, o.value, 'utf8');

  try {
    const escapeWin = (s) => String(s).replace(/"/g, '""');

    let cmd;
    if (process.platform === 'win32') {
      cmd = `npx vercel env add "${escapeWin(o.keyName)}" "${escapeWin(o.envName)}" --yes --force < "${escapeWin(tmpPath)}"`;
    } else {
      const esc = (s) => String(s).replace(/'/g, `'\\''`);
      cmd = `npx vercel env add '${esc(o.keyName)}' '${esc(o.envName)}' --yes --force < '${esc(tmpPath)}'`;
    }

    const r = spawnSync(cmd, {
      cwd: o.root,
      encoding: 'utf8',
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });

    const out = {
      status: r.status,
      stdout: (r.stdout || '').toString(),
      stderr: (r.stderr || '').toString()
    };

    // احتياط إذا فشل إعادة التوجيه: stdin كما في الإصدارات القديمة
    if (out.status !== 0) {
      const r2 = spawnSync(
        npxExecutable(),
        ['vercel', 'env', 'add', o.keyName, o.envName, '--yes', '--force'],
        {
          cwd: o.root,
          input: o.value,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true
        }
      );
      const err2 = (r2.stderr || '').toString();
      const out2 = (r2.stdout || '').toString();
      const mergedErr = [out.stderr, err2 ? `[stdin fallback]\n${err2}` : '']
        .filter(Boolean)
        .join('\n---\n');
      return {
        status: r2.status,
        stdout: out2 || out.stdout,
        stderr: mergedErr || out.stderr || '(محاولتان: ملف ثم stdin)'
      };
    }

    return out;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* */
    }
  }
}

/**
 * @param {{ root: string; args: string[] }} o
 */
function spawnVercel(o) {
  const r = spawnSync(npxExecutable(), o.args, {
    cwd: o.root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true
  });
  return {
    status: r.status,
    stdout: (r.stdout || '').toString(),
    stderr: (r.stderr || '').toString()
  };
}

module.exports = { spawnVercelEnvAdd, spawnVercel, npxExecutable };
