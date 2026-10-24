// Loopback: the real client adapter (src/net/online.js) talks to the real ArenaSim through an in-memory fake of the Colyseus room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaSim, DT } from '../sim.js';
import { createOnline } from '../../src/net/online.js';
import { stepMove } from '../../src/core/move.js';
import { getArena } from '../sim.js';

function fakeRt(sim, id, bus) {
  const handlers = new Map();
  return {
    handlers, state: 'connected',
    on(t, cb) { if (!handlers.has(t)) handlers.set(t, new Set()); handlers.get(t).add(cb); return () => handlers.get(t).delete(cb); },
    send(t, m) { if (t === 'in') sim.input(id, m); else if (t === 'fire') sim.fire(id, m); else if (t === 'weapon') sim.setWeapon(id, m.id); else if (t === 'reload') sim.reload(id); },
    deliver(t, m) { for (const cb of handlers.get(t) || []) cb(m); },
  };
}
const stubG = (P) => ({ P, units: [P], world: getArena().world, eng: { scene: { add() {}, remove() {} } }, t: 0 });
const mkP = () => ({ isPlayer: true, x: 0, y: 0, z: 0, vy: 0, velX: 0, velZ: 0, yaw: 0, pitch: 0, crouch: 0, grounded: true, speed: 0, hp: 100, armor: 0, alive: true, ads: 0, guns: [{ W: { id: 'ak12' }, mag: 30, res: 150 }], slot: 0, kills: 0, deaths: 0 });

test('prediction stays in sync with the server while walking (no rubber-banding)', () => {
  const sim = new ArenaSim({ rand: () => 0.5 }); const sp = sim.addPlayer('a', 'u1', 'A');
  const P = mkP(); P.x = sp.x; P.z = sp.z; const G = stubG(P);
  const rt = fakeRt(sim, 'a'); const hooks = { welcome() {}, msg() {}, hitMarker() {}, feed() {}, remoteShot() {}, died() {}, respawned() {}, ended() {}, newRound() {} };
  const on = createOnline(G, rt, hooks); rt.deliver('welcome', { n: sp.n, code: 'TEST1', roster: [] });
  const input = { mx: 0, mz: 1, crouchT: 0 }; let maxErr = 0; let t = 0;
  for (let i = 0; i < 20 * 8 * 3; i++) { // 3 frames per 50 ms tick, 8 s
    const dt = DT / 3; stepMove(G.world, P, { mx: input.mx, mz: input.mz, jump: false, ads: false, reloading: false }, dt);
    on.update(dt, input); t += dt;
    if (i % 3 === 2) { sim.step(); rt.deliver('snap', sim.snapshot()); maxErr = Math.max(maxErr, Math.hypot(P.x - sp.x, P.z - sp.z)); }
  }
  assert.ok(maxErr < 1.2, 'client/server divergence ' + maxErr);
  assert.ok(Math.hypot(sp.x, sp.z) > 5, 'player actually moved');
});
test('server correction: a teleported client is pulled back', () => {
  const sim = new ArenaSim({ rand: () => 0.5 }); const sp = sim.addPlayer('a', 'u1', 'A');
  const P = mkP(); P.x = sp.x; P.z = sp.z; const G = stubG(P); const rt = fakeRt(sim, 'a');
  const on = createOnline(G, rt, { welcome() {}, msg() {}, hitMarker() {}, feed() {}, remoteShot() {}, died() {}, respawned() {}, ended() {}, newRound() {} });
  rt.deliver('welcome', { n: sp.n, code: 'T', roster: [] });
  for (let i = 0; i < 10; i++) { on.update(0.05, { mx: 0, mz: 0 }); sim.step(); rt.deliver('snap', sim.snapshot()); }
  P.x += 30; // cheat / desync
  for (let i = 0; i < 6; i++) { on.update(0.05, { mx: 0, mz: 0 }); sim.step(); rt.deliver('snap', sim.snapshot()); }
  assert.ok(Math.hypot(P.x - sp.x, P.z - sp.z) < 1, 'client was not corrected');
});
test('two clients see each other; kill event updates scoreboard; listeners are removed on dispose', () => {
  const sim = new ArenaSim({ rand: () => 0.5, goal: 99 });
  const a = sim.addPlayer('a', 'u1', 'A'), b = sim.addPlayer('b', 'u2', 'B');
  const mk = (sp, id) => { const P = mkP(); P.x = sp.x; P.z = sp.z; const G = stubG(P); const rt = fakeRt(sim, id); const log = { kills: [], shots: 0 };
    const on = createOnline(G, rt, { welcome() {}, msg() {}, hitMarker() {}, feed: (by, v) => log.kills.push([by.name, v.name]), remoteShot() { log.shots++; }, died() {}, respawned() {}, ended() {}, newRound() {} });
    rt.deliver('welcome', { n: sp.n, code: 'T', roster: sim.roster() }); return { P, G, rt, on, log }; };
  const A = mk(a, 'a'), B = mk(b, 'b');
  a.x = 0; a.z = 56; b.x = 0; b.z = 44; a.invuln = b.invuln = 0; b.armor = 0; b.hp = 10; sim.step();
  for (let i = 0; i < 6; i++) { sim.step(); const s = sim.snapshot(); A.rt.deliver('snap', s); B.rt.deliver('snap', s); A.on.update(0.05, { mx: 0, mz: 0 }); B.on.update(0.05, { mx: 0, mz: 0 }); }
  assert.equal(A.G.units.length, 2, 'A sees B');
  for (let i = 0; i < 60 && b.alive; i++) { sim.step(); A.on.sendFire({ x: a.x, y: 1.6, z: a.z }, { x: 0, y: -0.02, z: -1 }); for (const e of sim.drainEvents()) { A.rt.deliver('ev', e); B.rt.deliver('ev', e); } }
  assert.deepEqual(A.log.kills[0], ['BẠN', 'B']);
  assert.equal(A.log.kills.length, 1); assert.ok(!B.P.alive && B.P.hp === 0);
  A.on.dispose(); assert.equal([...A.rt.handlers.values()].reduce((n, s) => n + s.size, 0), 0, 'all listeners removed');
});
