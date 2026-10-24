// Bot: cảm nhận (tầm nhìn + LOS), chiến đấu (né/bắn theo loạt, sai số theo khoảng cách), di chuyển theo Nav A*.
import { Soldier } from '../models/soldier.js';
import { BUILDERS } from '../models/weapons.js';
import { WEAPONS, rayUnit } from './combat.js';
import { damp, dampAngle, wrapPi } from '../core/util.js';

const NAMES = ['Hùng', 'Lan', 'Minh', 'Tuấn', 'Vy', 'Khoa', 'Nam', 'Hà', 'Phát', 'Linh', 'Bảo', 'Quân', 'Trang', 'Đạt', 'Mai', 'Sơn'];
let nameI = Math.floor(Math.random() * 16);
const _a = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 };

export class Bot {
  constructor(G, team, pal, kind) {
    this.G = G; this.isBot = true; this.team = team; this.name = NAMES[nameI++ % NAMES.length];
    this.kind = kind; this.W = WEAPONS[kind];
    this.s = new Soldier(pal); this.s.setWeapon(BUILDERS[kind](), false);
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0; this.crouch = 0; this.speed = 0;
    this.hp = 100; this.armor = 0; this.alive = false; this.kills = 0; this.deaths = 0; this.respT = 0.5; this.invuln = 0;
    this.target = null; this.lastSeen = { x: 0, z: 0 }; this.lost = 9; this.react = 0; this.senseT = Math.random() * 0.2;
    this.path = []; this.pi = 0; this.goal = null; this.pathReq = false; this.stuckT = 0; this.sx = 0; this.sz = 0;
    this.fireT = 0; this.burst = 0; this.mag = this.W.mag; this.reloadT = 0; this.strafe = 1; this.strafeT = 0; this.cmdT = 0; this.cmd = null; this.firing = 0;
    this.spotted = 0; this.dirty = 0;
    this.s.root.visible = false;
  }
  spawn(p) {
    this.x = p.x; this.z = p.z; this.y = 0; this.hp = 100; this.armor = this.G.mode === 'ffa' ? 0 : 25; this.alive = true; this.invuln = 2; this.mag = this.W.mag;
    this.target = null; this.path.length = 0; this.goal = null; this.lost = 9; this.reloadT = 0; this.cmd = null;
    this.yaw = this.G.nearestEnemyYaw(this); this.s.root.visible = true; this.s.dead = 0; this.s.mesh.rotation.x = 0; this.s.mesh.position.y = 0;
  }
  die() { this.alive = false; this.respT = 4.5; this.target = null; this.path.length = 0; }
  eyeY() { return this.y + (this.crouch > 0.5 ? 1.15 : 1.6); }
  sense() {
    const G = this.G, units = G.units, ex = this.x, ez = this.z, ey = this.eyeY();
    let best = null, bd = this.target && this.lost < 1 ? 1e9 : 1e9;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u === this || !u.alive || !G.hostile(this, u) || u.invuln > 0) continue;
      const dx = u.x - ex, dz = u.z - ez, d = Math.hypot(dx, dz);
      if (d > 75) continue;
      const inFov = (dx * fx + dz * fz) / (d || 1) > 0.45 || d < 9 || (this.target === u && d < 45);
      if (!inFov) continue;
      if (d < bd) {
        _a.x = ex; _a.y = ey; _a.z = ez; _b.x = u.x; _b.y = u.y + (u.crouch > 0.5 ? 0.9 : 1.3); _b.z = u.z;
        if (G.world.los(_a, _b)) { best = u; bd = d; }
      }
    }
    if (best) {
      if (this.target !== best) this.react = 0.28 + Math.random() * 0.35;
      this.target = best; this.lost = 0; this.lastSeen.x = best.x; this.lastSeen.z = best.z; best.spotted = G.now + 1.2;
    } else if (this.target) { this.lost += 0.2; if (this.lost > 1.3) this.target = null; }
  }
  pickGoal() {
    const G = this.G, o = G.info.objectives;
    let g;
    if (this.cmd && this.cmdT > 0) g = this.cmd;
    else if (G.mode === 'dom') {
      const c = o.filter((p) => G.objOwner[p.id] !== this.team); g = (c.length ? c : o)[Math.floor(Math.random() * (c.length ? c.length : o.length))];
    } else {
      const hot = G.hotspots; g = hot[Math.floor(Math.random() * hot.length)];
      if (G.mode === 'tdm' && Math.random() < 0.5) { const e = G.units.find((u) => u.alive && G.hostile(this, u)); if (e) g = { x: e.x, z: e.z }; }
    }
    this.goal = { x: g.x + (Math.random() - 0.5) * 6, z: g.z + (Math.random() - 0.5) * 6 };
    this.pathReq = true; G.pathQ.push(this);
  }
  update(dt) {
    const G = this.G, W = this.W;
    if (!this.alive) {
      this.s.update(dt, { speed: 0, dead: true });
      this.respT -= dt; if (this.respT <= 0) G.respawn(this);
      return;
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.cmdT > 0) this.cmdT -= dt;
    this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.18 + Math.random() * 0.1; this.sense(); }
    let mvx = 0, mvz = 0, run = 4.2, want = this.yaw, fire = false;
    const tg = this.target;
    this.firing = Math.max(0, this.firing - dt * 4);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.mag = W.mag; }
    if (tg && this.lost < 0.6) {
      const dx = tg.x - this.x, dz = tg.z - this.z, d = Math.hypot(dx, dz) || 1;
      want = Math.atan2(-dx, -dz);
      this.react -= dt;
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 1.3; this.strafe = Math.random() < 0.5 ? -1 : 1; }
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if (d > 28) { mvx += fx; mvz += fz; run = 3.4; } else if (d < 9) { mvx -= fx * 0.6; mvz -= fz * 0.6; }
      mvx += rx * this.strafe * 0.8; mvz += rz * this.strafe * 0.8;
      this.crouch = d > 16 && this.strafeT < 0.5 ? 1 : 0; run = this.crouch ? 1.8 : 2.6;
      const err = Math.abs(wrapPi(want - this.yaw));
      if (this.react <= 0 && err < 0.12 && this.reloadT <= 0) fire = true;
      this.aimY = tg.y + (tg.crouch > 0.5 ? 0.95 : 1.35); this.aimD = d;
      this.pitch = damp(this.pitch, Math.atan2(this.aimY - this.eyeY(), d), 10, dt);
      this.yaw = dampAngle(this.yaw, want, 8, dt);
    } else {
      this.crouch = 0; this.pitch = damp(this.pitch, 0, 6, dt);
      if (tg || this.lost < 3) { // đuổi theo vị trí thấy cuối
        this.goalChase(dt);
      }
      if (!this.goal || (this.pi >= this.path.length && !this.pathReq)) { if (!this.pathReq && (this.goalWait = (this.goalWait || 0) - dt) <= 0) { this.goalWait = 0.3 + Math.random() * 1.2; this.pickGoal(); } }
      if (this.pi < this.path.length) {
        const p = this.path[this.pi], dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.7) this.pi++; else { mvx = dx / d; mvz = dz / d; want = Math.atan2(-dx, -dz); run = 4.6; }
      }
      this.yaw = dampAngle(this.yaw, want, 7, dt);
    }
    if (fire) this.shoot(dt);
    // di chuyển (hệ toạ độ thế giới)
    let l = Math.hypot(mvx, mvz);
    if (l > 0.001) {
      mvx /= l; mvz /= l; const sp = run;
      const px = this.x, pz = this.z;
      G.world.move(this, mvx * sp * dt, mvz * sp * dt, 0.34, 1.7, 0.5);
      this.speed = Math.hypot(this.x - px, this.z - pz) / dt;
      this.stuckT += dt;
      if (this.stuckT > 1.2) { if (Math.hypot(this.x - this.sx, this.z - this.sz) < 0.5) { this.goal = null; this.path.length = 0; this.pi = 0; } this.sx = this.x; this.sz = this.z; this.stuckT = 0; }
    } else this.speed = damp(this.speed, 0, 12, dt);
    this.y = G.world.groundAt(this.x, this.z, 0.3, this.y, 0.55);
    // hoạt hoạ
    const s = this.s;
    s.root.position.set(this.x, this.y, this.z);
    // mô hình quay theo hướng nhìn, thân chuyển động theo mvx (đơn giản: nhìn = hướng thân)
    s.root.rotation.y = this.yaw;
    s.update(dt, { speed: this.speed * (l > 0.001 ? 1 : 0), crouch: this.crouch > 0.5, pitch: this.pitch, firing: this.firing > 0.2, reloading: this.reloadT > 0 });
  }
  goalChase(dt) {
    if (!this.chasing || this.chasing !== this.target) { this.chasing = this.target; }
    if (this.lost > 1.3 && !this.chaseDone) { this.goal = { x: this.lastSeen.x, z: this.lastSeen.z }; this.pathReq = true; this.G.pathQ.push(this); this.chaseDone = true; }
    if (this.lost < 1) this.chaseDone = false;
  }
  shoot(dt) {
    const G = this.G, W = this.W;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    if (this.mag <= 0) { this.reloadT = W.reload + 0.4; return; }
    this.fireT = 60 / W.rpm * (this.kind === 'mp7' ? 1.35 : 1.25);
    if (--this.burst <= 0) { this.burst = 3 + Math.floor(Math.random() * 5); this.fireT += 0.3 + Math.random() * 0.5; }
    this.mag--; this.firing = 1;
    const d = this.aimD || 20;
    const sp = 0.012 + d * 0.0011 + (this.speed > 1 ? 0.02 : 0);
    const ox = this.x, oy = this.eyeY() - 0.15, oz = this.z;
    const tg = this.target;
    const tx = tg.x + (Math.random() - 0.5) * sp * d * 1.6, ty = this.aimY + (Math.random() - 0.5) * sp * d * 1.6, tz = tg.z + (Math.random() - 0.5) * sp * d * 1.6;
    let dx = tx - ox, dy = ty - oy, dz = tz - oz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    G.fireShot(this, ox - Math.sin(this.yaw) * 0.6, oy, oz - Math.cos(this.yaw) * 0.6, ox, oy, oz, dx, dy, dz, W, 0.55);
  }
}
