// Operator: 1 SkinnedMesh / người (1 draw call), 13 xương, cao 1,80 m (mũ 1,84 m). Hoạt hoạ thủ tục.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';
import { damp, clamp } from '../core/util.js';

export const PALETTES = {
  blue: { vest: 0x7d7358, cloth: 0x59634d, helmet: 0x6a6f5d, accent: 0x2d7bd6, pack: 0x4f5440, skin: 0xc79a78 },
  red: { vest: 0x3a3d43, cloth: 0x2f3338, helmet: 0x2b2d31, accent: 0xd8352a, pack: 0x25272b, skin: 0xb98a68 },
  free: { vest: 0x6a5a45, cloth: 0x4d4a3c, helmet: 0x55524a, accent: 0xe0b341, pack: 0x3c382e, skin: 0xc79a78 },
};
const BONES = [ // [tên, cha, x, y, z] (vị trí cục bộ ở tư thế nghỉ)
  ['root', -1, 0, 0, 0], ['hips', 0, 0, 0.95, 0], ['spine', 1, 0, 0.15, 0], ['chest', 2, 0, 0.2, 0], ['head', 3, 0, 0.34, 0],
  ['uArmL', 3, -0.22, 0.15, 0], ['fArmL', 5, 0, -0.29, 0], ['uArmR', 3, 0.22, 0.15, 0], ['fArmR', 7, 0, -0.29, 0],
  ['thL', 1, -0.1, 0, 0], ['shL', 9, 0, -0.46, 0], ['thR', 1, 0.1, 0, 0], ['shR', 11, 0, -0.46, 0],
];
const I = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const geoCache = {};

