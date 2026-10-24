// Tiny .env loader (no dependency). Real environment variables always win over the file.
import fs from 'node:fs';

export function loadEnv(file = '.env', env = process.env) {
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch { return 0; }
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 1) continue;
    const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    if (env[k] === undefined) { env[k] = v; n++; }
  }
  return n;
}
