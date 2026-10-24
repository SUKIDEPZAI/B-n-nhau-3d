// Vật phẩm chiến trường 1:1 (mét): hộp y tế, giáp, thùng đạn, lựu đạn.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';
import { slab } from './kit.js';

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
const fin = (gb) => { const g = new THREE.Group(); for (const [, geo] of gb.build()) { const m = new THREE.Mesh(geo, MAT); m.castShadow = true; g.add(m); } return g; };

export function buildMedkit() { // hộp cứu thương 0,32×0,22×0,11
  const gb = new GeoBuilder();
  slab(gb, 'p', -0.16, 0.16, -0.11, 0.11, 0.055, 0, 0xe8e8e4, { bevel: 0.012, bevSeg: 3 });
  slab(gb, 'p', -0.162, 0.162, 0.0, 0.012, 0.0565, 0, 0xc9c9c4, { bevel: 0.002, bevSeg: 1 }); // đường nắp
  gb.box('p', 0, 0.0, -0.0635, 0.1, 0.034, 0.003, { color: 0xd8352a }); gb.box('p', 0, 0.0, -0.0635, 0.034, 0.1, 0.003, { color: 0xd8352a });
  gb.box('p', 0, 0.0, 0.0635, 0.1, 0.034, 0.003, { color: 0xd8352a }); gb.box('p', 0, 0.0, 0.0635, 0.034, 0.1, 0.003, { color: 0xd8352a });
  gb.cyl('p', 0, 0.115, 0, 0.012, 0.012, 0.11, { axis: 'z', seg: 12, color: 0x555a5e }); // quai xách
  for (const s of [-1, 1]) gb.box('p', s * 0.15, 0.0, 0.0, 0.012, 0.03, 0.06, { color: 0x666b70 }); // khoá
  return fin(gb);
}
export function buildArmorPlate() { // tấm giáp mang trước 0,25×0,30
  const gb = new GeoBuilder();
  const pts = [[-0.125, -0.15], [0.125, -0.15], [0.14, 0.08], [0.1, 0.15], [-0.1, 0.15], [-0.14, 0.08]];
  gb.extrude('p', pts, 0.05, null, { color: 0x3c4a2e, bevel: 0.012, bevSeg: 3 });
  gb.extrude('p', pts.map(([x, y]) => [x * 0.78, y * 0.78]), 0.058, null, { color: 0x56683f, bevel: 0.006, bevSeg: 2 });
  for (let i = 0; i < 3; i++) gb.box('p', -0.07 + i * 0.07, -0.02, -0.032, 0.05, 0.1, 0.01, { color: 0x2c3822 });
  for (const s of [-1, 1]) gb.box('p', s * 0.07, 0.17, 0.0, 0.035, 0.07, 0.014, { color: 0x1c1d1f });
  return fin(gb);
}
export function buildAmmoBox() { // thùng đạn kim loại 0,30×0,18×0,14
  const gb = new GeoBuilder();
  slab(gb, 'p', -0.15, 0.15, -0.09, 0.09, 0.07, 0, 0x5b6340, { bevel: 0.01, bevSeg: 3 });
  slab(gb, 'p', -0.152, 0.152, 0.075, 0.095, 0.0715, 0, 0x4c5435, { bevel: 0.003, bevSeg: 1 });
  gb.cyl('p', 0, 0.115, 0, 0.011, 0.011, 0.15, { axis: 'z', seg: 12, color: 0x2a2c2e });
  for (let i = 0; i < 3; i++) gb.box('p', -0.09 + i * 0.09, 0.0, -0.0725, 0.012, 0.15, 0.004, { color: 0x454d30 });
  gb.box('p', 0, -0.01, 0.0725, 0.12, 0.05, 0.004, { color: 0xc9a24a }); gb.box('p', 0, 0.06, 0.0725, 0.05, 0.02, 0.004, { color: 0x8a8f95 });
  for (const s of [-1, 1]) { gb.box('p', s * 0.152, 0.0, 0.0, 0.01, 0.05, 0.08, { color: 0x7a8088 }); gb.box('p', s * 0.07, 0.07, 0.0725, 0.03, 0.025, 0.008, { color: 0x7a8088 }); }
  return fin(gb);
}
export function buildGrenade() { // lựu đạn M67 kiểu quả cầu Ø 6,4 cm
  const gb = new GeoBuilder();
  gb.sphere('p', 0, 0, 0, 0.032, 0.036, 0.032, { color: 0x4b5a3a, ws: 20, hs: 14 });
  gb.cyl('p', 0, 0.04, 0, 0.011, 0.014, 0.022, { seg: 14, color: 0x6a6f74 });
  gb.cyl('p', 0, 0.056, 0, 0.007, 0.007, 0.016, { seg: 10, color: 0x6a6f74 });
  gb.box('p', 0.022, 0.054, 0, 0.028, 0.006, 0.014, { color: 0x8a8f95 }); // cần an toàn
  gb.cyl('p', 0.0, 0.07, 0, 0.012, 0.012, 0.003, { axis: 'x', seg: 12, color: 0x9aa0a6, rot: [0, 0, 0] });
  for (let i = 0; i < 5; i++) gb.cyl('p', 0, -0.025 + i * 0.016, 0, 0.0335, 0.0335, 0.003, { seg: 20, color: 0x3b4830 });
  return fin(gb);
}
