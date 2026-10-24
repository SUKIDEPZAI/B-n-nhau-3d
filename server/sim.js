// Authoritative arena simulation, independent from the Colyseus transport so it can be unit-tested in plain Node.
// The server owns position, health, ammo, kills and respawns. Clients only send intents.
import * as THREE from 'three';
import { buildVillage } from '../src/world/village.js';
import { stepMove } from '../src/core/move.js';
import { WEAPONS, rayUnit } from '../src/gameplay/combat.js';
import { num, bool, WEAPON_IDS } from './validate.js';

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const MAX_PLAYERS = 8;

let arena = null;
/** Builds the village once and keeps only its collision world + spawn points (no rendering). */
export function getArena() {
  if (!arena) {
    const mats = new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });
    const v = buildVillage(mats);
    arena = { world: v.world, spawns: [...v.info.spawns.blue, ...v.info.spawns.red] };
  }
  return arena;
}

const eyeY = (p) => p.y + (p.crouch ? 1.15 : 1.6);

export class ArenaSim {
  constructor({ goal = 15, time = 360, rand = Math.random } = {}) {
    this.arena = getArena(); this.goal = goal; this.timeLimit = time; this.rand = rand;
    this.players = new Map(); this.nextN = 1; this.tick = 0; this.events = [];
    this.resetRound();
  }
  resetRound() {
    this.t = this.timeLimit; this.state = 'play'; this.endT = 0;
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p); }
  }
  addPlayer(id, uid, name) {
    if (this.players.size >= MAX_PLAYERS) return null;
    const p = {
      id, uid, name, n: this.nextN++, x: 0, y: 0, z: 0, vy: 0, velX: 0, velZ: 0, yaw: 0, pitch: 0, crouch: 0, grounded: true, speed: 0,
      hp: 100, armor: 25, alive: false, kills: 0, deaths: 0, invuln: 0, respT: 0,
      it: { mx: 0, mz: 0, yaw: 0, pitch: 0, jump: 0, crouch: 0, ads: 0, seq: 0 }, jumpSeen: 0, ack: 0,
      weapon: 'ak12', guns: {}, fireT: 0, reloadT: 0, swapT: 0, flash: 0, spotted: 0,
    };
    for (const w of WEAPON_IDS) p.guns[w] = { mag: WEAPONS[w].mag, res: WEAPONS[w].reserve };
    this.players.set(id, p); this.spawn(p);
    return p;
  }
  removePlayer(id) { this.players.delete(id); }
  spawn(p) {
    let best = null, bs = -1;
    for (let k = 0; k < 6; k++) {
      const c = this.arena.spawns[Math.floor(this.rand() * this.arena.spawns.length)]; let md = 1e9;
      for (const e of this.players.values()) if (e !== p && e.alive) md = Math.min(md, Math.hypot(e.x - c.x, e.z - c.z));
      if (md > bs) { bs = md; best = c; }
    }
    p.x = best.x + (this.rand() - 0.5); p.z = best.z + (this.rand() - 0.5); p.y = 0; p.vy = 0; p.velX = p.velZ = 0; p.grounded = true;
    p.hp = 100; p.armor = 25; p.alive = true; p.invuln = 2; p.crouch = 0; p.reloadT = 0; p.fireT = 0.3; p.swapT = 0;
    for (const w of WEAPON_IDS) { p.guns[w].mag = WEAPONS[w].mag; p.guns[w].res = WEAPONS[w].reserve; }
    this.events.push({ type: 'spawn', n: p.n });
  }
  // ---- client messages (all fields validated) ----
  input(id, m) {
    const p = this.players.get(id); if (!p || !m || typeof m !== 'object') return;
    const it = p.it;
    it.mx = num(m.mx, -1, 1); it.mz = num(m.mz, -1, 1);
    it.yaw = num(m.yaw, -1000, 1000, it.yaw); it.pitch = num(m.pitch, -1.4, 1.3, it.pitch);
    it.jump = Math.floor(num(m.j, 0, 1e9, it.jump)); it.crouch = bool(m.c) ? 1 : 0; it.ads = bool(m.a) ? 1 : 0;
    const seq = Math.floor(num(m.s, 0, 1e9, it.seq)); if (seq > it.seq) it.seq = seq;
  }
  setWeapon(id, w) {
    const p = this.players.get(id); if (!p || !p.alive || !WEAPON_IDS.includes(w) || w === p.weapon) return;
    p.weapon = w; p.swapT = 0.25; p.reloadT = 0;
  }
  reload(id) {
    const p = this.players.get(id); if (!p || !p.alive || p.reloadT > 0) return;
    const g = p.guns[p.weapon], W = WEAPONS[p.weapon];
    if (g.mag < W.mag && g.res > 0) p.reloadT = W.reload;
  }
  /** m = {dx,dy,dz}: aim direction from the player's eye. Returns true if a shot was fired. */
  fire(id, m) {
    const p = this.players.get(id); if (!p || !p.alive || this.state !== 'play' || !m) return false;
    if (p.fireT > 0 || p.reloadT > 0 || p.swapT > 0) return false;
    const g = p.guns[p.weapon], W = WEAPONS[p.weapon];
    if (g.mag <= 0) { this.reload(id); return false; }
    let dx = num(m.dx, -1, 1), dy = num(m.dy, -1, 1), dz = num(m.dz, -1, 1);
    const l = Math.hypot(dx, dy, dz); if (l < 0.5) return false; dx /= l; dy /= l; dz /= l;
    g.mag--; p.fireT = 60 / W.rpm; p.flash = 0.12; p.invuln = 0; // shooting ends spawn protection
    const spread = W.spread * (p.speed > 1 ? 1.8 : 1) * (p.crouch ? 0.7 : 1) * (p.grounded ? 1 : 3) * (p.it.ads ? 0.4 : 1);
    dx += (this.rand() - 0.5) * 2 * spread; dy += (this.rand() - 0.5) * 2 * spread; dz += (this.rand() - 0.5) * 2 * spread;
    const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
    const ox = p.x, oy = eyeY(p), oz = p.z;
    let tmax = W.range;
    const hw = this.arena.world.raycast(ox, oy, oz, dx, dy, dz, tmax, true);
    if (hw) tmax = hw.t;
    let vic = null, ht = tmax, zone = 'body';
    for (const u of this.players.values()) {
      if (u === p || !u.alive || u.invuln > 0) continue;
      const r = rayUnit(u, ox, oy, oz, dx, dy, dz, ht);
      if (r) { vic = u; ht = r.t; zone = r.zone; }
    }
    const t = vic ? ht : tmax;
    const ev = { type: 'shot', by: p.n, o: [round(ox + dx * 0.6), round(oy - 0.15), round(oz + dz * 0.6)], e: [round(ox + dx * t), round(oy + dy * t), round(oz + dz * t)], w: p.weapon };
    if (vic) {
      const mul = zone === 'head' ? 2.1 : zone === 'leg' ? 0.8 : 1, fall = 1 - Math.min(0.35, (t / W.range) * 0.4);
      let amt = W.dmg * mul * fall;
      if (vic.armor > 0) { const ab = Math.min(vic.armor, amt * 0.55); vic.armor -= ab; amt -= ab * 0.9; }
      vic.hp -= amt; ev.v = vic.n; ev.z = zone; ev.d = Math.round(amt);
      if (vic.hp <= 0) this.kill(vic, p, zone);
    }
    this.events.push(ev);
    return true;
  }
  kill(v, by, zone) {
    v.hp = 0; v.alive = false; v.deaths++; v.respT = 4; by.kills++;
    this.events.push({ type: 'kill', by: by.n, v: v.n, z: zone });
    if (by.kills >= this.goal) this.endRound();
  }
  endRound() {
    if (this.state !== 'play') return;
    this.state = 'ended'; this.endT = 12;
    this.events.push({ type: 'end', board: this.board() });
  }
  board() { return [...this.players.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map((p, i) => ({ n: p.n, uid: p.uid, name: p.name, kills: p.kills, deaths: p.deaths, rank: i + 1 })); }
  // ---- one fixed tick ----
  step() {
    this.tick++;
    if (this.state === 'play') { this.t -= DT; if (this.t <= 0) { this.t = 0; this.endRound(); } }
    else { this.endT -= DT; if (this.endT <= 0) { this.resetRound(); this.events.push({ type: 'round' }); } }
    for (const p of this.players.values()) {
      p.fireT = Math.max(0, p.fireT - DT); p.swapT = Math.max(0, p.swapT - DT); p.flash = Math.max(0, p.flash - DT); p.invuln = Math.max(0, p.invuln - DT);
      if (!p.alive) { if (this.state === 'play') { p.respT -= DT; if (p.respT <= 0) this.spawn(p); } continue; }
      if (p.reloadT > 0) { p.reloadT -= DT; if (p.reloadT <= 0) { const g = p.guns[p.weapon], W = WEAPONS[p.weapon], n = Math.min(W.mag - g.mag, g.res); g.mag += n; g.res -= n; } }
      const it = p.it;
      p.yaw = it.yaw; p.pitch = it.pitch; p.crouch = it.crouch;
      const jump = it.jump !== p.jumpSeen; p.jumpSeen = it.jump;
      const move = { mx: this.state === 'play' ? it.mx : 0, mz: this.state === 'play' ? it.mz : 0, jump, ads: !!it.ads, reloading: p.reloadT > 0 };
      stepMove(this.arena.world, p, move, DT / 2); move.jump = false; stepMove(this.arena.world, p, move, DT / 2);
      p.ack = it.seq;
    }
  }
  drainEvents() { const e = this.events; this.events = []; return e; }
  /** Compact snapshot: [n, x, y, z, yaw, pitch, flags, hp, armor, ack]; flags: 1 alive, 2 crouch, 4 firing, 8 airborne, 16 reloading. */
  snapshot() {
    const p = [];
    for (const u of this.players.values()) p.push([u.n, round(u.x), round(u.y), round(u.z), round(u.yaw), round(u.pitch), (u.alive ? 1 : 0) | (u.crouch ? 2 : 0) | (u.flash > 0 ? 4 : 0) | (u.grounded ? 0 : 8) | (u.reloadT > 0 ? 16 : 0), Math.ceil(u.hp), Math.ceil(u.armor), u.ack]);
    return { t: this.tick, tl: Math.ceil(this.t), st: this.state === 'play' ? 0 : 1, p };
  }
  roster() { return [...this.players.values()].map((u) => ({ n: u.n, name: u.name, kills: u.kills, deaths: u.deaths })); }
  ammo(id) { const p = this.players.get(id); if (!p) return null; const g = p.guns[p.weapon]; return { w: p.weapon, mag: g.mag, res: g.res }; }
}
const round = (v) => Math.round(v * 100) / 100;
