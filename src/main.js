// Field Force 3D — Village Operations. Vòng lặp game, người chơi, camera, chế độ trận, HUD.
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { createTextures } from './world/textures.js';
import { createMaterials, buildVillage } from './world/village.js';
import { Nav } from './core/phys.js';
import { Soldier } from './models/soldier.js';
import { BUILDERS } from './models/weapons.js';
import { clamp, damp, fmtTime, wrapPi } from './core/util.js';
import { Input } from './gameplay/input.js';
import { Sound } from './gameplay/audio.js';
import { FX } from './gameplay/fx.js';
import { Bot } from './gameplay/bots.js';
import { WEAPONS, rayUnit } from './gameplay/combat.js';

const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };
const MODES = { tdm: { goal: 40, time: 360, label: 'ĐỘI ĐỐI KHÁNG', goalTxt: 'tới 40' }, dom: { goal: 200, time: 420, label: 'CHIẾM ĐIỂM', goalTxt: 'tới 200' }, ffa: { goal: 15, time: 300, label: 'SINH TỒN CÁ NHÂN', goalTxt: 'tới 15 hạ' } };
const input = new Input();
const sound = new Sound();
let mode = store.get('ff_mode', 'tdm'); if (!MODES[mode]) mode = 'tdm';
let G = null, building = false;

// ---------- menu ----------
function selMode(m) { mode = m; store.set('ff_mode', m); for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('sel', b.dataset.m === m); }
selMode(mode);
for (const b of document.querySelectorAll('#modes button')) b.addEventListener('click', () => selMode(b.dataset.m));
$('qsel').value = store.get('ff_q', 'auto');
$('qsel').addEventListener('change', () => store.set('ff_q', $('qsel').value));
const baseSens = input.sens;
$('sens').value = store.get('ff_sens', '1'); input.sens = baseSens * +$('sens').value;
$('sens').addEventListener('input', () => { input.sens = baseSens * +$('sens').value; store.set('ff_sens', $('sens').value); });
$('snd').checked = store.get('ff_snd', '1') === '1'; sound.on = $('snd').checked;
$('snd').addEventListener('change', () => { sound.setOn($('snd').checked); store.set('ff_snd', $('snd').checked ? '1' : '0'); });
function stats() { $('stM').textContent = store.get('ff_matches', '0'); $('stK').textContent = store.get('ff_kills', '0'); }
stats();
// nút kỹ năng (cảm ứng + chuột): kích hoạt ngay khi chạm
for (const [id, k] of [['kEmote', 'emote'], ['kHolo', 'holo'], ['kScan', 'scan'], ['kCmd', 'cmd']]) $(id).addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); input.e[k] = 1; });
for (const id of ['bCam', 'bPause']) $(id).addEventListener('pointerdown', (ev) => ev.stopPropagation());
$('play').addEventListener('click', async () => {
  if (building) return;
  sound.unlock();
  if (G) { startMatch(); return; }
  building = true;
  $('load').style.display = 'block';
  const q = $('qsel').value === 'auto' ? (input.touch ? 'med' : 'high') : $('qsel').value;
  const prog = (t, f) => { $('ltxt').textContent = t; $('lbar').style.right = (100 - f * 100) + '%'; };
  try { await boot(q, prog); } catch (e) { $('ltxt').textContent = 'Lỗi: ' + (e && e.message); console.error(e); building = false; return; }
  building = false; startMatch();
});
$('again').addEventListener('click', () => { $('end').classList.add('hide'); startMatch(); });
$('tomenu').addEventListener('click', () => toMenu());
$('quit').addEventListener('click', () => toMenu());
$('resume').addEventListener('click', () => resume());
$('bPause').addEventListener('click', () => pause());
$('bCam').addEventListener('click', () => { input.e.cam = 1; });
function toMenu() { stats(); if (G) { G.running = false; } $('end').classList.add('hide'); $('pause').classList.add('hide'); $('hud').classList.add('off'); $('menu').classList.remove('hide'); $('load').style.display = 'none'; input.active = false; document.exitPointerLock?.(); }
function pause() { if (!G || !G.running) return; G.paused = true; $('pause').classList.remove('hide'); input.active = false; input.fire = false; document.exitPointerLock?.(); }
function resume() { if (!G) return; G.paused = false; $('pause').classList.add('hide'); input.active = true; sound.unlock(); if (!input.touch) $('game').requestPointerLock?.(); }

// ---------- khởi tạo thế giới ----------
async function boot(qName, prog) {
  const eng = new Engine($('game'), qName);
  const tx = eng.q.tex;
  prog('Tạo vật liệu…', 0.05);
  const T = await createTextures({ res: tx, aniso: eng.q.aniso, progress: (f) => prog('Tạo vật liệu…', 0.05 + f * 0.5) });
  const M = createMaterials(T, eng.q.pbr);
  prog('Dựng ngôi làng…', 0.6); await new Promise((r) => setTimeout(r, 16));
  const v = buildVillage(M);
  eng.scene.add(v.group);
  prog('Tạo lưới dẫn đường…', 0.85); await new Promise((r) => setTimeout(r, 16));
  const nav = new Nav(v.world);
  const fx = new FX(eng.scene);
  G = { eng, world: v.world, nav, info: v.info, fx, units: [], bots: [], items: [], nades: [], pathQ: [], now: 0, mode, running: false, paused: false, hotspots: [], objOwner: {}, objProg: {}, ping: null, scanT: 0, hostile, fireShot, respawn, nearestEnemyYaw, effScale: 1, ft: 16, fcount: 0 };
  // điểm nóng cho bot: các nút giao thông + điểm mục tiêu
  for (const o of v.info.objectives) G.hotspots.push({ x: o.x, z: o.z });
  for (const [x, z] of [[-14, 30], [14, 30], [-14, -30], [14, -30], [0, 38], [0, -40], [-40, 0], [40, 0], [-26, -4], [26, 6], [0, 20], [0, -18]]) G.hotspots.push({ x, z });
  G.hotspots = G.hotspots.filter((h) => !nav.blocked[nav.idx(h.x, h.z)]);
  buildPlayer(); buildItems(); buildObjectives(); buildMinimap(); G.mk = $('mk'); G.mkc = G.mk.getContext('2d');
  prog('Sẵn sàng', 1);
  eng.resize(); resizeMk(); addEventListener('resize', resizeMk);
  eng.render();
  last = performance.now(); requestAnimationFrame(frame);
}
function resizeMk() { if (!G) return; G.mk.width = innerWidth; G.mk.height = innerHeight; }

