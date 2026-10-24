import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { loadEnv } from '../env.js';
import { createStore } from '../store.js';
import { createHandler } from '../routes.js';
import { createStatic } from '../static.js';

test('.env loader: parses, strips quotes/comments, never overrides real env', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'env-')), '.env');
  fs.writeFileSync(f, '# c\nA=1\nB="two words"\nC=3 # note\nBAD KEY=x\nKEEP=file\n');
  const env = { KEEP: 'real' }; assert.equal(loadEnv(f, env), 3);
  assert.deepEqual(env, { KEEP: 'real', A: '1', B: 'two words', C: '3' });
  assert.equal(loadEnv('/nonexistent/.env', {}), 0);
});
test('file store persists across restarts', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'st-')), 'data', 'p.json');
  let s = await createStore('', { file: f }); const d = await s.get('u1'); d.name = 'Zed'; await s.put('u1', d); await s.close();
  s = await createStore('', { file: f }); assert.equal((await s.get('u1')).name, 'Zed'); assert.equal((await s.get('other')).name, ''); await s.close();
});
test('server serves the game with injected same-origin server url, 404 for other paths, API unaffected', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-')); fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><title>t</title></head><body>hi</body></html>');
  const store = await createStore(''); const srv = http.createServer(createHandler({ store, secret: 'x'.repeat(32), allowedOrigins: '', fallback: createStatic(dir) }));
  await new Promise((r) => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const html = await (await fetch(base + '/')).text(); assert.ok(html.includes('window.__FF_SERVER__=location.origin') && html.includes('hi'));
  assert.equal((await fetch(base + '/secret.txt')).status, 404); assert.equal((await fetch(base + '/../server/index.js')).status, 404);
  assert.equal((await fetch(base + '/api/profile')).status, 401); assert.equal((await fetch(base + '/health')).status, 200);
  srv.close();
});
