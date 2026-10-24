// Payload validation helpers. Every value coming from a client is untrusted.
export const num = (v, min, max, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
export const bool = (v) => v === true || v === 1;
export const pick = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def);
/** Display name: letters (incl. Vietnamese), digits, space, _ - ; max 16 chars. */
export function cleanName(v, def = 'Player') {
  if (typeof v !== 'string') return def;
  const s = v.normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);
  return s || def;
}
export const WEAPON_IDS = ['ak12', 'mp7', 'pistol'];   // weapons allowed online (shotgun/sniper need server-side entitlement, not implemented)
export const SKIN_IDS = ['std', 'desert', 'wood', 'night'];

/** Token bucket: allow(n) returns false when the client exceeds `rate` events/second (burst allowed). */
export class Bucket {
  constructor(rate, burst = rate) { this.rate = rate; this.burst = burst; this.tokens = burst; this.t = Date.now(); this.drops = 0; }
  allow(now = Date.now()) {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.t) / 1000) * this.rate); this.t = now;
    if (this.tokens >= 1) { this.tokens -= 1; return true; }
    this.drops++; return false;
  }
}