// ---------- người chơi ----------
function buildPlayer() {
  const P = { isPlayer: true, team: 'blue', name: 'BẠN', x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, kick: 0, kickY: 0, crouch: 0, crouchK: 0, speed: 0, hp: 100, armor: 0, alive: true, kills: 0, deaths: 0, invuln: 0, grounded: true, slot: 0, ads: 0, fireT: 0, reloadT: 0, emoteT: 0, nades: 2, camFP: false, respT: 0, spotted: 0, velX: 0, velZ: 0, firing: 0 };
  P.guns = ['ak12', 'mp7', 'pistol'].map((id) => ({ W: WEAPONS[id], mag: WEAPONS[id].mag, res: WEAPONS[id].reserve, have: id !== 'mp7' }));
  P.s = new Soldier('blue'); P.s.root.visible = false;
  P.tpGuns = P.guns.map((g) => BUILDERS[g.W.id]());
  P.vmGuns = P.guns.map((g) => { const o = BUILDERS[g.W.id](); o.visible = false; return o; });
  const vm = new THREE.Group(); P.vm = vm; P.vmGuns.forEach((o, i) => { vm.add(o); });
  // tay + tay áo trong viewmodel
  const gm = new THREE.MeshStandardMaterial({ color: 0x22231f, roughness: 0.9 }), sm = new THREE.MeshStandardMaterial({ color: 0x59634d, roughness: 0.9 });
  const limb = (m, ax, ay, az, bx, by, bz, r) => { const A = new THREE.Vector3(ax, ay, az), B = new THREE.Vector3(bx, by, bz), L = A.distanceTo(B); const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, L, 10), m); c.position.copy(A).add(B).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); vm.add(c); return c; };
  const hand = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gm); b.position.set(x, y, z); vm.add(b); return b; };
  hand(0.064, 0.085, 0.075, 0.0, -0.075, 0.045); limb(sm, 0.012, -0.095, 0.075, 0.12, -0.27, 0.26, 0.036);
  P.hL = hand(0.07, 0.06, 0.1, -0.012, -0.075, -0.4); limb(sm, -0.03, -0.085, -0.37, -0.15, -0.26, -0.02, 0.036);
  vm.scale.setScalar(0.82);
  G.eng.vmCamera.add(vm); G.eng.vmScene.add(G.eng.vmCamera);
  G.P = P; G.eng.scene.add(P.s.root);
  P.s.setWeapon(P.tpGuns[0], false);
}
function curGun(P = G.P) { return P.guns[P.slot]; }
function selectSlot(i) {
  const P = G.P; if (!P.guns[i] || !P.guns[i].have || i === P.slot) return;
  P.slot = i; P.reloadT = 0; P.fireT = 0.25; P.swapT = 0.25;
  P.vmGuns.forEach((o, k) => (o.visible = k === i)); P.s.setWeapon(P.tpGuns[i], i === 2); sound.click(); hudWeapons();
}

// ---------- vật phẩm, mục tiêu ----------
function buildItems() {
  const mat = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: e });
  for (const it of G.info.items) {
    if (!['med', 'armor', 'ammo', 'mp7'].includes(it.type)) continue;
    const g = new THREE.Group();
    if (it.type === 'med') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.24), mat(0xeeeeee, 0.15))); const a = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.255), mat(0xd8352a, 0.4)), b = a.clone(); b.rotation.y = Math.PI / 2; b.scale.set(1, 1, 0.94); g.add(a, b); }
    else if (it.type === 'armor') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.14), mat(0x2d7bd6, 0.25))); const a = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), mat(0x14325c)); a.position.y = 0.1; g.add(a); }
    else if (it.type === 'ammo') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.2), mat(0xb08a2a, 0.25))); const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), mat(0x3a3a2a)); a.position.y = 0.06; g.add(a); }
    else { const w = BUILDERS.mp7(); w.scale.setScalar(1.6); g.add(w); }
    // vầng sáng
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 6, 28), new THREE.MeshBasicMaterial({ color: it.type === 'med' ? 0x55ff88 : it.type === 'armor' ? 0x55aaff : 0xffcc44, transparent: true, opacity: 0.6, fog: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.55; g.add(ring);
    g.position.set(it.x, 1.0, it.z); G.eng.scene.add(g);
    G.items.push({ type: it.type, x: it.x, z: it.z, mesh: g, cd: 0 });
  }
}
function buildObjectives() {
  const cols = {};
  G.objMesh = {};
  for (const o of G.info.objectives) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    beam.position.y = 7;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x777777 })); pole.position.y = 1.7;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); flag.position.set(0.47, 3.0, 0);
    g.add(beam, disc, pole, flag); g.position.set(o.x, 0, o.z); G.eng.scene.add(g);
    G.objMesh[o.id] = { beam, disc, flag }; G.objOwner[o.id] = null; G.objProg[o.id] = 0; void cols;
  }
}
function paintObj(id) {
  const o = G.objMesh[id], ow = G.objOwner[id], c = ow === 'blue' ? 0x2d7bd6 : ow === 'red' ? 0xd8352a : 0xdddddd;
  for (const k of ['beam', 'disc', 'flag']) o[k].material.color.setHex(c);
  const el = $('d' + id); el.className = ow === 'blue' ? 'b' : ow === 'red' ? 'r' : '';
}

// ---------- minimap ----------
function buildMinimap() {
  const S = 3, B = G.world.bounds, W = Math.ceil((B.x1 - B.x0) * S), H = Math.ceil((B.z1 - B.z0) * S);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#4f5c3c'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#6b6658';
  // đường: vẽ theo ô trống của nav (ô không bị chặn) nhạt hơn
  const nav = G.nav;
  x.fillStyle = '#7a7566';
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) if (!nav.blocked[j * nav.w + i]) { /* cỏ/đường như nhau */ }
  for (const b of G.world.boxes) {
    if (b.kind === 'wall' || b.kind === 'soft') {
      const tall = b.y1 > 2.2;
      x.fillStyle = tall ? '#2a2f33' : '#6f6a5a';
      x.fillRect((b.x0 - B.x0) * S, (b.z0 - B.z0) * S, Math.max(1, (b.x1 - b.x0) * S), Math.max(1, (b.z1 - b.z0) * S));
    }
  }
  G.mmBase = c; G.mmS = S;
}
function drawMinimap() {
  const cv = $('mm'), x = cv.getContext('2d'), P = G.P, k = 4.2, B = G.world.bounds, S = G.mmS, w = cv.width;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, w);
  x.save(); x.translate(w / 2, w / 2); x.rotate(P.yaw); x.scale(k / S, k / S);
  x.drawImage(G.mmBase, -(P.x - B.x0) * S, -(P.z - B.z0) * S);
  x.restore();
  x.save(); x.translate(w / 2, w / 2); x.rotate(P.yaw);
  const at = (px, pz) => [(px - P.x) * k, (pz - P.z) * k];
  for (const o of G.info.objectives) { const [a, b] = at(o.x, o.z), ow = G.objOwner[o.id]; if (G.mode !== 'dom') continue; x.fillStyle = ow === 'blue' ? '#2d7bd6' : ow === 'red' ? '#d8352a' : '#ddd'; x.beginPath(); x.arc(a, b, 11, 0, 6.283); x.globalAlpha = 0.45; x.fill(); x.globalAlpha = 1; x.save(); x.rotate(-P.yaw); x.fillStyle = '#fff'; x.font = '700 14px system-ui'; x.textAlign = 'center'; x.fillText(o.id, a, b + 5); x.restore(); }
  for (const u of G.units) {
    if (u === P || !u.alive) continue;
    const friend = !G.hostile(P, u);
    if (!friend && !(u.spotted > G.now || G.scanT > G.now)) continue;
    const [a, b] = at(u.x, u.z); x.fillStyle = friend ? '#4aa3ff' : '#ff3b30'; x.beginPath(); x.arc(a, b, 5, 0, 6.283); x.fill();
    if (!friend) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); }
  }
  if (G.ping) { const [a, b] = at(G.ping.x, G.ping.z); x.strokeStyle = '#ffd24a'; x.lineWidth = 2; x.beginPath(); x.arc(a, b, 8, 0, 6.283); x.stroke(); }
  x.restore();
  // mũi tên người chơi + nón nhìn
  x.save(); x.translate(w / 2, w / 2);
  x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 70, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -9); x.lineTo(6.5, 7); x.lineTo(0, 3.5); x.lineTo(-6.5, 7); x.closePath(); x.fill();
  x.restore();
}

