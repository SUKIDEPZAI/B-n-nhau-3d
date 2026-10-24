// Colyseus room wrapper around ArenaSim. NOT executed in the build sandbox (colyseus could not be installed there);
// all game rules live in ../sim.js which is unit-tested. Targets colyseus 0.15.
import { Room } from 'colyseus';
import { ArenaSim, TICK_RATE, MAX_PLAYERS } from '../sim.js';
import { verifyToken } from '../auth.js';
import { cleanName, Bucket, pick, WEAPON_IDS } from '../validate.js';

const RECONNECT_SECONDS = 20;
const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 5 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join('');

export class ArenaRoom extends Room {
  maxClients = MAX_PLAYERS;

  onCreate(options) {
    this.sim = new ArenaSim();
    this.secret = process.env.JWT_SECRET;
    this.limits = new Map();
    this.isPrivate = !!(options && options.private);
    // Short, shareable room code. Falls back to the generated id if the code is taken.
    this.roomId = makeCode();
    this.setPrivate(this.isPrivate);
    this.setMetadata({ name: cleanName(options && options.roomName) || 'Arena', private: this.isPrivate });

    this.onMessage('in', (c, m) => { if (this.allow(c, 'in', 30, 40)) this.sim.input(c.sessionId, m); });
    this.onMessage('fire', (c, m) => { if (this.allow(c, 'fire', 15, 20)) this.sim.fire(c.sessionId, m); });
    this.onMessage('reload', (c) => { if (this.allow(c, 'misc', 5, 8)) this.sim.reload(c.sessionId); });
    this.onMessage('weapon', (c, m) => { if (this.allow(c, 'misc', 5, 8)) this.sim.setWeapon(c.sessionId, pick(m && m.id, WEAPON_IDS, 'ak12')); });
    this.onMessage('ping', (c, m) => { if (this.allow(c, 'misc', 5, 8)) c.send('pong', { t: Number(m && m.t) || 0 }); });
    this.onMessage('*', () => { /* unknown message types are ignored */ });

    this.setSimulationInterval(() => this.tickOnce(), 1000 / TICK_RATE);
  }

  allow(client, kind, rate, burst) {
    const k = client.sessionId; let b = this.limits.get(k);
    if (!b) { b = {}; this.limits.set(k, b); }
    const bucket = (b[kind] ||= new Bucket(rate, burst));
    const ok = bucket.allow();
    if (!ok && bucket.drops > 600) client.leave(4008); // sustained flooding: disconnect
    return ok;
  }

  // Identity comes from a server-signed token, never from a public app key.
  onAuth(client, options) {
    const claims = verifyToken(options && options.token, this.secret || '');
    if (claims) return { uid: claims.sub, name: cleanName(claims.name) || 'Player' };
    if (process.env.ALLOW_ANON === '1') return { uid: 'anon-' + client.sessionId, name: cleanName(options && options.name) || 'Guest' };
    throw new Error('unauthorized');
  }

  onJoin(client, options, auth) {
    for (const p of this.sim.players.values()) if (p.uid === auth.uid) throw new Error('already-in-room');
    const p = this.sim.addPlayer(client.sessionId, auth.uid, auth.name);
    if (!p) throw new Error('room-full');
    client.send('welcome', { n: p.n, code: this.roomId, tick: TICK_RATE, goal: this.sim.goal, roster: this.sim.roster() });
    this.broadcast('join', { n: p.n, name: p.name }, { except: client });
  }

  async onLeave(client, consented) {
    const p = this.sim.players.get(client.sessionId);
    if (p && !consented) {
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        return; // same session id keeps the same player entity
      } catch { /* reconnect window expired */ }
    }
    if (p) this.broadcast('leave', { n: p.n });
    this.sim.removePlayer(client.sessionId); this.limits.delete(client.sessionId);
  }

  tickOnce() {
    this.sim.step();
    for (const e of this.sim.drainEvents()) this.broadcast('ev', e);
    this.broadcast('snap', this.sim.snapshot());
    // Private ammo state per client every 5th tick (4 Hz).
    if (this.sim.tick % 5 === 0) for (const c of this.clients) { const a = this.sim.ammo(c.sessionId); if (a) c.send('ammo', a); }
  }

  onDispose() { this.sim = null; this.limits.clear(); }
}
