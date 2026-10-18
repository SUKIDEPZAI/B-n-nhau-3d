// Model vũ khí 1:1 (mét). Gốc toạ độ = điểm tay cầm; nòng hướng -Z, +Y lên, +X phải.
// AK-12: dài 0,94 m (báng mở), nòng 415 mm, cao có băng ~0,29 m — theo thông số công bố (Wikipedia/Rostec).
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';

const C = { blk: 0x1b1c1e, blk2: 0x2a2c2f, tan: 0xb59a68, tan2: 0x9d8556, steel: 0x6c7076, mag: 0x5f5d44, rubber: 0x141414, glass: 0x9fd0e0 };
export const GUN_MATS = {
  gun: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55 }),
  lens: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false }),
};

function curvedMag(gb, x, z0, y0, len, segs, w, d, bend, col) {
  let z = z0, y = y0, a = 0;
  const sl = len / segs;
  for (let i = 0; i < segs; i++) {
    a += bend / segs;
    const dz = -Math.sin(a) * sl, dy = -Math.cos(a) * sl;
    gb.box('gun', x, y + dy / 2, z + dz / 2, w, sl * 1.04, d, { color: i % 2 ? col : col + 0x0a0a0a, rot: [a, 0, 0] });
    gb.box('gun', x, y + dy / 2, z + dz / 2, w + 0.003, 0.004, d + 0.003, { color: 0x3a3a2a, rot: [a, 0, 0] });
    z += dz; y += dy;
  }
}

export function buildAK12() {
  const gb = new GeoBuilder();
  const B = (x, y, z, sx, sy, sz, color, o = {}) => gb.box('gun', x, y, z, sx, sy, sz, { color, ...o });
  const CY = (x, y, z, r, len, color, seg = 10, rot = [0, 0, 0]) => gb.cyl('gun', x, y, z, r, r, len, { axis: 'z', color, seg, rot });
  // thân dưới (thép dập) + nắp hộp khoá nòng có ray
  B(0, -0.012, -0.09, 0.036, 0.078, 0.34, C.blk2);
  B(0, 0.034, -0.1, 0.034, 0.02, 0.32, C.tan);
  B(0, 0.047, -0.1, 0.022, 0.012, 0.31, C.blk2);
  for (let i = 0; i < 14; i++) B(0, 0.054, -0.235 + i * 0.022, 0.024, 0.006, 0.01, C.blk);
  B(0, 0.016, -0.215, 0.04, 0.05, 0.1, C.tan2); // vùng vỏ màu cát phía trước thân
  // báng gập bên hông + má tì
  B(0, 0.002, 0.16, 0.03, 0.082, 0.16, C.blk);
  B(0, 0.04, 0.2, 0.026, 0.03, 0.14, C.blk2);
  B(0, 0.0, 0.265, 0.034, 0.1, 0.045, C.rubber);
  B(0.02, 0.0, 0.1, 0.012, 0.05, 0.04, C.steel);
  // tay cầm súng + bảo vệ cò
  B(0, -0.062, 0.03, 0.03, 0.105, 0.048, C.blk, { rot: [-0.32, 0, 0] });
  B(0, -0.035, -0.015, 0.008, 0.012, 0.07, C.blk2);
  B(0, -0.048, -0.05, 0.008, 0.03, 0.008, C.blk2);
  // băng đạn cong 30 viên
  curvedMag(gb, 0, -0.105, -0.045, 0.27, 6, 0.028, 0.052, 0.42, C.mag);
  // ốp tay màu cát + lỗ thông gió + ray
  B(0, 0.002, -0.345, 0.05, 0.07, 0.2, C.tan);
  B(0, 0.04, -0.345, 0.02, 0.012, 0.2, C.blk2);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) B(s * 0.0252, 0.008, -0.29 - i * 0.034, 0.002, 0.016, 0.016, C.blk);
  B(0, -0.04, -0.345, 0.022, 0.012, 0.2, C.blk2);
  CY(0.032, -0.01, -0.36, 0.013, 0.1, C.blk2, 8); // đèn chiến thuật
  // vertical foregrip
  gb.cyl('gun', 0, -0.092, -0.405, 0.015, 0.017, 0.08, { color: C.blk, seg: 8 });
  // ống dẫn khí, nòng, khối ngắm trước, đầu giảm giật
  CY(0, 0.033, -0.42, 0.011, 0.34, C.blk, 8);
  CY(0, 0.0, -0.52, 0.0085, 0.28, C.steel, 8);
  B(0, 0.02, -0.55, 0.026, 0.07, 0.03, C.blk2);
  B(0, 0.062, -0.55, 0.006, 0.03, 0.016, C.blk);
  CY(0, 0.0, -0.605, 0.0165, 0.07, C.blk2, 12); // muzzle brake dạng buồng giãn nở
  for (const s of [-1, 1]) gb.cyl('gun', s * 0.0166, 0.0, -0.605, 0.007, 0.007, 0.004, { axis: 'x', color: 0x050505, seg: 8 });
  // đèn ngắm red dot trên ray
  B(0, 0.0655, -0.04, 0.034, 0.012, 0.056, C.blk);            // đế
  B(0, 0.1045, -0.04, 0.034, 0.008, 0.056, C.blk);            // nóc
  B(-0.0155, 0.085, -0.04, 0.003, 0.03, 0.05, C.blk2); B(0.0155, 0.085, -0.04, 0.003, 0.03, 0.05, C.blk2); // khung bên (cửa sổ kính ở giữa)
  B(0, 0.085, -0.063, 0.028, 0.03, 0.006, C.blk); B(0, 0.1, -0.016, 0.028, 0.012, 0.01, C.blk);
  // tay kéo, cần chọn
  B(0.021, 0.02, -0.06, 0.012, 0.012, 0.03, C.steel);
  B(0.02, -0.006, -0.01, 0.004, 0.04, 0.012, C.steel);
  const g = new THREE.Group();
  const geos = gb.build();
  for (const [k, geo] of geos) { const m = new THREE.Mesh(geo, GUN_MATS.gun); m.castShadow = true; g.add(m); }
  const lens = new GeoBuilder();
  lens.box('lens', 0, 0.085, -0.045, 0.026, 0.026, 0.002, { color: 0x88c4d8 });
  for (const [, geo] of lens.build()) g.add(new THREE.Mesh(geo, GUN_MATS.lens));
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.002), new THREE.MeshBasicMaterial({ color: 0xff2a10, fog: false }));
  dot.position.set(0, 0.0855, -0.047); g.add(dot);
  g.userData = { name: 'AK-12', length: 0.94, muzzle: new THREE.Vector3(0, 0, -0.64), gripR: new THREE.Vector3(0, -0.05, 0.035), gripL: new THREE.Vector3(0, -0.07, -0.405), sight: new THREE.Vector3(0, 0.085, -0.04), mag: new THREE.Vector3(0, -0.2, -0.1), eject: new THREE.Vector3(0.02, 0.02, -0.08) };
  return g;
}

