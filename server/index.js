// Server entry (HTTP routes + static game + Colyseus WebSocket on ONE port).
// Hosting notes (FalixNodes): started as `node index.js`; port comes from SERVER_PORT; must bind 0.0.0.0;
// the panel marks the server online when the console prints "Listening".
import http from 'node:http';
import path from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { loadEnv } from './env.js';
import { createStore } from './store.js';
import { createHandler } from './routes.js';
import { createStatic } from './static.js';
import { ArenaRoom } from './rooms/ArenaRoom.js';

async function main() {
  loadEnv(process.env.ENV_FILE || '.env');
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) { console.error('JWT_SECRET must be set (>= 24 chars) in .env or the environment. Refusing to start.'); process.exit(1); }
  const port = Number(process.env.SERVER_PORT || process.env.PORT) || 2567;
  const host = '0.0.0.0';
  const store = await createStore(process.env.DATABASE_URL || '', { file: process.env.DATA_FILE || path.join('data', 'profiles.json') });
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const httpServer = http.createServer(createHandler({ store, secret, allowedOrigins: process.env.ALLOWED_ORIGINS || '', fallback: createStatic(process.env.STATIC_DIR || 'public') }));
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer, pingInterval: 10000, pingMaxRetries: 3, verifyClient: (info, done) => {
    // Same-origin pages (game served by this server) are always allowed; other origins must be listed in ALLOWED_ORIGINS.
    let ok = !info.origin || allowed.includes('*') || allowed.includes(info.origin);
    if (!ok) { try { ok = new URL(info.origin).host === info.req.headers.host; } catch { ok = false; } }
    done(ok, 403, 'origin not allowed');
  } }) });
  gameServer.define('arena', ArenaRoom).enableRealtimeListing();
  await gameServer.listen(port, host);
  console.log(`Listening on ${host}:${port} · store=${store.kind} · static=${process.env.STATIC_DIR || 'public'}`);
  const stop = async () => { try { await gameServer.gracefullyShutdown(false); await store.close(); } finally { process.exit(0); } };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
main().catch((e) => { console.error('fatal:', e); process.exit(1); });