// ---------- chiến đấu ----------
function hostile(a, b) { return a !== b && (G.mode === 'ffa' ? true : a.team !== b.team); }
function nearestEnemyYaw(u) {
  let best = null, bd = 1e9;
  for (const e of G.units) if (e.alive && hostile(u, e)) { const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < bd) { bd = d; best = e; } }
  return best ? Math.atan2(-(best.x - u.x), -(best.z - u.z)) : 0;
}
const _mz = new THREE.Vector3();
/** Bắn 1 phát: tia từ (ox,oy,oz) hướng (dx,dy,dz); vệt đạn vẽ từ nòng (mx,my,mz). */
function fireShot(by, mx, my, mz, ox, oy, oz, dx, dy, dz, W, mult) {
  const w = G.world;
  let tmax = W.range;
  const hw = w.raycast(ox, oy, oz, dx, dy, dz, tmax, true);
  if (hw) tmax = hw.t;
  // chỉ cho ra khỏi người bắn
  let hu = null, ht = tmax, zone = 'body';
  const us = G.units;
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    if (u === by || !u.alive || !hostile(by, u)) continue;
    const r = rayUnit(u, ox, oy, oz, dx, dy, dz, ht);
    if (r) { hu = u; ht = r.t; zone = r.zone; }
  }
  const t = hu ? ht : tmax;
  const hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
  G.fx.tracer(mx, my, mz, hx, hy, hz, by.isPlayer ? 0 : 1);
  G.fx.flash(mx, my, mz, by.isPlayer && !G.P.camFP ? 0.3 : 0.36);
  const P = G.P, dxp = mx - P.x, dzp = mz - P.z, dp = Math.hypot(dxp, dzp);
  if (by.isPlayer) sound.shot(W.snd, 1, 0); else { const rel = wrapPi(Math.atan2(-dxp, -dzp) - P.yaw); sound.shot(W.snd, Math.min(0.9, 14 / (dp + 6)), -Math.sin(rel)); }
  if (hu) {
    G.fx.blood(hx, hy, hz, -dx, 0.3, -dz);
    const mul = zone === 'head' ? 2.1 : zone === 'leg' ? 0.8 : 1;
    const falloff = 1 - Math.min(0.35, t / W.range * 0.4);
    damage(hu, W.dmg * mul * falloff * (mult || 1), by, zone, ox, oz);
    if (by.isPlayer) { hitMarker(zone === 'head', !hu.alive); sound.hit(zone === 'head'); }
  } else if (hw) {
    G.fx.spark(hx, hy, hz, hw.nx, hw.ny || 0.1, hw.nz, 4);
  } else if (hy < 0.03 + 0.001 && dy < 0) G.fx.spark(hx, 0.03, hz, 0, 1, 0, 3);
}
function damage(u, amt, by, zone, fx, fz) {
  if (!u.alive || u.invuln > 0) return;
  if (u.armor > 0) { const ab = Math.min(u.armor, amt * 0.55); u.armor -= ab; amt -= ab * 0.9; }
  u.hp -= amt;
  if (u.decoy) { if (u.hp <= 0) removeDecoy(u); return; }
  if (u.isPlayer) {
    const d = $('dmg'); d.classList.add('on'); clearTimeout(G.dmgT); G.dmgT = setTimeout(() => d.classList.remove('on'), 80);
    sound.hurt(); const rel = wrapPi(Math.atan2(-(fx - u.x), -(fz - u.z)) - u.yaw);
    const i = document.createElement('i'); i.style.transform = `rotate(${rel}rad)`; $('dirs').appendChild(i); setTimeout(() => i.remove(), 1200);
  }
  if (u.hp <= 0) kill(u, by, zone);
}
function kill(v, by, zone) {
  v.hp = 0; v.alive = false; v.deaths++;
  if (v.die) v.die();
  if (by && by !== v) { by.kills++; if (G.mode === 'tdm') G.score[by.team]++; else if (G.mode === 'ffa') G.score[by.name] = by.kills; }
  v.respT = v.isPlayer ? 5 : 4.5;
  if (v.isPlayer) { G.P.s.root.visible = true; showMsg('Bạn đã bị hạ gục' + (by ? ' bởi ' + by.name : '')); }
  if (by && by.isPlayer) showMsg(zone === 'head' ? 'BẮN TỈA ĐẦU!' : 'HẠ GỤC ' + v.name);
  const el = document.createElement('div'); if (by && (by.isPlayer || v.isPlayer)) el.className = 'me';
  const tag = (u) => `<span style="color:${u.isPlayer ? '#ffb02e' : G.mode === 'ffa' ? '#e0b341' : u.team === 'blue' ? '#6aaeff' : '#ff7468'}">${u.name}</span>`;
  el.innerHTML = by && by !== v ? `${tag(by)} ✕ ${tag(v)}${zone === 'head' ? ' ◎' : ''}` : `${tag(v)} tự hạ`;
  const f = $('feed'); f.appendChild(el); while (f.children.length > 5) f.firstChild.remove(); setTimeout(() => el.remove(), 6000);
  checkEnd();
}
function hitMarker(head, killed) { const h = $('hitm'); h.className = 'on' + (head || killed ? ' hs' : ''); void h.offsetWidth; requestAnimationFrame(() => (h.className = '')); }
let msgT = 0;
function showMsg(t) { const m = $('msg'); m.textContent = t; m.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('on'), 1800); }
function spawnPoint(u) {
  const sp = G.info.spawns; let list = G.mode === 'ffa' ? sp.blue.concat(sp.red) : (u.team === 'blue' ? sp.blue : sp.red);
  let best = list[0], bs = -1;
  for (let k = 0; k < 5; k++) {
    const c = list[Math.floor(Math.random() * list.length)]; let md = 1e9;
    for (const e of G.units) if (e.alive && hostile(u, e)) md = Math.min(md, Math.hypot(e.x - c.x, e.z - c.z));
    if (md > bs) { bs = md; best = c; }
  }
  return { x: best.x + (Math.random() - 0.5) * 1.2, z: best.z + (Math.random() - 0.5) * 1.2 };
}
function respawn(u) {
  const p = spawnPoint(u);
  if (u.isPlayer) {
    u.x = p.x; u.z = p.z; u.y = 0; u.vy = 0; u.hp = 100; u.armor = G.mode === 'ffa' ? 0 : 25; u.alive = true; u.invuln = 2.5; u.yaw = nearestEnemyYaw(u); u.pitch = 0;
    for (const g of u.guns) { g.mag = g.W.mag; g.res = g.W.reserve; } u.nades = 2; u.reloadT = 0; u.s.root.visible = false; u.s.dead = 0; u.s.mesh.rotation.x = 0; u.s.mesh.position.y = 0; $('respawn').style.display = 'none'; hudWeapons();
  } else u.spawn(p);
}

