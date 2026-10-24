// Glue between the existing game (main.js) and the realtime connection.
// The client predicts its own movement with the SAME stepMove() the server runs, sends input/intent at ~20 Hz,
// and accepts only server snapshots/events for health, ammo, kills, hit results and round state.
import { Soldier } from '../models/soldier.js';
import { rayUnit } from '../gameplay/combat.js';
import { wrapPi } from '../core/util.js';
import { NET } from './config.js';

const INTERP_MS = 110;       // remote players are rendered this far in the past
const SNAP_DIST = 3;         // hard-correct if prediction is off by more than this (m)
const SOFT_DIST = 0.35;      // ignore smaller error (m)

export function createOnline(G, rt, H) {
  const o = { me: 0, code: '', remotes: new Map(), seq: 0, sendAcc: 0, jumpCount: 0, hist: new Map(), wasAlive: true, off: [], roster: new Map(), tl: 0 };
  const P = G.P;
  const add = (type, cb) => o.off.push(rt.on(type, cb));

  function remote(n, name) {
    let u = o.remotes.get(n);
    if (!u) {
      u = { isRemote: true, n, name: name || 'P' + n, team: 'n' + n, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, armor: 0, alive: false, kills: 0, deaths: 0, invuln: 0, crouch: 0, speed: 0, spotted: 1e9, firing: 0, reloadT: 0, buf: [], s: new Soldier('free') };
      u.s.root.visible = false; G.eng.scene.add(u.s.root); G.units.push(u); o.remotes.set(n, u);
    } else if (name) u.name = name;
    return u;
  }
  function dropRemote(n) {
    const u = o.remotes.get(n); if (!u) return;
    G.eng.scene.remove(u.s.root); const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1); o.remotes.delete(n);
  }
  const byN = (n) => (n === o.me ? P : o.remotes.get(n));

  add('welcome', (m) => {
    o.me = m.n; o.code = m.code; P.name = P.name || 'BẠN';
    H.welcome(m); // main.js starts the match here (it rebuilds G.units), so remotes are added afterwards
    for (const r of m.roster || []) if (r.n !== o.me) { const u = remote(r.n, r.name); u.kills = r.kills; u.deaths = r.deaths; }
  });
  add('join', (m) => { remote(m.n, m.name); H.msg(m.name + ' đã vào phòng'); });
  add('leave', (m) => { const u = o.remotes.get(m.n); if (u) H.msg(u.name + ' đã rời phòng'); dropRemote(m.n); });
  add('ammo', (a) => { const g = P.guns.find((x) => x.W.id === a.w); if (g) { g.mag = a.mag; g.res = a.res; } });
  add('snap', (s) => applySnap(s));
  add('ev', (e) => {
    if (e.type === 'shot') {
      const by = byN(e.by);
      if (by && by !== P) H.remoteShot(by, e);
      if (e.by === o.me && e.v) { const hit = byN(e.v); H.hitMarker(e.z === 'head', hit && hit.hp - (e.d || 0) <= 0); }
    } else if (e.type === 'kill') {
      const by = byN(e.by), v = byN(e.v); if (!by || !v) return;
      by.kills++; v.deaths++; v.alive = false; if (v !== P) v.s.root.visible = true;
      H.feed(by, v, e.z, e.by === o.me || e.v === o.me);
      if (e.v === o.me) { P.hp = 0; P.alive = false; P.respT = 4; H.died(by); }
      if (e.by === o.me) H.msg(e.z === 'head' ? 'BẮN TỈA ĐẦU!' : 'HẠ GỤC ' + v.name);
    } else if (e.type === 'end') { H.ended(e.board, o.me); }
    else if (e.type === 'round') { for (const u of G.units) { u.kills = 0; u.deaths = 0; } H.newRound(); }
  });

  function applySnap(s) {
    const now = performance.now(); G.t = s.tl; o.tl = s.tl;
    for (const r of s.p) {
      const [n, x, y, z, yaw, pitch, fl, hp, ar, ack] = r;
      if (n === o.me) {
        const alive = !!(fl & 1); P.hp = hp; P.armor = ar;
        if (alive && !o.wasAlive) { P.x = x; P.y = y; P.z = z; P.vy = 0; P.velX = P.velZ = 0; P.alive = true; P.invuln = 2; o.hist.clear(); H.respawned(); }
        else if (alive) reconcile(x, y, z, ack);
        else if (!alive && P.alive) { P.alive = false; }
        o.wasAlive = alive; P.reloadSrv = !!(fl & 16);
      } else {
        const u = remote(n);
        u.hp = hp; u.armor = ar; u.alive = !!(fl & 1); u.crouch = fl & 2 ? 1 : 0; u.firing = fl & 4 ? 1 : 0; u.reloadT = fl & 16 ? 1 : 0; u.air = !!(fl & 8);
        u.buf.push({ t: now, x, y, z, yaw, pitch }); if (u.buf.length > 12) u.buf.shift();
        if (!u.alive && u.s.dead === 0) u.s.root.visible = true;
      }
    }
    // drop remotes that are no longer in the snapshot (left without a 'leave' message)
    if (o.remotes.size > s.p.length) { const ids = new Set(s.p.map((r) => r[0])); for (const n of [...o.remotes.keys()]) if (!ids.has(n)) dropRemote(n); }
  }
  /** Compare the server position with where the client was when it sent the acknowledged input, then ease the error out. */
  function reconcile(x, y, z, ack) {
    const h = o.hist.get(ack + 1) || o.hist.get(ack); if (!h) return;
    for (const k of o.hist.keys()) if (k < ack - 2) o.hist.delete(k);
    const ex = x - h.x, ez = z - h.z, ey = y - h.y, d = Math.hypot(ex, ez);
    if (d > SNAP_DIST || Math.abs(ey) > 2) { P.x = x; P.y = y; P.z = z; o.hist.clear(); }
    else if (d > SOFT_DIST) { P.x += ex * 0.25; P.z += ez * 0.25; }
    o.lastErr = d;
  }

  o.jumped = () => { o.jumpCount++; };
  o.update = (dt, input) => {
    // send input at a fixed rate
    o.sendAcc += dt;
    if (o.sendAcc >= 1 / NET.inputHz) {
      o.sendAcc %= 1 / NET.inputHz; o.seq++;
      o.hist.set(o.seq, { x: P.x, y: P.y, z: P.z });
      rt.send('in', { s: o.seq, mx: input.mx, mz: input.mz, yaw: P.yaw, pitch: P.pitch, j: o.jumpCount, c: input.crouchT ? 1 : 0, a: P.ads > 0.5 ? 1 : 0 });
    }
    // interpolate remotes
    const t = performance.now() - INTERP_MS;
    for (const u of o.remotes.values()) {
      const b = u.buf; if (!b.length) continue;
      let i = b.length - 1; while (i > 0 && b[i - 1].t > t) i--;
      const a = b[Math.max(0, i - 1)], c = b[i], k = c.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (c.t - a.t))) : 1;
      const px = u.x, pz = u.z;
      u.x = a.x + (c.x - a.x) * k; u.y = a.y + (c.y - a.y) * k; u.z = a.z + (c.z - a.z) * k;
      u.yaw = a.yaw + wrapPi(c.yaw - a.yaw) * k; u.pitch = a.pitch + (c.pitch - a.pitch) * k;
      u.speed = Math.hypot(u.x - px, u.z - pz) / Math.max(dt, 1e-3);
      u.s.root.position.set(u.x, u.y, u.z); u.s.root.rotation.y = u.yaw;
      u.s.update(dt, { speed: u.speed, crouch: !!u.crouch, pitch: u.pitch, firing: !!u.firing, reloading: !!u.reloadT, dead: !u.alive });
      u.s.root.visible = true;
    }
  };
  /** Fire intent: direction from the server-side eye to the point under the crosshair. The server re-traces everything. */
  o.sendFire = (cam, d) => {
    const w = G.world; let t = 120;
    const hw = w.raycast(cam.x, cam.y, cam.z, d.x, d.y, d.z, t, true); if (hw) t = hw.t;
    for (const u of o.remotes.values()) { if (!u.alive) continue; const r = rayUnit(u, cam.x, cam.y, cam.z, d.x, d.y, d.z, t); if (r) t = r.t; }
    const ax = cam.x + d.x * t, ay = cam.y + d.y * t, az = cam.z + d.z * t;
    const ey = P.y + (P.crouch ? 1.15 : 1.6); let dx = ax - P.x, dy = ay - ey, dz = az - P.z; const l = Math.hypot(dx, dy, dz) || 1;
    rt.send('fire', { dx: dx / l, dy: dy / l, dz: dz / l });
  };
  o.setWeapon = (id) => rt.send('weapon', { id });
  o.reload = () => rt.send('reload');
  o.board = () => [P, ...o.remotes.values()].sort((a, b) => b.kills - a.kills);
  /** Remove every listener and remote model (called on leaving the room / disposing the game). */
  o.dispose = () => { for (const f of o.off) f(); o.off.length = 0; for (const n of [...o.remotes.keys()]) dropRemote(n); o.hist.clear(); };
  return o;
}
