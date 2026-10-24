// Plain Node http routes: health, guest auth, profile. No framework needed.
import crypto from 'node:crypto';
import { signToken, verifyToken } from './auth.js';
import { cleanName, num, bool, pick, Bucket, WEAPON_IDS, SKIN_IDS } from './validate.js';
import { EMPTY } from './store.js';

const ipBuckets = new Map();
function ipAllow(ip, rate, burst) {
  let b = ipBuckets.get(ip); if (!b) { b = new Bucket(rate, burst); ipBuckets.set(ip, b); if (ipBuckets.size > 5000) ipBuckets.clear(); }
  return b.allow();
}
function readJson(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(Object.assign(new Error('invalid json'), { status: 400 })); } });
    req.on('error', reject);
  });
}
export function createHandler({ store, secret, allowedOrigins }) {
  const origins = (allowedOrigins || '').split(',').map((s) => s.trim()).filter(Boolean);
  return async (req, res) => {
    const origin = req.headers.origin;
    const allow = origins.includes('*') ? '*' : origin && origins.includes(origin) ? origin : '';
    if (allow) { res.setHeader('Access-Control-Allow-Origin', allow); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS'); }
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/health') return send(200, { ok: true, store: store.kind });
      if (url.pathname === '/api/auth/guest' && req.method === 'POST') {
        if (!ipAllow('g' + ip, 0.2, 5)) return send(429, { error: 'rate_limited' });
        const body = await readJson(req);
        const uid = 'g_' + crypto.randomUUID();
        const name = cleanName(body.name, 'Player');
        const token = signToken({ sub: uid, name }, secret);
        return send(200, { token, user: { id: uid, name } });
      }
      if (url.pathname === '/api/profile') {
        if (!ipAllow('p' + ip, 5, 20)) return send(429, { error: 'rate_limited' });
        const auth = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''), secret);
        if (!auth) return send(401, { error: 'unauthorized' });
        const uid = String(auth.sub); // every query is scoped by the verified userId
        if (req.method === 'GET') return send(200, { profile: await store.get(uid) });
        if (req.method === 'PUT') {
          const b = await readJson(req); const cur = await store.get(uid);
          const next = { ...EMPTY(), ...cur, stats: cur.stats }; // stats are server-owned: never taken from the client
          if (b.name !== undefined) next.name = cleanName(b.name, cur.name || 'Player');
          if (b.settings && typeof b.settings === 'object') next.settings = { sens: num(b.settings.sens, 0.5, 2, 1), sound: bool(b.settings.sound), quality: pick(b.settings.quality, ['auto', 'low', 'med', 'high'], 'auto') };
          if (b.loadout && typeof b.loadout === 'object') next.loadout = { primary: pick(b.loadout.primary, WEAPON_IDS, 'ak12'), skin: pick(b.loadout.skin, SKIN_IDS, 'std') };
          await store.put(uid, next);
          return send(200, { profile: next });
        }
        return send(405, { error: 'method_not_allowed' });
      }
      return send(404, { error: 'not_found' });
    } catch (e) { return send(e.status || 500, { error: e.status ? e.message : 'server_error' }); }
  };
}