// ---------- lựu đạn, hologram ----------
function throwNade() {
  const P = G.P; if (!P.alive || P.nades <= 0 || P.nadeT > 0) return;
  const n = G.nades.find((q) => !q.on) || (G.nades.length < 8 ? (() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.6 })); G.eng.scene.add(m); const q = { m, on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, by: null }; G.nades.push(q); return q; })() : null);
  if (!n) return; P.nades--; P.nadeT = 0.8; $('nn').textContent = P.nades;
  const cp = Math.cos(P.pitch + 0.25), dirx = -Math.sin(P.yaw) * cp, dirz = -Math.cos(P.yaw) * cp, diry = Math.sin(P.pitch + 0.25);
  n.on = true; n.by = P; n.t = 1.8; n.m.visible = true;
  n.p.set(P.x, P.y + 1.5, P.z).addScaledVector(new THREE.Vector3(dirx, 0, dirz), 0.5); n.v.set(dirx * 13, diry * 13 + 1.5, dirz * 13);
}
function stepNades(dt) {
  const w = G.world;
  for (const n of G.nades) {
    if (!n.on) continue;
    n.t -= dt; n.v.y -= 14 * dt;
    // từng trục để phản xạ khi chạm hộp
    for (let a = 0; a < 3; a++) {
      const ox = n.p.x, oy = n.p.y, oz = n.p.z;
      if (a === 0) n.p.x += n.v.x * dt; else if (a === 1) n.p.y += n.v.y * dt; else n.p.z += n.v.z * dt;
      let hit = false;
      w.near(n.p.x, n.p.z, 0.3, (b) => { if (n.p.x > b.x0 && n.p.x < b.x1 && n.p.z > b.z0 && n.p.z < b.z1 && n.p.y > b.y0 && n.p.y < b.y1) hit = true; });
      if (a === 1 && n.p.y < 0.06) { n.p.y = 0.06; n.v.y *= -0.35; n.v.x *= 0.75; n.v.z *= 0.75; if (Math.abs(n.v.y) < 0.8) n.v.y = 0; }
      else if (hit) { n.p.set(ox, oy, oz); if (a === 0) n.v.x *= -0.4; else if (a === 1) { n.v.y *= -0.3; n.v.x *= 0.8; n.v.z *= 0.8; } else n.v.z *= -0.4; }
    }
    n.m.position.copy(n.p);
    if (n.t <= 0) {
      n.on = false; n.m.visible = false; G.fx.explosion(n.p.x, n.p.y, n.p.z);
      const rel = wrapPi(Math.atan2(-(n.p.x - G.P.x), -(n.p.z - G.P.z)) - G.P.yaw), dp = Math.hypot(n.p.x - G.P.x, n.p.z - G.P.z);
      sound.explode(Math.min(1, 18 / (dp + 6)), -Math.sin(rel));
      for (const u of G.units.slice()) {
        if (!u.alive) continue;
        const d = Math.hypot(u.x - n.p.x, u.y + 0.9 - n.p.y, u.z - n.p.z);
        if (d > 7.5) continue;
        if (!w.los(n.p, { x: u.x, y: u.y + 0.9, z: u.z })) continue;
        const dm = 140 * Math.pow(1 - d / 7.5, 1.3) * (u === n.by ? 0.5 : 1);
        if (dm > 1) { const by = n.by; if (u.isPlayer || hostile(by, u) || u === by) damage(u, dm, by, 'body', n.p.x, n.p.z); }
      }
    }
  }
}
let holo = null;
function spawnHolo() {
  const P = G.P; if (!P.alive || G.holoCd > 0) return;
  if (holo) removeDecoy(holo);
  const s = new Soldier('blue'); s.mesh.material = s.mesh.material.clone(); const m = s.mesh.material; m.transparent = true; m.opacity = 0.55; m.emissive = new THREE.Color(0x2fd0ff); m.emissiveIntensity = 0.6; s.mesh.castShadow = false;
  s.setWeapon(BUILDERS.ak12(), false);
  const d = { decoy: true, isDecoy: true, team: P.team, name: 'Hologram', x: P.x - Math.sin(P.yaw) * 5, y: P.y, z: P.z - Math.cos(P.yaw) * 5, yaw: P.yaw, crouch: 0, hp: 40, armor: 0, alive: true, invuln: 0, kills: 0, deaths: 0, life: 14, s, spotted: 0, speed: 0 };
  G.world.move(d, 0, 0, 0.34, 1.7);
  s.root.position.set(d.x, d.y, d.z); s.root.rotation.y = d.yaw; G.eng.scene.add(s.root); s.update(0.3, { speed: 0 });
  G.units.push(d); holo = d; G.holoCd = 22; showMsg('HOLOGRAM đã triển khai');
}
function removeDecoy(d) { d.alive = false; G.eng.scene.remove(d.s.root); const i = G.units.indexOf(d); if (i >= 0) G.units.splice(i, 1); if (holo === d) holo = null; }