export function buildMP7() {
  const gb = new GeoBuilder();
  const B = (x, y, z, sx, sy, sz, color, o = {}) => gb.box('gun', x, y, z, sx, sy, sz, { color, ...o });
  B(0, 0.0, -0.1, 0.034, 0.07, 0.3, C.blk2);
  B(0, 0.04, -0.12, 0.02, 0.012, 0.26, C.blk);
  B(0, -0.05, 0.03, 0.03, 0.1, 0.045, C.blk, { rot: [-0.25, 0, 0] });
  B(0, -0.09, -0.07, 0.024, 0.14, 0.03, C.blk);
  B(0, 0.0, 0.16, 0.02, 0.05, 0.16, C.steel); B(0, 0.0, 0.25, 0.03, 0.08, 0.03, C.rubber);
  gb.cyl('gun', 0, 0.0, -0.3, 0.009, 0.009, 0.16, { axis: 'z', color: C.steel, seg: 8 });
  gb.cyl('gun', 0, 0.0, -0.4, 0.014, 0.014, 0.08, { axis: 'z', color: C.blk, seg: 10 });
  B(0, -0.045, -0.2, 0.026, 0.026, 0.06, C.blk2); B(0, 0.07, -0.05, 0.03, 0.03, 0.045, C.blk);
  const g = new THREE.Group();
  for (const [, geo] of gb.build()) { const m = new THREE.Mesh(geo, GUN_MATS.gun); m.castShadow = true; g.add(m); }
  g.userData = { name: 'MP7', length: 0.64, muzzle: new THREE.Vector3(0, 0, -0.44), gripR: new THREE.Vector3(0, -0.05, 0.035), gripL: new THREE.Vector3(0, -0.05, -0.2), sight: new THREE.Vector3(0, 0.07, -0.05), mag: new THREE.Vector3(0, -0.16, -0.07), eject: new THREE.Vector3(0.02, 0.02, -0.08) };
  return g;
}

export function buildPistol() {
  const gb = new GeoBuilder();
  const B = (x, y, z, sx, sy, sz, color, o = {}) => gb.box('gun', x, y, z, sx, sy, sz, { color, ...o });
  B(0, 0.022, -0.055, 0.028, 0.034, 0.2, C.blk2); // slide
  B(0, -0.005, -0.04, 0.026, 0.018, 0.16, C.blk);
  B(0, -0.055, 0.02, 0.03, 0.1, 0.04, C.blk, { rot: [-0.2, 0, 0] });
  B(0, -0.03, -0.03, 0.008, 0.01, 0.045, C.blk2);
  B(0, 0.045, 0.03, 0.01, 0.01, 0.01, C.blk); B(0, 0.045, -0.14, 0.006, 0.01, 0.01, C.blk);
  gb.cyl('gun', 0, 0.022, -0.16, 0.007, 0.007, 0.03, { axis: 'z', color: C.steel, seg: 8 });
  const g = new THREE.Group();
  for (const [, geo] of gb.build()) { const m = new THREE.Mesh(geo, GUN_MATS.gun); m.castShadow = true; g.add(m); }
  g.userData = { name: 'G17', length: 0.2, muzzle: new THREE.Vector3(0, 0.02, -0.175), gripR: new THREE.Vector3(0, -0.04, 0.025), gripL: new THREE.Vector3(0, -0.06, 0.0), sight: new THREE.Vector3(0, 0.05, -0.05), mag: new THREE.Vector3(0, -0.12, 0.01), eject: new THREE.Vector3(0.015, 0.03, -0.05) };
  return g;
}
export const BUILDERS = { ak12: buildAK12, mp7: buildMP7, pistol: buildPistol };
