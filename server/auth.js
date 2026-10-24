// Minimal HS256 JWT (no external deps). JWT_SECRET is read from the server environment only.
import crypto from 'node:crypto';
const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function signToken(payload, secret, ttlSec = 7 * 24 * 3600) {
  if (!secret) throw new Error('JWT_SECRET is not set');
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec };
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = head + '.' + b64u(JSON.stringify(body));
  return data + '.' + sign(data, secret);
}
/** Returns the payload or null. */
export function verifyToken(token, secret) {
  if (!secret || typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = sign(parts[0] + '.' + parts[1], secret);
  const a = Buffer.from(parts[2]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (head.alg !== 'HS256') return null;
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!p.sub || (p.exp && p.exp < Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}