// ---------- trận đấu ----------
function startMatch() {
  const eng = G.eng;
  G.mode = mode; G.running = true; G.paused = false; G.over = false; G.now = 0;
  const cfg = MODES[mode]; G.t = cfg.time; G.score = { blue: 0, red: 0 }; G.domAcc = 0;
  for (const u of G.units) if (u.s && !u.isPlayer) eng.scene.remove(u.s.root);
  for (const n of G.nades) { n.on = false; n.m.visible = false; }
  if (holo) removeDecoy(holo);
  G.holoCd = 0; G.scanCd = 0; G.cmdCd = 0; G.scanT = 0; G.ping = null; G.pathQ.length = 0; G.units = []; G.bots = [];
  const P = G.P; P.kills = 0; P.deaths = 0; P.team = 'blue'; G.units.push(P);
  const mk = (team, pal, kind) => { const b = new Bot(G, team, pal, kind); eng.scene.add(b.s.root); G.units.push(b); G.bots.push(b); return b; };
  if (mode === 'ffa') { for (let i = 0; i < 7; i++) mk('f' + i, 'free', i % 3 ? 'ak12' : 'mp7'); G.score = {}; }
  else { for (let i = 0; i < 4; i++) mk('blue', 'blue', i % 3 ? 'ak12' : 'mp7'); for (let i = 0; i < 5; i++) mk('red', 'red', i % 3 ? 'ak12' : 'mp7'); }
  for (const id in G.objOwner) { G.objOwner[id] = null; G.objProg[id] = 0; paintObj(id); }
  for (const id in G.objMesh) for (const k of ['beam', 'disc', 'flag']) G.objMesh[id][k].visible = mode === 'dom';
  $('doms').style.display = mode === 'dom' ? 'flex' : 'none';
  $('goal').textContent = cfg.label + ' · ' + cfg.goalTxt;
  P.alive = false; respawn(P); P.alive = true; P.hp = 100;
  for (const b of G.bots) { G.units.splice(G.units.indexOf(b), 1); G.units.push(b); b.alive = false; respawn(b); }
  for (const it of G.items) { it.cd = 0; it.mesh.visible = true; }
  P.slot = -1; P.guns[1].have = false; selectSlot(0); P.nades = 2; $('nn').textContent = 2;
  P.vmGuns.forEach((o, k) => (o.visible = k === 0)); P.camFP = !input.touch ? false : false; $('bCam').textContent = 'TPP';
  $('menu').classList.add('hide'); $('end').classList.add('hide'); $('pause').classList.add('hide'); $('hud').classList.remove('off'); $('respawn').style.display = 'none';
  $('feed').innerHTML = ''; hudWeapons();
  input.active = true; input.take(); P.fireT = 0.3;
  if (!input.touch) $('game').requestPointerLock?.();
  showMsg(mode === 'dom' ? 'Chiếm các điểm A · B · C' : mode === 'ffa' ? 'Hạ gục nhiều nhất!' : 'Hạ gục đội đối phương!');
}
function checkEnd() {
  if (G.over) return;
  const cfg = MODES[G.mode]; let win = null;
  if (G.mode === 'ffa') { const top = G.units.filter((u) => !u.decoy).sort((a, b) => b.kills - a.kills)[0]; if (top.kills >= cfg.goal || G.t <= 0) win = top; }
  else if (G.score.blue >= cfg.goal || G.score.red >= cfg.goal || G.t <= 0) win = G.score.blue === G.score.red ? 'draw' : G.score.blue > G.score.red ? 'blue' : 'red';
  if (win) endMatch(win);
}
function endMatch(win) {
  G.over = true; G.running = false; input.active = false; input.fire = false; document.exitPointerLock?.();
  const me = G.mode === 'ffa' ? win === G.P : win === 'blue';
  $('etitle').textContent = win === 'draw' ? 'HOÀ' : me ? 'CHIẾN THẮNG' : 'THẤT BẠI'; $('etitle').style.color = win === 'draw' ? '#ddd' : me ? '#ffb02e' : '#ff6a5e';
  const rows = G.units.filter((u) => !u.decoy).sort((a, b) => b.kills - a.kills).map((u) => `<div class="${u.isPlayer ? 'me' : ''}"><span>${u.name}${G.mode !== 'ffa' ? ' · ' + (u.team === 'blue' ? 'Xanh' : 'Đỏ') : ''}</span><span>${u.kills} hạ · ${u.deaths} chết</span></div>`);
  $('etable').innerHTML = (G.mode !== 'ffa' ? `<div><b>Xanh ${G.score.blue}</b><b>Đỏ ${G.score.red}</b></div>` : '') + rows.join('');
  if (me) sound.win();
  store.set('ff_matches', String(+store.get('ff_matches', '0') + 1)); store.set('ff_kills', String(+store.get('ff_kills', '0') + G.P.kills)); stats();
  setTimeout(() => { $('end').classList.remove('hide'); }, 900);
}

