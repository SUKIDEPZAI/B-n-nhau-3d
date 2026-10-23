// Operator: 1 SkinnedMesh / người (1 draw call), 13 xương, cao 1,80 m (mũ 1,84 m). Hoạt hoạ thủ tục.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';
import { side } from './kit.js';
import { damp, clamp } from '../core/util.js';

const mkPal = (o) => ({ pad: 0x1f2022, boot: 0x2a241c, glove: 0x1d1e1d, pouch: o.vest, mask: o.cloth, belt: 0x23241f, lens: 0x2a5568, ...o });
const BASE = {
  blue: { vest: 0x7d7358, cloth: 0x59634d, helmet: 0x6a6f5d, accent: 0x2d7bd6, pack: 0x4f5440, skin: 0xc79a78, pouch: 0x6c6449 },
  red: { vest: 0x3a3d43, cloth: 0x2f3338, helmet: 0x2b2d31, accent: 0xd8352a, pack: 0x25272b, skin: 0xb98a68, pouch: 0x2e3136 },
  free: { vest: 0x6a5a45, cloth: 0x4d4a3c, helmet: 0x55524a, accent: 0xe0b341, pack: 0x3c382e, skin: 0xc79a78, pouch: 0x5a4d3b },
};
/** Trang phục mở khoá ở cửa hàng: giữ băng tay màu đội, đổi màu quân phục. */
export const SKINS = {
  std: { name: 'Tiêu chuẩn', vest: null },
  desert: { name: 'Sa mạc', vest: 0x8f7c56, cloth: 0xb09a70, helmet: 0x9c8962, pack: 0x7d6c4a, pouch: 0x85734f, boot: 0x4a3d2a },
  wood: { name: 'Rừng rậm', vest: 0x3f4a33, cloth: 0x4b5a35, helmet: 0x3a4630, pack: 0x2f3827, pouch: 0x384229, boot: 0x2a241c },
  night: { name: 'Đêm', vest: 0x17181b, cloth: 0x222428, helmet: 0x1a1b1e, pack: 0x141518, pouch: 0x1c1d20, boot: 0x0f0f10 },
};
export const PALETTES = {};
for (const t of Object.keys(BASE)) for (const k of Object.keys(SKINS)) PALETTES[k === 'std' ? t : t + '_' + k] = mkPal(k === 'std' ? BASE[t] : { ...BASE[t], ...Object.fromEntries(Object.entries(SKINS[k]).filter(([n, v]) => n !== 'name' && v != null)) });
const BONES = [ // [tên, cha, x, y, z] (vị trí cục bộ ở tư thế nghỉ)
  ['root', -1, 0, 0, 0], ['hips', 0, 0, 0.95, 0], ['spine', 1, 0, 0.15, 0], ['chest', 2, 0, 0.2, 0], ['head', 3, 0, 0.34, 0],
  ['uArmL', 3, -0.22, 0.15, 0], ['fArmL', 5, 0, -0.29, 0], ['uArmR', 3, 0.22, 0.15, 0], ['fArmR', 7, 0, -0.29, 0],
  ['thL', 1, -0.1, 0, 0], ['shL', 9, 0, -0.46, 0], ['thR', 1, 0.1, 0, 0], ['shR', 11, 0, -0.46, 0],
];
const I = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const geoCache = {};