function buildGeo(pal) {
  const gb = new GeoBuilder();
  const b = (bone, x, y, z, sx, sy, sz, color, o = {}) => gb.box('s', x, y, z, sx, sy, sz, { color, bone, ...o });
  const cyl = (bone, x, y, z, r0, r1, h, color, seg = 8, o = {}) => gb.cyl('s', x, y, z, r0, r1, h, { color, bone, seg, ...o });
  const sph = (bone, x, y, z, rx, ry, rz, color) => gb.sphere('s', x, y, z, rx, ry, rz, { color, bone, ws: 10, hs: 7 });
  // chân
  for (const [s, th, sh] of [[-1, I.thL, I.shL], [1, I.thR, I.shR]]) {
    const x = s * 0.1;
    cyl(th, x, 0.72, 0, 0.085, 0.07, 0.46, pal.cloth, 8);
    b(th, x, 0.62, -0.075, 0.1, 0.12, 0.03, 0x2a2c2a); // đệm gối
    cyl(sh, x, 0.27, 0, 0.065, 0.055, 0.46, pal.cloth, 8);
    b(sh, x, 0.3, -0.06, 0.1, 0.14, 0.03, 0x2a2c2a);
    b(sh, x, 0.06, -0.03, 0.11, 0.12, 0.27, 0x24201c); // ủng
    b(sh, x, 0.025, -0.05, 0.115, 0.04, 0.3, 0x15130f);
  }
  b(I.hips, 0, 0.96, 0, 0.34, 0.2, 0.22, pal.cloth);
  b(I.hips, 0, 0.9, 0.0, 0.36, 0.06, 0.24, 0x2a2b27); // thắt lưng
  // thân + áo giáp + túi đạn + ba lô
  b(I.spine, 0, 1.18, 0, 0.36, 0.4, 0.22, pal.cloth);
  b(I.chest, 0, 1.3, -0.01, 0.41, 0.34, 0.27, pal.vest);
  b(I.chest, 0, 1.43, -0.01, 0.43, 0.06, 0.28, pal.vest);
  for (let i = 0; i < 3; i++) b(I.chest, -0.1 + i * 0.1, 1.2, -0.17, 0.085, 0.14, 0.06, pal.pack);
  b(I.chest, 0.17, 1.38, -0.15, 0.08, 0.1, 0.05, 0x2d2f2c);
  b(I.chest, 0, 1.3, 0.2, 0.34, 0.42, 0.17, pal.pack);
  b(I.chest, 0, 1.55, 0.2, 0.3, 0.07, 0.16, pal.vest);
  b(I.chest, 0.2, 1.47, 0, 0.06, 0.06, 0.2, pal.accent); // băng tay màu đội
  // đầu + mũ + kính
  const HY = 1.535; // cao độ hình học đầu (xương đầu ở 1,64)
  cyl(I.head, 0, HY, 0, 0.055, 0.06, 0.1, pal.skin, 8);
  sph(I.head, 0, HY + 0.17, 0, 0.095, 0.115, 0.1, pal.skin);
  sph(I.head, 0, HY + 0.2, 0.005, 0.125, 0.1, 0.135, pal.helmet);
  b(I.head, 0, HY + 0.27, -0.09, 0.05, 0.05, 0.05, 0x1d1f1c); // giá NVG
  b(I.head, 0, HY + 0.19, -0.1, 0.17, 0.05, 0.04, 0x15191b); // kính
  b(I.head, 0, HY + 0.1, -0.09, 0.15, 0.07, 0.04, 0x25292a); // khăn che
  for (const s of [-1, 1]) b(I.head, s * 0.125, HY + 0.18, 0.0, 0.03, 0.09, 0.1, 0x2a2c2a);
  // tay
  for (const [s, ua, fa] of [[-1, I.uArmL, I.fArmL], [1, I.uArmR, I.fArmR]]) {
    cyl(ua, s * 0.22, 1.455 - 0.15, 0, 0.055, 0.047, 0.3, pal.cloth, 8);
    sph(ua, s * 0.22, 1.455, 0, 0.075, 0.07, 0.075, pal.vest);
    cyl(fa, s * 0.22, 1.165 - 0.14, 0, 0.047, 0.04, 0.27, pal.cloth, 8);
    b(fa, s * 0.22, 1.165 - 0.05, -0.025, 0.09, 0.09, 0.05, 0x2a2c2a);
    b(fa, s * 0.22, 0.865 + 0.03, 0, 0.075, 0.1, 0.1, 0x1c1c1c); // găng
  }
  const geos = gb.build();
  return geos.get('s');
}
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0);
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const L1 = 0.3, L2 = 0.37; // cánh tay trên, cẳng tay + bàn tay
const _e = new THREE.Vector3(), _f = new THREE.Vector3();
/** IK 2 xương trong hệ toạ độ ngực: vai (sx,sy,sz) → đích T; khuỷu hướng xuống + ra ngoài. */
function armIK(up, fo, sx, sy, sz, T) {
  _a.set(sx, sy, sz);
  _d.copy(T).sub(_a);
  let d = _d.length(); d = Math.min(Math.max(d, 0.12), L1 + L2 - 0.005);
  _d.normalize();
  const ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), al = Math.acos(Math.min(1, Math.max(-1, ca)));
  _b.set(0.45 * Math.sign(sx), -1, 0.1); _b.addScaledVector(_d, -_b.dot(_d)).normalize();
  _e.copy(_d).multiplyScalar(Math.cos(al)).addScaledVector(_b, Math.sin(al)); // hướng cánh tay trên
  _q1.setFromUnitVectors(_dn, _e);
  up.quaternion.copy(_q1);
  _f.set(T.x - (_a.x + _e.x * L1), T.y - (_a.y + _e.y * L1), T.z - (_a.z + _e.z * L1)).normalize();
  _q2.setFromUnitVectors(_dn, _f);
  fo.quaternion.copy(_q1.invert().multiply(_q2));
}
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 });