// ---------- HUD ----------
const hc = {};
const setT = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } };
function hudWeapons() {
  const P = G.P; $('wlist').innerHTML = P.guns.map((g, i) => g.have ? `<i class="${i === P.slot ? 'on' : ''}">${i + 1}</i>` : '').join('');
  setT('wname', curGun().W.name);
}
function hudUpdate() {
  const P = G.P, g = curGun();
  const hp = Math.ceil(P.hp), ar = Math.ceil(P.armor);
  if (hc.hp !== hp) { hc.hp = hp; $('hpf').style.transform = `scaleX(${clamp(hp / 100, 0, 1)})`; $('hpt').textContent = hp; $('hpf').parentNode.classList.toggle('low', hp < 30); }
  if (hc.ar !== ar) { hc.ar = ar; $('arf').style.transform = `scaleX(${clamp(ar / 100, 0, 1)})`; $('art').textContent = ar; }
  const w = $('wammo'); const h = `<b>${g.mag}</b><span>/${g.res}</span>`; if (hc.wa !== h) { hc.wa = h; w.innerHTML = h; }
  if (G.mode === 'ffa') { setT('sb', P.kills); const top = Math.max(...G.units.filter((u) => u !== P && !u.decoy).map((u) => u.kills), 0); setT('sr', top); }
  else if (G.mode === 'dom') { setT('sb', Math.floor(G.score.blue)); setT('sr', Math.floor(G.score.red)); }
  else { setT('sb', G.score.blue); setT('sr', G.score.red); }
  setT('timer', fmtTime(G.t));
  const sk = [['kHolo', G.holoCd], ['kScan', G.scanCd], ['kCmd', G.cmdCd]];
  for (const [id, cd] of sk) { const b = $(id); const on = cd > 0; if (hc[id] !== on) { hc[id] = on; b.classList.toggle('cd', on); } if (on) { const e = b.querySelector('em'); const t = Math.ceil(cd); if (hc[id + 't'] !== t) { hc[id + 't'] = t; e.textContent = t + 's'; } } }
  const sp = (P.speed > 1 ? 5 : 0) + (P.grounded ? 0 : 9) + P.kick * 600 + (P.ads > 0.5 ? -4 : 0);
  const sq = Math.round(Math.max(0, sp) / 2) * 2; if (hc.sp !== sq) { hc.sp = sq; $('cross').style.setProperty('--sp', sq + 'px'); }
  const co = P.ads > 0.6 && P.camFP ? 0.2 : 1; if (hc.co !== co) { hc.co = co; $('cross').style.opacity = co; }
  const rs = $('respawn'); if (!P.alive) { rs.style.display = 'block'; rs.textContent = 'Hồi sinh sau ' + Math.ceil(P.respT) + 's'; }
}
function drawOverlay() {
  const c = G.mkc, cam = G.eng.camera, W = G.mk.width, H = G.mk.height; c.clearRect(0, 0, W, H);
  const v = G._v || (G._v = new THREE.Vector3());
  const proj = (x, y, z) => { v.set(x, y, z).project(cam); return v.z < 1 && v.z > -1 ? [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H] : null; };
  c.font = '700 13px system-ui'; c.textAlign = 'center';
  if (G.mode === 'dom') for (const o of G.info.objectives) { const p = proj(o.x, 4.2, o.z); if (!p) continue; const ow = G.objOwner[o.id], d = Math.hypot(o.x - G.P.x, o.z - G.P.z); c.fillStyle = ow === 'blue' ? '#2d7bd6' : ow === 'red' ? '#d8352a' : '#ddd'; c.beginPath(); c.arc(p[0], p[1], 13, 0, 6.283); c.fill(); c.fillStyle = '#fff'; c.fillText(o.id, p[0], p[1] + 5); c.font = '600 11px system-ui'; c.fillText(Math.round(d) + 'm', p[0], p[1] + 28); c.font = '700 13px system-ui'; }
  // đồng đội
  for (const u of G.units) {
    if (u === G.P || !u.alive || u.decoy) continue;
    const friend = !hostile(G.P, u), shown = !friend && (G.scanT > G.now || u.spotted > G.now);
    if (!friend && !shown) continue;
    const p = proj(u.x, u.y + 2.1, u.z); if (!p) continue;
    if (friend) { c.fillStyle = '#4aa3ff'; c.beginPath(); c.moveTo(p[0], p[1] + 2); c.lineTo(p[0] - 5, p[1] - 6); c.lineTo(p[0] + 5, p[1] - 6); c.fill(); c.fillStyle = '#fff'; c.font = '600 11px system-ui'; c.fillText(u.name, p[0], p[1] - 10); c.font = '700 13px system-ui'; }
    else { c.strokeStyle = '#ff3b30'; c.lineWidth = 2; c.beginPath(); c.moveTo(p[0], p[1] - 9); c.lineTo(p[0] + 9, p[1]); c.lineTo(p[0], p[1] + 9); c.lineTo(p[0] - 9, p[1]); c.closePath(); c.stroke(); }
  }
  if (G.ping) { const p = proj(G.ping.x, G.ping.y + 1, G.ping.z); if (p) { c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(p[0], p[1] + 10); c.lineTo(p[0] - 9, p[1] - 8); c.lineTo(p[0] + 9, p[1] - 8); c.fill(); c.fillStyle = '#fff'; c.font = '600 11px system-ui'; c.fillText(Math.round(Math.hypot(G.ping.x - G.P.x, G.ping.z - G.P.z)) + 'm', p[0], p[1] - 14); c.font = '700 13px system-ui'; } }
}

