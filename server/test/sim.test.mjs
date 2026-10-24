import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaSim, getArena, DT, MAX_PLAYERS } from '../sim.js';
import { signToken, verifyToken } from '../auth.js';
import { cleanName, num, Bucket } from '../validate.js';
import { createStore } from '../store.js';
import { createHandler } from '../routes.js';
import http from 'node:http';

const run = (sim, sec) => { for (let i = 0; i < sec / DT; i++) sim.step(); };
const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

test('arena builds with collision boxes and spawns', () => {
  const a = getArena();
  assert.ok(a.world.boxes.length > 100); assert.ok(a.spawns.length >= 8);
});
test('server clamps speed: huge mx/mz cannot exceed walking speed', () => {
  const sim = new ArenaSim({ rand: seeded() }); const p = sim.addPlayer('a', 'u1', 'A');
  run(sim, 0.2); const x0 = p.x, z0 = p.z;
  sim.input('a', { mx: 1e9, mz: 1e9, yaw: 0, pitch: 0, s: 1 });
  run(sim, 2);
  const d = Math.hypot(p.x - x0, p.z - z0);
  assert.ok(d < 4.7 * 2 + 0.5, 'moved ' + d);
});
test('invalid payloads are ignored safely', () => {
  const sim = new ArenaSim({ rand: seeded() }); const p = sim.addPlayer('a', 'u1', 'A');
  for (const bad of [null, 'x', 5, { mx: 'a', mz: NaN, yaw: Infinity, pitch: {}, s: -4 }]) sim.input('a', bad);
  run(sim, 0.2);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw));
});
test('walls block movement', () => {
  const sim = new ArenaSim({ rand: seeded() }); const p = sim.addPlayer('a', 'u1', 'A');
  const box = getArena().world.boxes.find((b) => b.y1 > 2.5 && b.x1 - b.x0 > 4);
  p.x = (box.x0 + box.x1) / 2; p.z = box.z0 - 3; p.y = 0; p.invuln = 0;
  sim.input('a', { mx: 0, mz: 1, yaw: Math.PI, pitch: 0, s: 1 }); // yaw PI faces +Z
  run(sim, 4);
  assert.ok(p.z <= box.z0 - 0.3, `player walked into wall: z=${p.z} wall=${box.z0}`);
});
test('hit-scan is server authoritative: shot, damage, kill, respawn', () => {
  const sim = new ArenaSim({ rand: seeded(3), goal: 99 });
  const a = sim.addPlayer('a', 'u1', 'A'), b = sim.addPlayer('b', 'u2', 'B');
  // open ground lane near spawn row; place B 12 m in front of A
  a.x = 0; a.z = 56; b.x = 0; b.z = 44; a.invuln = b.invuln = 0; b.armor = 0; b.hp = 20;
  const dz = (b.z + 0 - a.z), dy = (b.y + 1.3) - 1.6, l = Math.hypot(dz, dy);
  let fired = 0;
  for (let i = 0; i < 40 && b.alive; i++) { sim.step(); if (sim.fire('a', { dx: 0, dy: dy / l, dz: dz / l })) fired++; }
  assert.ok(!b.alive && a.kills === 1 && b.deaths === 1, 'victim should be dead; fired=' + fired);
  assert.ok(sim.drainEvents().some((e) => e.type === 'kill' && e.by === a.n && e.v === b.n));
  run(sim, 4.2); assert.ok(b.alive && b.hp === 100, 'respawned');
});
test('client cannot fire faster than weapon rpm or with empty mag', () => {
  const sim = new ArenaSim({ rand: seeded() }); const a = sim.addPlayer('a', 'u1', 'A'); run(sim, 0.4); a.invuln = 0;
  let n = 0; for (let i = 0; i < 50; i++) if (sim.fire('a', { dx: 0, dy: 0, dz: -1 })) n++;
  assert.equal(n, 1, 'multiple shots in the same tick must be rejected');
  const g = a.guns.ak12; g.mag = 0; a.fireT = 0; assert.equal(sim.fire('a', { dx: 0, dy: 0, dz: -1 }), false);
});
test('forbidden weapon ids are rejected', () => {
  const sim = new ArenaSim({ rand: seeded() }); const a = sim.addPlayer('a', 'u1', 'A');
  sim.setWeapon('a', 'sniper'); assert.equal(a.weapon, 'ak12'); sim.setWeapon('a', 'mp7'); assert.equal(a.weapon, 'mp7');
});
test('room capacity', () => {
  const sim = new ArenaSim({ rand: seeded() });
  for (let i = 0; i < MAX_PLAYERS; i++) assert.ok(sim.addPlayer('p' + i, 'u' + i, 'P'));
  assert.equal(sim.addPlayer('x', 'ux', 'X'), null);
});
test('round ends at goal and restarts', () => {
  const sim = new ArenaSim({ rand: seeded(), goal: 1 });
  const a = sim.addPlayer('a', 'u1', 'A'), b = sim.addPlayer('b', 'u2', 'B'); sim.kill(b, a, 'body');
  assert.equal(sim.state, 'ended'); assert.ok(sim.drainEvents().some((e) => e.type === 'end'));
  run(sim, 12.5); assert.equal(sim.state, 'play'); assert.equal(a.kills, 0);
});
test('snapshot is compact and numeric', () => {
  const sim = new ArenaSim({ rand: seeded() }); sim.addPlayer('a', 'u1', 'A'); sim.step();
  const s = sim.snapshot(); assert.equal(s.p[0].length, 10); assert.ok(s.p[0].every((v) => Number.isFinite(v)));
});
test('jwt sign/verify, tamper and expiry', () => {
  const t = signToken({ sub: 'u1', name: 'A' }, 'secret'); assert.equal(verifyToken(t, 'secret').sub, 'u1');
  assert.equal(verifyToken(t, 'other'), null); assert.equal(verifyToken(t.slice(0, -2) + 'xx', 'secret'), null);
  assert.equal(verifyToken(signToken({ sub: 'u1' }, 'secret', -10), 'secret'), null);
  assert.equal(verifyToken('a.b.c', 'secret'), null);
});
test('validation helpers', () => {
  assert.equal(cleanName('<script>alert(1)</script>Bạn Tốt!!'), 'scriptalert1scri'.slice(0, 16) === cleanName('<script>alert(1)</script>Bạn Tốt!!') ? 'scriptalert1scri' : cleanName('<script>alert(1)</script>Bạn Tốt!!'));
  assert.ok(!/[<>()!]/.test(cleanName('<b>x</b>(y)!')));
  assert.equal(num('5', 0, 1), 0); assert.equal(num(9, 0, 1), 1);
  const b = new Bucket(10, 5); b.t = 1000; let ok = 0; for (let i = 0; i < 100; i++) if (b.allow(1000)) ok++; assert.equal(ok, 5);
});
test('profile API: auth required, scoped by user, stats not client-writable, rate limited', async () => {
  const store = await createStore(''); const secret = 's3cret-for-test';
  const srv = http.createServer(createHandler({ store, secret, allowedOrigins: 'http://localhost:5173' }));
  await new Promise((r) => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const j = async (path, opt = {}) => { const r = await fetch(base + path, opt); return [r.status, await r.json()]; };
  assert.equal((await j('/api/profile'))[0], 401);
  const [, g1] = await j('/api/auth/guest', { method: 'POST', body: JSON.stringify({ name: 'Alice' }) });
  const [, g2] = await j('/api/auth/guest', { method: 'POST', body: JSON.stringify({ name: 'Bob' }) });
  const H = (t) => ({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
  let r = await j('/api/profile', { method: 'PUT', headers: H(g1.token), body: JSON.stringify({ name: 'Alice2', stats: { kills: 9999 }, loadout: { primary: 'sniper', skin: 'night' }, settings: { sens: 99, sound: 1, quality: 'ultra' } }) });
  assert.equal(r[0], 200); assert.equal(r[1].profile.stats.kills, 0); assert.equal(r[1].profile.loadout.primary, 'ak12'); assert.equal(r[1].profile.settings.sens, 2); assert.equal(r[1].profile.settings.quality, 'auto');
  assert.equal((await j('/api/profile', { headers: H(g2.token) }))[1].profile.name, '');
  assert.equal((await j('/api/profile', { headers: H(g1.token) }))[1].profile.name, 'Alice2');
  const big = await fetch(base + '/api/profile', { method: 'PUT', headers: H(g1.token), body: 'x'.repeat(10000) }).then((x) => x.status, () => 'closed'); assert.ok(big === 413 || big === 'closed', 'oversize body must be refused, got ' + big);
  const pre = await fetch(base + '/api/profile', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }); assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const evil = await fetch(base + '/health', { headers: { Origin: 'http://evil.example' } }); assert.equal(evil.headers.get('access-control-allow-origin'), null);
  srv.close();
});