export class Soldier {
  constructor(team = 'blue') {
    const pal = PALETTES[team] || PALETTES.blue;
    const geo = (geoCache[team] ??= buildGeo(pal));
    this.bones = BONES.map((d) => { const bn = new THREE.Bone(); bn.name = d[0]; bn.position.set(d[2], d[3], d[4]); return bn; });
    BONES.forEach((d, i) => { if (d[1] >= 0) this.bones[d[1]].add(this.bones[i]); });
    this.mesh = new THREE.SkinnedMesh(geo, MAT);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.add(this.bones[0]);
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    this.root.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(this.bones));
    this.phase = Math.random() * 6;
    this.crouch = 0; this.recoil = 0; this.dead = 0; this.reload = 0; this.pitch = 0; this.moveK = 0; this.emote = 0; this.pistol = false;
    this.weapon = null;
  }
  setWeapon(obj, pistol = false) {
    if (this.weapon) this.weapon.parent?.remove(this.weapon);
    this.weapon = obj; this.pistol = pistol;
    if (obj) this.bones[I.chest].add(obj);
  }
  /** s = {speed, crouch(0|1), pitch, firing, reloading, dead, emote} */
  update(dt, s) {
    const B = this.bones;
    this.moveK = damp(this.moveK, clamp(s.speed / 4.5, 0, 1.3), 10, dt);
    this.crouch = damp(this.crouch, s.crouch ? 1 : 0, 12, dt);
    this.recoil = damp(this.recoil, s.firing ? 1 : 0, s.firing ? 40 : 14, dt);
    this.reload = damp(this.reload, s.reloading ? 1 : 0, 8, dt);
    this.dead = damp(this.dead, s.dead ? 1 : 0, 5, dt);
    this.emote = damp(this.emote, s.emote ? 1 : 0, 8, dt);
    this.pitch = damp(this.pitch, s.pitch || 0, 14, dt);
    this.phase += dt * (2.2 + s.speed * 1.5);
    const sw = Math.sin(this.phase) * 0.75 * this.moveK, c = this.crouch;
    B[I.hips].position.y = 0.95 - c * 0.34 - Math.abs(Math.cos(this.phase)) * 0.025 * this.moveK;
    B[I.hips].rotation.set(0.12 * c + this.moveK * 0.06, Math.sin(this.phase) * 0.08 * this.moveK, 0);
    B[I.thL].rotation.x = sw + c * 1.0; B[I.thR].rotation.x = -sw + c * 1.0;
    B[I.shL].rotation.x = -Math.max(0, -sw) * 1.3 - c * 1.5; B[I.shR].rotation.x = -Math.max(0, sw) * 1.3 - c * 1.5;
    B[I.spine].rotation.set(this.pitch * 0.3 - 0.1 * c, -Math.sin(this.phase) * 0.06 * this.moveK, 0);
    B[I.chest].rotation.set(this.pitch * 0.5, 0, 0);
    B[I.head].rotation.x = -this.pitch * 0.2;
    // súng: đặt tì vai, hai tay IK bám vào gripR / gripL
    const rc = this.recoil * 0.05, rl = this.reload;
    const w = this.weapon;
    if (w) {
      if (this.pistol) w.position.set(0.0, 0.1, -0.34 + rc); else w.position.set(0.2, 0.11, -0.17 + rc);
      w.rotation.set(this.recoil * 0.03, this.pistol ? 0 : 0.1, 0);
      w.updateMatrix();
      const u = w.userData;
      armIK(B[I.uArmR], B[I.fArmR], 0.22, 0.15, 0, _t1.copy(u.gripR).applyMatrix4(w.matrix));
      const gl = _t2.copy(u.gripL).applyMatrix4(w.matrix);
      if (rl > 0.01) { gl.y -= 0.35 * rl; gl.z += 0.35 * rl; gl.x += 0.05 * rl; }
      armIK(B[I.uArmL], B[I.fArmL], -0.22, 0.15, 0, gl);
    }
    if (this.emote > 0.01) { B[I.uArmR].rotation.set(2.9 * this.emote, 0, -0.5 * this.emote); B[I.fArmR].rotation.set(0.6 * this.emote + Math.sin(performance.now() / 120) * 0.5 * this.emote, 0, 0); }
    this.root.rotation.x = 0;
    this.mesh.rotation.x = -this.dead * 1.5;
    this.mesh.position.y = this.dead * 0.2;
  }
}