// ---------- vòng lặp ----------
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (window.__manual || (!G.running && !G.over)) return;
  if (G.paused) return;
  const t0 = performance.now();
  update(dt);
  render(dt);
  adapt(now, performance.now() - t0, dt);
}
function adapt(now, cpu, dt) {
  G.ft = G.ft * 0.95 + dt * 1000 * 0.05;
  if (now - (G.lastAdapt || 0) < 1500) return;
  G.lastAdapt = now;
  if (G.ft > 22 && G.effScale > 0.6) { G.effScale = Math.max(0.6, G.effScale - 0.1); G.eng.setScale(G.effScale); }
  else if (G.ft < 14.5 && G.effScale < 1) { G.effScale = Math.min(1, G.effScale + 0.05); G.eng.setScale(G.effScale); }
}
const _f = new THREE.Vector3();
function update(dt) {
  const P = G.P, e = input.e;
  input.poll();
  if (e.pause) { e.pause = 0; if (G.running) { pause(); return; } }
  G.now += dt;
  if (G.running) { G.t -= dt; if (G.t <= 0) { G.t = 0; checkEnd(); } }
  // đếm ngược kỹ năng
  if (G.holoCd > 0) G.holoCd -= dt; if (G.scanCd > 0) G.scanCd -= dt; if (G.cmdCd > 0) G.cmdCd -= dt; if (P.nadeT > 0) P.nadeT -= dt;
  if (P.invuln > 0) P.invuln -= dt;
  // ---- người chơi ----
  const [lx, ly] = input.take();
  if (P.alive) {
    const adsK = P.ads > 0.3 ? 0.6 : 1;
    P.yaw -= lx * adsK; P.pitch = clamp(P.pitch - ly * adsK, -1.35, 1.25);
    P.kickY *= 1; P.kick = damp(P.kick, 0, 7, dt);
    const gun = curGun();
    const wantAds = input.ads && P.reloadT <= 0;
    P.ads = damp(P.ads, wantAds ? 1 : 0, 14, dt);
    P.crouch = input.crouchT ? 1 : 0; P.crouchK = damp(P.crouchK, P.crouch, 12, dt);
    const sp = (P.crouch ? 2.3 : 4.6) * (P.ads > 0.5 ? 0.6 : 1) * (P.reloadT > 0 ? 0.85 : 1);
    let mx = input.mx, mz = input.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tvx = (fx * mz + rx * mx) * sp, tvz = (fz * mz + rz * mx) * sp;
    const ac = P.grounded ? 14 : 3;
    P.velX = damp(P.velX, tvx, ac, dt); P.velZ = damp(P.velZ, tvz, ac, dt);
    const px = P.x, pz = P.z;
    G.world.move(P, P.velX * dt, P.velZ * dt, 0.34, P.crouch ? 1.3 : 1.75, 0.5);
    P.speed = Math.hypot(P.x - px, P.z - pz) / dt;
    if (e.jump) { e.jump = 0; if (P.grounded && !P.crouch) { P.vy = 5.0; P.grounded = false; } }
    P.vy -= 16 * dt; P.y += P.vy * dt;
    const gr = G.world.groundAt(P.x, P.z, 0.3, P.y, 0.5);
    if (P.y <= gr + 0.001 || (P.grounded && P.vy <= 0 && P.y - gr < 0.22)) { P.y = gr; P.vy = 0; P.grounded = true; } else P.grounded = false;
    // vũ khí
    if (e.reload) { e.reload = 0; startReload(); }
    if (e.swap) { e.swap = 0; let i = P.slot; for (let k = 0; k < 3; k++) { i = (i + 1) % 3; if (P.guns[i].have) { selectSlot(i); break; } } }
    if (e.slot >= 0) { selectSlot(e.slot); e.slot = -1; } else if (e.slot <= -2) { const dr = e.slot === -3 ? 1 : -1; let i = P.slot; for (let k = 0; k < 3; k++) { i = (i + dr + 3) % 3; if (P.guns[i].have) { selectSlot(i); break; } } e.slot = -1; }
    if (e.nade) { e.nade = 0; throwNade(); }
    if (e.holo) { e.holo = 0; spawnHolo(); }
    if (e.scan) { e.scan = 0; if (G.scanCd <= 0) { G.scanT = G.now + 6; G.scanCd = 20; sound.scan(); showMsg('QUÉT: kẻ địch bị lộ 6 giây'); } }
    if (e.cmd) { e.cmd = 0; doPing(); }
    if (e.emote) { e.emote = 0; P.emoteT = 2.6; }
    if (e.cam) { e.cam = 0; P.camFP = !P.camFP; $('bCam').textContent = P.camFP ? 'FPP' : 'TPP'; }
    P.fireT -= dt; if (P.swapT > 0) P.swapT -= dt; P.firing = Math.max(0, P.firing - dt * 5);
    if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) finishReload(); }
    if (P.emoteT > 0) { P.emoteT -= dt; if (input.fire || P.speed > 1) P.emoteT = 0; }
    if (input.fire && P.fireT <= 0 && P.reloadT <= 0 && !(P.swapT > 0) && P.emoteT <= 0 && (gun.W.auto || !P.held)) playerShoot(gun);
    P.held = input.fire;
    if (!input.fire && gun.mag === 0 && gun.res > 0 && P.reloadT <= 0) startReload();
    // nhặt vật phẩm
    for (const it of G.items) if (it.cd <= 0 && Math.abs(it.x - P.x) < 1.1 && Math.abs(it.z - P.z) < 1.1) pickup(it);
  } else {
    e.jump = e.reload = e.swap = e.nade = e.holo = e.scan = e.cmd = e.emote = e.cam = 0; e.slot = -1;
    P.respT -= dt; if (P.respT <= 0) respawn(P);
    P.ads = damp(P.ads, 0, 10, dt);
  }
  for (const it of G.items) { if (it.cd > 0) { it.cd -= dt; if (it.cd <= 0) it.mesh.visible = true; } else { it.mesh.rotation.y += dt * 1.8; it.mesh.position.y = 1.0 + Math.sin(G.now * 2 + it.x) * 0.06; } }
  // ---- bot ----
  if (G.pathQ.length) { const b = G.pathQ.shift(); if (b.alive && b.goal) { b.path = G.nav.path(b, b.goal); b.pi = 0; b.pathReq = false; } else b.pathReq = false; }
  for (const b of G.bots) b.update(dt);
  stepNades(dt);
  // hologram sống
  for (const u of G.units) if (u.decoy) { u.life -= dt; u.s.update(dt, { speed: 0 }); if (u.life <= 0) { removeDecoy(u); break; } }
  // chế độ chiếm điểm
  if (G.mode === 'dom' && G.running) stepDom(dt);
  G.fx.update(dt);
  if (G.running) checkEnd();
}
function stepDom(dt) {
  G.domAcc += dt;
  for (const o of G.info.objectives) {
    let b = 0, r = 0;
    for (const u of G.units) if (u.alive && !u.decoy && Math.hypot(u.x - o.x, u.z - o.z) < 5) { if (u.team === 'blue') b++; else r++; }
    if (b !== r) {
      const prev = G.objOwner[o.id];
      G.objProg[o.id] = clamp(G.objProg[o.id] + (b - r > 0 ? 1 : -1) * Math.min(2, Math.abs(b - r)) * dt * 0.14, -1, 1);
      const p = G.objProg[o.id], ow = p >= 1 ? 'blue' : p <= -1 ? 'red' : (Math.abs(p) < 0.05 ? null : prev);
      const nw = p >= 0.999 ? 'blue' : p <= -0.999 ? 'red' : prev;
      if (nw !== prev) { G.objOwner[o.id] = nw; paintObj(o.id); showMsg(`Điểm ${o.id} thuộc về ${nw === 'blue' ? 'đội XANH' : 'đội ĐỎ'}`); } void ow;
    }
  }
  if (G.domAcc >= 1) { G.domAcc -= 1; for (const o of G.info.objectives) { const ow = G.objOwner[o.id]; if (ow) G.score[ow] += 1; } }
}
function doPing() {
  if (G.cmdCd > 0) return;
  const cam = G.eng.camera; cam.getWorldDirection(_f);
  const h = G.world.raycast(cam.position.x, cam.position.y, cam.position.z, _f.x, _f.y, _f.z, 120, true);
  let t = h ? h.t : 40, x = cam.position.x + _f.x * t, y = cam.position.y + _f.y * t, z = cam.position.z + _f.z * t;
  if (_f.y < -0.01) { const tg = -cam.position.y / _f.y; if (tg < t) { t = tg; x = cam.position.x + _f.x * t; y = 0; z = cam.position.z + _f.z * t; } }
  G.ping = { x, y: Math.max(0, y), z }; G.cmdCd = 6; sound.ping(); showMsg('Đồng đội đang di chuyển tới điểm đánh dấu');
  clearTimeout(G.pingT); G.pingT = setTimeout(() => (G.ping = null), 8000);
  if (G.mode !== 'ffa') for (const b of G.bots) if (b.team === 'blue') { b.cmd = { x, z }; b.cmdT = 14; b.goal = null; b.path.length = 0; }
}
function startReload() {
  const P = G.P, g = curGun();
  if (P.reloadT > 0 || g.mag >= g.W.mag || g.res <= 0) return;
  P.reloadT = g.W.reload; sound.reload();
}
function finishReload() { const g = curGun(), n = Math.min(g.W.mag - g.mag, g.res); g.mag += n; g.res -= n; }
function pickup(it) {
  const P = G.P; let ok = false;
  if (it.type === 'med' && P.hp < 100) { P.hp = Math.min(100, P.hp + 50); ok = true; }
  else if (it.type === 'armor' && P.armor < 100) { P.armor = Math.min(100, P.armor + 50); ok = true; }
  else if (it.type === 'ammo') { for (const g of P.guns) g.res = Math.min(g.W.reserve * 2, g.res + g.W.mag * 2); P.nades = Math.min(3, P.nades + 1); $('nn').textContent = P.nades; ok = true; }
  else if (it.type === 'mp7') { const g = P.guns[1]; if (!g.have) { g.have = true; g.mag = g.W.mag; g.res = g.W.reserve; hudWeapons(); showMsg('Nhặt được MP7 (phím 2)'); ok = true; } else if (g.res < g.W.reserve * 2) { g.res += g.W.mag; ok = true; } }
  if (ok) { it.cd = 20; it.mesh.visible = false; sound.pick(); }
}
function playerShoot(g) {
  const P = G.P, W = g.W;
  if (g.mag <= 0) { if (P.fireT <= 0) { sound.click(); P.fireT = 0.25; if (g.res > 0) startReload(); } return; }
  g.mag--; P.fireT = 60 / W.rpm; P.firing = 1;
  const cam = G.eng.camera; cam.updateMatrixWorld();
  cam.getWorldDirection(_f);
  const mv = P.speed > 1 ? 1.8 : 1, cr = P.crouch ? 0.7 : 1, air = P.grounded ? 1 : 3, ad = 1 - P.ads * 0.6;
  const sp = W.spread * mv * cr * air * ad + P.kick * 0.25;
  const rx = (Math.random() - 0.5) * 2 * sp, ry = (Math.random() - 0.5) * 2 * sp;
  _f.x += rx; _f.y += ry; _f.z += (Math.random() - 0.5) * sp; _f.normalize();
  // vị trí nòng
  let mx, my, mz;
  if (P.camFP) { _mz.copy(P.vmGuns[P.slot].userData.muzzle); P.vm.updateMatrix(); _mz.applyMatrix4(P.vm.matrix).applyMatrix4(cam.matrixWorld); mx = _mz.x; my = _mz.y; mz = _mz.z; }
  else { const tg = P.tpGuns[P.slot]; tg.updateWorldMatrix(true, false); _mz.copy(tg.userData.muzzle); tg.localToWorld(_mz); mx = _mz.x; my = _mz.y; mz = _mz.z; }
  fireShot(P, mx, my, mz, cam.position.x, cam.position.y, cam.position.z, _f.x, _f.y, _f.z, W, 1);
  const k = W.recoil * (P.ads > 0.5 ? 0.7 : 1) * (P.crouch ? 0.8 : 1);
  P.pitch = Math.min(1.3, P.pitch + k * 0.7); P.yaw += (Math.random() - 0.5) * k * 0.6; P.kick = Math.min(0.12, P.kick + k * 1.2);
  P.vmKick = 1;
}

