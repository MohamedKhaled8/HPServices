#!/usr/bin/env node
/** @deprecated استخدم: npm run automation:setup */
const path = require('path');
const { spawnSync } = require('child_process');
const child = spawnSync(process.execPath, [path.join(__dirname, 'automationSetupAll.cjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});
process.exit(child.status === null ? 1 : child.status);
