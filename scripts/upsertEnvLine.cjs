const fs = require('fs');

/**
 * يحدّث أو يضيف سطر KEY=value دون حذف بقية الملف (مهم بعد vercel pull الذي يستبدل .env.local).
 */
function upsertEnvLine(filePath, key, value) {
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    /* */
  }
  const lines = content.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length === 1 && next[0] === '') {
      next[0] = `${key}=${value}`;
    } else {
      if (next.length && next[next.length - 1] !== '') next.push('');
      next.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(filePath, next.join('\n'), 'utf8');
}

module.exports = { upsertEnvLine };