// ---------- camera + hiển thị ----------
const _cp = new THREE.Vector3();
function render(dt) {
  const eng = G.eng, P = G.P, cam = eng.camera;
  const crouchY = 1.65 - P.crouchK * 0.45;
  const fov0 = 66, fov = fov0 - P.ads * (P.camFP ? 22 : 16);
  if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  const pitch = P.pitch;
  const cp = Math.cos(pitch), fx = -Math.sin(P.yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(P.yaw) * cp;
  const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const useFP = P.camFP && P.alive;
  if (useFP) {
    cam.position.set(P.x, P.y + crouchY, P.z);
    cam.lookAt(P.x + fx, P.y + crouchY + fy, P.z + fz);
  } else {
    const px = P.x, py = P.y + crouchY - 0.1, pz = P.z;
    const back = 3.0 - P.ads * 1.4, side = 0.75 - P.ads * 0.2;
    let dx = -fx * back + rx * side, dy = -fy * back + 0.15, dz = -fz * back + rz * side;
    const dl = Math.hypot(dx, dy, dz);
    // chống xuyên tường: bắn tia từ vai tới camera
    const h = G.world.raycast(px, py, pz, dx / dl, dy / dl, dz / dl, dl + 0.25, true);
    const tt = h ? Math.max(0.35, h.t - 0.25) : dl;
    cam.position.set(px + dx / dl * tt, Math.max(0.2, py + dy / dl * tt), pz + dz / dl * tt);
    // điểm ngắm xa phía trước
    cam.lookAt(px + rx * (side * 0.6) + fx * 40, py + fy * 40 + 0.0, pz + rz * (side * 0.6) + fz * 40);
    if (!P.alive) { /* giữ camera ở vị trí chết */ }
  }
  // soldier người chơi
  const s = P.s; s.root.visible = !useFP;
  if (!useFP) {
    s.root.position.set(P.x, P.y, P.z); s.root.rotation.y = P.yaw;
    s.update(dt, { speed: P.speed, crouch: !!P.crouch, pitch, firing: P.firing > 0.25, reloading: P.reloadT > 0, dead: !P.alive, emote: P.emoteT > 0 });
  } else s.update(dt * 0.0001, { speed: 0 });
  // viewmodel
  eng.showVM = useFP;
  if (useFP) {
    P.vmKick = damp(P.vmKick || 0, 0, 18, dt);
    const vm = P.vm, bob = Math.sin(G.now * 9) * 0.004 * Math.min(1, P.speed / 4) * (1 - P.ads);
    const sway = P.speed > 1 ? Math.sin(G.now * 4.5) * 0.004 * (1 - P.ads) : 0;
    const rl = P.reloadT > 0 ? Math.sin(Math.min(1, 1 - P.reloadT / curGun().W.reload) * Math.PI) : 0;
    const A = P.ads, sg = P.vmGuns[P.slot].userData.sight;
    vm.position.set(0.13 * (1 - A) - 0.82 * sg.x * A + sway, -0.2 + A * (0.2 - 0.82 * sg.y - 0.006) + bob - rl * 0.1, -0.5 + A * -0.07 + P.vmKick * 0.03 + rl * 0.04);
    vm.rotation.set(P.vmKick * 0.04 + rl * 0.5, 0.03 * (1 - A) + rl * 0.15, rl * 0.3);
    P.vmGuns.forEach((o, k) => { o.visible = k === P.slot; });
    if (P.slot === 2) { P.hL.position.set(0, -0.05, 0.0); } else { P.hL.position.set(-0.012, -0.075, -0.4); }
  }
  eng.followShadow(P.x, 0, P.z);
  G.fx.setCamera(cam, eng.renderer);
  eng.render();
  if ((G.fcount++ & 1) === 0) drawMinimap();
  drawOverlay(); hudUpdate();
}

// kiểm thử / gỡ lỗi
window.__G = () => G;
window.__start = (m) => { selMode(m); sound.unlock(); return boot('med', () => {}).then(() => startMatch()); };
window.__step = (n, dt = 0.05) => { for (let i = 0; i < n && G.running; i++) update(dt); render(dt); return { t: G.t, score: G.score, p: [G.P.x, G.P.y, G.P.z, G.P.hp], alive: G.units.filter((u) => u.alive).length }; };
window.__input = input;
window.__sim = (dt = 0.05) => { update(dt); return G.running; };