function buildGeo(pal) {
  const gb = new GeoBuilder();
  const dk = (c, k) => ((((c >> 16) & 255) * k) << 16) | ((((c >> 8) & 255) * k) << 8) | ((c & 255) * k) | 0;
  const B = (bone, x, y, z, sx, sy, sz, color, o = {}) => gb.box('s', x, y, z, sx, sy, sz, { color, bone, ...o });
  const CY = (bone, x, y, z, r0, r1, h, color, seg = 16, o = {}) => gb.cyl('s', x, y, z, r0, r1, h, { color, bone, seg, ...o });
  const SP = (bone, x, y, z, rx, ry, rz, color, ws = 16, hs = 12) => gb.sphere('s', x, y, z, rx, ry, rz, { color, bone, ws, hs });
  const SD = (bone, pts, hw, x, color, o = {}) => side(gb, 's', pts, hw, x, color, { bone, ...o });
  const FR = (bone, pts, depth, z, color, o = {}) => gb.extrude('s', pts, depth, new THREE.Matrix4().makeTranslation(0, 0, z), { color, bone, bevel: 0.006, bevSeg: 2, curveSegments: 8, ...o });
  const TB = (bone, pts, r, color, radial = 6) => gb.tube('s', pts, r, { color, bone, radial, segs: 18 });
  const C = pal;
  // ---- chân ----
  for (const [s, th, sh] of [[-1, I.thL, I.shL], [1, I.thR, I.shR]]) {
    const x = s * 0.1;
    CY(th, x, 0.74, 0, 0.094, 0.068, 0.46, C.cloth, 16, { shade: [0.88, 1.05], shadeY0: 0.5, shadeH: 0.5 });
    B(th, s * 0.188, 0.7, 0.0, 0.03, 0.16, 0.13, dk(C.cloth, 0.92), { bevel: 0.004 }); B(th, s * 0.2, 0.755, -0.0, 0.012, 0.03, 0.12, dk(C.cloth, 0.8)); // túi hộp
    SP(sh, x, 0.5, -0.03, 0.068, 0.085, 0.055, C.pad); B(sh, x, 0.5, -0.07, 0.1, 0.035, 0.02, dk(C.pad, 1.4)); // đệm gối
    CY(sh, x, 0.27, 0, 0.063, 0.05, 0.44, C.cloth, 16);
    CY(sh, x, 0.095, 0, 0.056, 0.062, 0.09, dk(C.cloth, 0.8), 16); // gấu quần ống bốt
    SD(sh, [[-0.078, 0.0], [0.16, 0.0], [0.17, 0.03], [0.13, 0.058], [0.07, 0.08], [0.062, 0.2], [-0.062, 0.2], [-0.082, 0.05]], 0.052, x, C.boot, { bevel: 0.012, bevSeg: 3 });
    SD(sh, [[-0.082, 0.0], [0.17, 0.0], [0.172, 0.024], [-0.084, 0.024]], 0.056, x, 0x111111, { bevel: 0.004 });
    B(sh, x, 0.1, -0.056, 0.09, 0.02, 0.02, dk(C.boot, 0.6)); // dây giày
  }
  // ---- hông, thắt lưng, bao súng ----
  CY(I.hips, 0, 0.99, 0, 0.19, 0.17, 0.2, C.cloth, 18, { sz: 0.66 });
  CY(I.hips, 0, 0.925, 0, 0.198, 0.198, 0.055, C.belt, 18, { sz: 0.7 });
  B(I.hips, 0, 0.925, -0.152, 0.05, 0.04, 0.012, 0x777a7d, { bevel: 0.002 });
  B(I.hips, 0.14, 0.93, -0.12, 0.06, 0.08, 0.04, C.pouch, { bevel: 0.006 }); B(I.hips, -0.14, 0.93, -0.12, 0.06, 0.08, 0.04, C.pouch, { bevel: 0.006 });
  B(I.thR, 0.205, 0.83, -0.02, 0.04, 0.17, 0.115, 0x1a1a1c, { bevel: 0.008 }); B(I.thR, 0.205, 0.93, -0.02, 0.046, 0.04, 0.125, 0x242426, { bevel: 0.004 });
  // ---- thân + áo giáp ----
  CY(I.spine, 0, 1.17, 0, 0.19, 0.172, 0.3, C.cloth, 18, { sz: 0.66, shade: [0.9, 1.05], shadeY0: 1.0, shadeH: 0.5 });
  CY(I.chest, 0, 1.37, 0, 0.205, 0.19, 0.3, C.cloth, 18, { sz: 0.68 });
  SP(I.chest, 0, 1.52, 0, 0.1, 0.05, 0.07, C.cloth);
  CY(I.spine, 0, 1.15, 0, 0.215, 0.215, 0.13, C.vest, 18, { sz: 0.72 }); // cummerbund
  FR(I.chest, [[-0.185, 1.12], [0.185, 1.12], [0.205, 1.34], [0.16, 1.455], [0.085, 1.47], [-0.085, 1.47], [-0.16, 1.455], [-0.205, 1.34]], 0.06, -0.128, C.vest, { bevel: 0.012 });
  FR(I.chest, [[-0.185, 1.12], [0.185, 1.12], [0.205, 1.34], [0.16, 1.455], [0.085, 1.47], [-0.085, 1.47], [-0.16, 1.455], [-0.205, 1.34]], 0.05, 0.128, C.vest, { bevel: 0.012 });
  for (const sx of [-1, 1]) B(I.chest, sx * 0.115, 1.5, 0.0, 0.065, 0.02, 0.27, C.vest, { bevel: 0.006 });
  for (let i = 0; i < 3; i++) { const x = -0.105 + i * 0.105; B(I.chest, x, 1.215, -0.178, 0.09, 0.13, 0.05, C.pouch, { bevel: 0.007 }); B(I.chest, x, 1.272, -0.2, 0.092, 0.04, 0.02, dk(C.pouch, 0.82), { bevel: 0.004 }); B(I.chest, x, 1.3, -0.176, 0.06, 0.02, 0.025, 0x2d2f2b); }
  B(I.chest, 0.0, 1.385, -0.172, 0.2, 0.065, 0.035, C.pouch, { bevel: 0.006 }); B(I.chest, -0.15, 1.4, -0.168, 0.05, 0.1, 0.035, 0x1c1d1f, { bevel: 0.006 }); CY(I.chest, -0.165, 1.5, -0.168, 0.004, 0.004, 0.1, 0x111111, 6); // radio + ăng ten
  for (let i = 0; i < 4; i++) { B(I.chest, 0.12 + (i % 2) * 0.0, 1.17 + i * 0.04, -0.158, 0.1, 0.007, 0.01, dk(C.vest, 0.7)); } // dây MOLLE
  B(I.chest, 0.0, 1.3, 0.2, 0.3, 0.36, 0.15, C.pack, { bevel: 0.015 }); B(I.chest, 0.0, 1.5, 0.2, 0.26, 0.06, 0.16, dk(C.pack, 0.85), { bevel: 0.015 }); B(I.chest, 0.0, 1.22, 0.285, 0.2, 0.18, 0.04, dk(C.pack, 0.8), { bevel: 0.01 });
  TB(I.chest, [[0.12, 1.5, 0.15], [0.17, 1.55, 0.02], [0.14, 1.5, -0.1], [0.14, 1.38, -0.15]], 0.005, 0x111111);
  // ---- cổ + đầu ----
  CY(I.head, 0, 1.55, 0, 0.055, 0.062, 0.1, C.skin, 14);
  CY(I.head, 0, 1.585, -0.005, 0.082, 0.088, 0.075, C.mask, 18); // khăn che cổ/mặt dưới
  const HY = 1.535;
  SP(I.head, 0, HY + 0.165, 0.0, 0.092, 0.108, 0.1, C.skin, 20, 14);
  SP(I.head, 0, HY + 0.1, -0.02, 0.078, 0.06, 0.082, C.skin, 16, 10);
  B(I.head, 0, HY + 0.15, -0.098, 0.022, 0.038, 0.034, C.skin, { bevel: 0.004 });
  for (const sx of [-1, 1]) { SP(I.head, sx * 0.094, HY + 0.15, 0.005, 0.014, 0.032, 0.022, C.skin, 8, 6); SP(I.head, sx * 0.04, HY + 0.185, -0.088, 0.016, 0.009, 0.01, 0xf0eee8, 8, 6); }
  // mũ kevlar kiểu Fast + ray + giá NVG + tai nghe + dây quai
  SP(I.head, 0, HY + 0.215, 0.012, 0.122, 0.102, 0.138, C.helmet, 24, 16);
  for (const sx of [-1, 1]) { B(I.head, sx * 0.121, HY + 0.2, -0.03, 0.014, 0.034, 0.1, 0x1c1d1e, { bevel: 0.003 }); CY(I.head, sx * 0.118, HY + 0.15, 0.015, 0.036, 0.036, 0.032, 0x1b1c1e, 16, { axis: 'x' }); CY(I.head, sx * 0.128, HY + 0.15, 0.015, 0.03, 0.03, 0.01, 0x2c2e30, 16, { axis: 'x' }); }
  TB(I.head, [[-0.118, HY + 0.18, 0.015], [-0.07, HY + 0.3, 0.01], [0.07, HY + 0.3, 0.01], [0.118, HY + 0.18, 0.015]], 0.004, 0x1a1a1a, 5);
  B(I.head, 0, HY + 0.285, -0.12, 0.06, 0.05, 0.035, 0x18191a, { bevel: 0.006 }); CY(I.head, 0, HY + 0.265, -0.15, 0.022, 0.022, 0.06, 0x101112, 14, { axis: 'z' });
  TB(I.head, [[0.1, HY + 0.17, -0.015], [0.092, HY + 0.1, -0.045], [0.0, HY + 0.062, -0.085], [-0.092, HY + 0.1, -0.045], [-0.1, HY + 0.17, -0.015]], 0.0045, 0x121212, 5);
  // kính bảo hộ + dây
  B(I.head, 0, HY + 0.185, -0.102, 0.2, 0.052, 0.05, 0x141719, { bevel: 0.01 }); B(I.head, 0, HY + 0.185, -0.131, 0.17, 0.038, 0.006, C.lens, { bevel: 0.002 });
  TB(I.head, [[-0.1, HY + 0.185, -0.09], [-0.125, HY + 0.185, 0.0], [0.0, HY + 0.185, 0.128], [0.125, HY + 0.185, 0.0], [0.1, HY + 0.185, -0.09]], 0.009, 0x151719, 6);
  // ---- tay ----
  for (const [s, ua, fa] of [[-1, I.uArmL, I.fArmL], [1, I.uArmR, I.fArmR]]) {
    const x = s * 0.22;
    SP(ua, x, 1.455, 0, 0.074, 0.07, 0.074, C.cloth);
    CY(ua, x, 1.31, 0, 0.056, 0.045, 0.3, C.cloth, 16, { shade: [0.9, 1.05], shadeY0: 1.15, shadeH: 0.3 });
    B(ua, x + s * 0.044, 1.385, 0, 0.012, 0.06, 0.07, C.accent, { bevel: 0.003 }); B(ua, x + s * 0.046, 1.455, 0, 0.012, 0.045, 0.045, dk(C.vest, 0.9)); // băng đội + miếng vai
    SP(fa, x, 1.165, 0, 0.048, 0.048, 0.048, C.cloth); SP(fa, x, 1.17, 0.035, 0.046, 0.05, 0.03, C.pad);
    CY(fa, x, 1.02, 0, 0.046, 0.038, 0.29, C.cloth, 16);
    CY(fa, x, 0.89, 0, 0.039, 0.042, 0.04, C.glove, 14);
    B(fa, x, 0.835, -0.002, 0.078, 0.09, 0.036, C.glove, { bevel: 0.01 });
    B(fa, x, 0.775, -0.008, 0.074, 0.05, 0.03, dk(C.glove, 1.15), { bevel: 0.008 });
    for (let k = 0; k < 3; k++) B(fa, x - 0.024 + k * 0.024, 0.745, -0.015, 0.02, 0.03, 0.024, C.glove, { bevel: 0.005 });
    B(fa, x - s * 0.046, 0.82, -0.025, 0.024, 0.06, 0.03, C.glove, { bevel: 0.007, rot: [0, 0, s * 0.35] });
    B(fa, x, 0.865, -0.025, 0.068, 0.018, 0.03, 0x2a2b2a, { bevel: 0.004 });
  }
  return gb.build().get('s');
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
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.04 });
/** Gắn bump vải (gọi 1 lần sau khi có texture). */
export function setFabric(tex) { if (!tex) return; const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); t.needsUpdate = true; MAT.bumpMap = t; MAT.bumpScale = 0.6; MAT.needsUpdate = true; }

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
