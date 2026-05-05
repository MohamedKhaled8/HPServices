#!/usr/bin/env node
/**
 * تشغيل vercelEnvAddFromFile.ps1 مع مسار صحيح لـ powershell.exe (cmd لا يجد أحيانًا "powershell" في PATH).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const ps1 = path.join(__dirname, 'vercelEnvAddFromFile.ps1');

function findPowerShellExe() {
  if (process.platform !== 'win32') {
    return 'pwsh'; // Linux/Mac إن وُجد
  }
  const sys = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const bundled = path.join(sys, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.existsSync(bundled)) return bundled;
  return 'powershell.exe';
}

const exe = findPowerShellExe();
const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...process.argv.slice(2)];
const r = spawnSync(exe, psArgs, {
  cwd: root,
  stdio: 'inherit',
  windowsHide: false,
  shell: false
});

process.exit(r.status === null ? 1 : r.status);
