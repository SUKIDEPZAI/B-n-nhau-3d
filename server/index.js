// Server entry: plain HTTP routes (/health, /api/auth/guest, /api/profile) + Colyseus WebSocket rooms on the same port.
import http from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createStore } from './store.js';
import { createHandler } from './routes.js';
import { ArenaRoom } from './rooms/ArenaRoom.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 24) { console.error('JWT_SECRET must be set (>= 24 chars). Refusing to start.'); process.exit(1); }
const store = await createStore(process.env.DATABASE_URL || '');
const httpServer = http.createServer(createHandler({ store, secret, allowedOrigins: process.env.ALLOWED_ORIGINS || '' }));
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer, verifyClient: (info, done) => {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  done(!allowed.length || !info.origin || allowed.includes(info.origin), 403, 'origin not allowed');
} }) });
gameServer.define('arena', ArenaRoom).enableRealtimeListing();
const port = Number(process.env.PORT) || 2567;
await gameServer.listen(port);
console.log(`[server] listening on :${port} store=${store.kind || 'unknown'}`);
