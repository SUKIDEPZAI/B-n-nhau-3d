// Vũ khí 1:1 (mét). Gốc = tay cầm; nòng −Z, +Y lên, +X phải. Biên dạng nhìn nghiêng đùn có vát cạnh + trụ 16 cạnh.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';
import { side, slab, bar, banana, rail } from './kit.js';

const mk = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
export const GUN_MATS = {
  steel: mk({ roughness: 0.38, metalness: 0.72 }),
  blk: mk({ roughness: 0.46, metalness: 0.3 }),
  poly: mk({ roughness: 0.62, metalness: 0.05 }),
  tan: mk({ roughness: 0.55, metalness: 0.05 }),
  rubber: mk({ roughness: 0.92, metalness: 0 }),
  wood: mk({ roughness: 0.6, metalness: 0 }),
  lens: mk({ roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false }),
};
const C = { st: 0x4a4e54, st2: 0x62666c, blk: 0x2a2c2f, blk2: 0x3a3d41, tan: 0xa88b5c, tan2: 0x8d7348, mag: 0x555440, rub: 0x121212, wood: 0x6a4325, chrome: 0x8a8f95 };

function finish(gb, extra = []) {
  const g = new THREE.Group();
  for (const [k, geo] of gb.build()) { const m = new THREE.Mesh(geo, GUN_MATS[k] || GUN_MATS.blk); m.castShadow = true; g.add(m); }
  for (const m of extra) g.add(m);
  return g;
}
function redDot(gb, u, v, g) {
  // đế + khung + kính (cửa sổ trong suốt)
  slab(gb, 'blk', u - 0.028, u + 0.028, v, v + 0.011, 0.017, 0, C.blk);
  slab(gb, 'blk', u - 0.028, u + 0.028, v + 0.04, v + 0.048, 0.017, 0, C.blk);
  for (const s of [-1, 1]) slab(gb, 'blk', u - 0.028, u + 0.028, v + 0.011, v + 0.04, 0.0025, s * 0.0145, C.blk);
  slab(gb, 'blk', u + 0.022, u + 0.03, v + 0.011, v + 0.04, 0.0145, 0, C.blk);
  gb.box('blk', 0, v + 0.011, -(u - 0.02), 0.012, 0.012, 0.012, { color: C.st });
  const lens = new GeoBuilder();
  lens.box('lens', 0, v + 0.0255, -(u + 0.001), 0.026, 0.028, 0.0015, { color: 0x88c4d8 });
  for (const [, geo] of lens.build()) g.push(new THREE.Mesh(geo, GUN_MATS.lens));
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.002), new THREE.MeshBasicMaterial({ color: 0xff2a10, fog: false }));
  dot.position.set(0, v + 0.0265, -(u + 0.003)); g.push(dot);
}

// ======================= AK-12 =======================
export function buildAK12() {
  const gb = new GeoBuilder(), ex = [];
  // thân dưới + nắp hộp khoá nòng
  side(gb, 'blk', [[-0.17, 0.03], [-0.17, -0.025], [-0.1, -0.036], [0.2, -0.036], [0.2, 0.03]], 0.0185, 0, C.blk2);
  side(gb, 'blk', [[-0.165, 0.033], [0.19, 0.033], [0.19, 0.048], [-0.12, 0.052], [-0.165, 0.044]], 0.0165, 0, C.blk, { bevel: 0.003 });
  rail(gb, 'steel', -0.12, 0.185, 0.052, 0.011, 0, C.st);
  // cửa nạp đạn + tay kéo + cần chọn + khoá nòng
  slab(gb, 'blk', -0.012, 0.075, 0.004, 0.028, 0.001, 0.0212, 0x0c0c0d, { bevel: 0.0005, bevSeg: 1 });
  gb.box('steel', 0.027, 0.026, -0.01, 0.011, 0.012, 0.03, { color: C.st2 }); gb.cyl('steel', 0.034, 0.026, -0.005, 0.006, 0.006, 0.01, { axis: 'x', seg: 10, color: C.st });
  slab(gb, 'steel', -0.04, 0.03, -0.018, -0.008, 0.0012, 0.0218, C.st2, { bevel: 0.0004, bevSeg: 1 }); gb.box('steel', 0.0245, -0.0125, 0.0, 0.004, 0.007, 0.022, { color: C.st });
  for (const s of [-1, 1]) { gb.cyl('steel', s * 0.0225, 0.0, -0.17, 0.0045, 0.0045, 0.008, { axis: 'x', seg: 10, color: C.st2 }); gb.cyl('steel', s * 0.0225, 0.014, 0.12, 0.0035, 0.0035, 0.006, { axis: 'x', seg: 8, color: C.st2 }); }
  // magwell + băng đạn cong 30 viên + gờ
  side(gb, 'blk', [[0.0, -0.03], [0.0, -0.085], [0.11, -0.085], [0.12, -0.03]], 0.0175, 0, C.blk2);
  side(gb, 'poly', banana(0.063, -0.075, 0.215, 0.5, 0.047, 0.058), 0.0155, 0, C.mag, { bevel: 0.0028 });
  for (let i = 1; i < 7; i++) { const t = i / 7, a = 0.5 * t, R = 0.215 / 0.5, cu = 0.063 + R * (1 - Math.cos(a)), cv = -0.075 - R * Math.sin(a); gb.box('poly', 0, cv, -cu, 0.0378, 0.0028, 0.056 + t * 0.011, { color: 0x3f3e2f, rot: [-(Math.PI / 2 - (Math.PI / 2 - a)) * 0 + a, 0, 0] }); }
  // tay cầm súng + bảo vệ cò + cò
  side(gb, 'poly', [[0.018, -0.032], [-0.022, -0.032], [-0.056, -0.128], [-0.02, -0.136], [0.014, -0.075]], 0.0135, 0, C.blk, { bevel: 0.004 });
  for (let i = 0; i < 5; i++) gb.box('rubber', 0, -0.07 - i * 0.012, 0.02 + i * 0.0105, 0.0365, 0.004, 0.006, { color: C.rub, rot: [0.3, 0, 0] });
  side(gb, 'blk', [[0.028, -0.034], [0.03, -0.066], [0.05, -0.078], [0.09, -0.074], [0.1, -0.034], [0.092, -0.034], [0.085, -0.064], [0.052, -0.068], [0.04, -0.034]], 0.0035, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  gb.box('steel', 0, -0.055, -0.058, 0.004, 0.026, 0.005, { color: C.st2, rot: [-0.25, 0, 0] });
  // báng gập (khung hở) + má tì + đệm vai + bản lề
  side(gb, 'poly', [[-0.17, 0.034], [-0.3, 0.046], [-0.3, 0.014], [-0.17, 0.004]], 0.0135, 0, C.blk, { bevel: 0.003 });
  side(gb, 'poly', [[-0.17, -0.012], [-0.3, -0.058], [-0.3, -0.078], [-0.17, -0.034]], 0.0135, 0, C.blk, { bevel: 0.003 });
  slab(gb, 'rubber', -0.322, -0.298, -0.082, 0.05, 0.0165, 0, C.rub, { bevel: 0.004 });
  slab(gb, 'blk', -0.302, -0.296, -0.07, 0.04, 0.012, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  // ốp tay màu cát + lỗ thoáng + ray trên/dưới
  side(gb, 'tan', [[0.17, 0.042], [0.43, 0.038], [0.445, 0.0], [0.43, -0.038], [0.17, -0.042]], 0.0245, 0, C.tan, { bevel: 0.005 });
  side(gb, 'blk', [[0.17, 0.036], [0.43, 0.034], [0.43, 0.026], [0.17, 0.028]], 0.0255, 0, C.blk2, { bevel: 0.002 });
  rail(gb, 'steel', 0.19, 0.42, 0.04, 0.011, 0, C.st);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) gb.cyl('blk', s * 0.0296, 0.003, -(0.23 + i * 0.046), 0.011, 0.011, 0.003, { axis: 'x', seg: 14, color: 0x0b0b0b });
  for (const s of [-1, 1]) { gb.box('steel', s * 0.0298, 0.0, -0.44, 0.003, 0.05, 0.004, { color: C.st }); }
  slab(gb, 'blk', 0.2, 0.4, -0.05, -0.04, 0.012, 0, C.blk2, { bevel: 0.0015 });
  // vertical foregrip + đế gắn
  gb.cyl('rubber', 0, -0.1, -0.375, 0.0165, 0.0195, 0.1, { seg: 16, color: C.blk }); gb.cyl('blk', 0, -0.052, -0.375, 0.022, 0.016, 0.014, { seg: 16, color: C.blk2 });
  for (let i = 0; i < 4; i++) gb.cyl('rubber', 0, -0.075 - i * 0.017, -0.375, 0.0205, 0.0205, 0.004, { seg: 16, color: 0x0b0b0b });
  // đèn chiến thuật cạnh ốp tay
  gb.cyl('blk', 0.038, -0.002, -0.33, 0.0095, 0.0095, 0.085, { axis: 'z', seg: 14, color: C.blk }); gb.cyl('steel', 0.038, -0.002, -0.375, 0.0115, 0.0095, 0.012, { axis: 'z', seg: 14, color: C.chrome });
  gb.box('blk', 0.031, -0.002, -0.33, 0.012, 0.018, 0.03, { color: C.blk2 });
  // ống dẫn khí, nòng, khối ngắm trước, đầu giảm giật
  bar(gb, 'steel', 0.19, 0.45, 0.036, 0, 0.0095, 0.0095, C.st, 14); bar(gb, 'steel', 0.19, 0.64, 0.0, 0, 0.0088, 0.0088, C.st2, 16);
  side(gb, 'blk', [[0.44, 0.04], [0.5, 0.04], [0.5, -0.016], [0.44, -0.016]], 0.0105, 0, C.blk2, { bevel: 0.002 });
  side(gb, 'blk', [[0.468, 0.04], [0.49, 0.04], [0.488, 0.062], [0.474, 0.062]], 0.0035, 0, C.blk, { bevel: 0.0008, bevSeg: 1 });
  bar(gb, 'blk', 0.545, 0.64, 0.0, 0, 0.0185, 0.0172, C.blk, 20); bar(gb, 'steel', 0.636, 0.65, 0.0, 0, 0.0128, 0.0128, C.st2, 20);
  for (let i = 0; i < 3; i++) bar(gb, 'steel', 0.552 + i * 0.012, 0.557 + i * 0.012, 0.0, 0, 0.0192, 0.0192, C.st, 20);
  for (const s of [-1, 1]) { gb.cyl('blk', s * 0.0178, 0.0, -0.6, 0.0075, 0.0075, 0.003, { axis: 'x', seg: 12, color: 0x020202 }); gb.cyl('blk', s * 0.0178, 0.0, -0.575, 0.0075, 0.0075, 0.003, { axis: 'x', seg: 12, color: 0x020202 }); }
  gb.cyl('blk', 0, 0.0, -0.644, 0.0062, 0.0062, 0.006, { axis: 'z', seg: 12, color: 0x020202 });
  // ngắm cơ sau + red dot
  side(gb, 'steel', [[0.14, 0.052], [0.17, 0.052], [0.168, 0.066], [0.145, 0.066]], 0.006, 0, C.st2, { bevel: 0.001, bevSeg: 1 });
  const extra = [];
  redDot(gb, 0.04, 0.057, extra);
  const g = finish(gb, extra);
  g.userData = { name: 'AK-12', length: 0.95, muzzle: new THREE.Vector3(0, 0, -0.65), gripR: new THREE.Vector3(0, -0.085, 0.015), gripL: new THREE.Vector3(0, -0.092, -0.375), sight: new THREE.Vector3(0, 0.085, -0.04), mag: new THREE.Vector3(0, -0.18, -0.09), eject: new THREE.Vector3(0.02, 0.02, -0.05) };
  return g;
}

// ======================= MP7 =======================
export function buildMP7() {
  const gb = new GeoBuilder(), ex = [];
  side(gb, 'blk', [[-0.1, 0.04], [-0.1, -0.03], [0.0, -0.036], [0.2, -0.03], [0.24, -0.012], [0.24, 0.036], [0.0, 0.044]], 0.0165, 0, C.blk2, { bevel: 0.004 });
  rail(gb, 'steel', -0.06, 0.22, 0.044, 0.01, 0, C.st);
  side(gb, 'poly', [[0.02, -0.03], [-0.02, -0.03], [-0.05, -0.115], [-0.018, -0.12], [0.012, -0.07]], 0.0135, 0, C.blk, { bevel: 0.004 });
  side(gb, 'poly', [[0.052, -0.03], [0.052, -0.14], [0.085, -0.14], [0.085, -0.03]], 0.0125, 0, C.blk, { bevel: 0.003 });
  gb.cyl('rubber', 0, -0.07, -0.19, 0.0135, 0.0145, 0.075, { seg: 14, color: C.blk }); // tay cầm trước gập
  side(gb, 'blk', [[0.03, -0.034], [0.034, -0.062], [0.05, -0.07], [0.09, -0.066], [0.098, -0.034]], 0.003, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  // báng thu gọn: 2 thanh thép + đệm
  for (const s of [-1, 1]) bar(gb, 'steel', -0.2, -0.1, 0.012, s * 0.016, 0.0055, 0.0055, C.st, 10);
  slab(gb, 'rubber', -0.226, -0.2, -0.046, 0.044, 0.0165, 0, C.rub, { bevel: 0.0035 });
  slab(gb, 'blk', -0.2, -0.198, -0.03, 0.03, 0.0165, 0, C.blk2, { bevel: 0.0005, bevSeg: 1 });
  // nòng + giảm thanh ngắn + ngắm trước
  bar(gb, 'steel', 0.24, 0.31, 0.0, 0, 0.0075, 0.0075, C.st2, 12);
  bar(gb, 'blk', 0.285, 0.355, 0.0, 0, 0.0128, 0.0128, C.blk, 16); bar(gb, 'steel', 0.352, 0.36, 0.0, 0, 0.01, 0.01, C.st, 16);
  slab(gb, 'blk', 0.24, 0.255, 0.036, 0.052, 0.003, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  slab(gb, 'blk', -0.07, -0.05, 0.044, 0.056, 0.003, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  redDot(gb, 0.07, 0.049, ex);
  const g = finish(gb, ex);
  g.userData = { name: 'MP7', length: 0.585, muzzle: new THREE.Vector3(0, 0, -0.36), gripR: new THREE.Vector3(0, -0.075, 0.012), gripL: new THREE.Vector3(0, -0.07, -0.19), sight: new THREE.Vector3(0, 0.075, -0.07), mag: new THREE.Vector3(0, -0.14, -0.07), eject: new THREE.Vector3(0.02, 0.02, -0.08) };
  return g;
}

// ======================= G17 =======================
export function buildPistol() {
  const gb = new GeoBuilder(), ex = [];
  side(gb, 'steel', [[-0.075, 0.026], [-0.075, -0.012], [0.095, -0.012], [0.098, 0.014], [0.092, 0.026]], 0.0125, 0, 0x16171a, { bevel: 0.0035 }); // slide
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) gb.box('steel', s * 0.0158, 0.007, 0.062 - i * 0.0042 + 0.0, 0.0012, 0.026, 0.0016, { color: 0x08080a });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) gb.box('steel', s * 0.0158, 0.007, -0.052 - i * 0.0042, 0.0012, 0.026, 0.0016, { color: 0x08080a });
  side(gb, 'poly', [[-0.07, -0.012], [0.09, -0.012], [0.09, -0.03], [0.05, -0.034], [0.012, -0.034], [-0.012, -0.036], [-0.05, -0.135], [-0.075, -0.135], [-0.078, -0.012]], 0.0115, 0, C.blk, { bevel: 0.0035 }); // khung + báng
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) gb.box('rubber', s * 0.0148, -0.06 - i * 0.012, 0.03 + i * 0.0035, 0.0015, 0.0045, 0.02, { color: 0x0a0a0a, rot: [0.32, 0, 0] });
  side(gb, 'blk', [[0.008, -0.034], [0.011, -0.058], [0.025, -0.064], [0.05, -0.062], [0.056, -0.034], [0.05, -0.034], [0.044, -0.054], [0.028, -0.056], [0.02, -0.034]], 0.0028, 0, C.blk2, { bevel: 0.0006, bevSeg: 1 });
  gb.box('steel', 0, -0.046, -0.01, 0.004, 0.02, 0.004, { color: C.st2, rot: [-0.2, 0, 0] });
  gb.box('steel', 0, 0.029, -0.088, 0.008, 0.006, 0.008, { color: 0x0a0a0a }); gb.box('steel', 0, 0.029, 0.066, 0.01, 0.006, 0.008, { color: 0x0a0a0a });
  bar(gb, 'steel', 0.098, 0.106, 0.012, 0, 0.0052, 0.0052, C.st, 12);
  gb.box('blk', 0, -0.137, 0.05, 0.026, 0.006, 0.026, { color: C.blk2 });
  const g = finish(gb, ex);
  g.userData = { name: 'G17', length: 0.2, muzzle: new THREE.Vector3(0, 0.012, -0.106), gripR: new THREE.Vector3(0, -0.05, 0.03), gripL: new THREE.Vector3(0, -0.08, 0.02), sight: new THREE.Vector3(0, 0.03, -0.04), mag: new THREE.Vector3(0, -0.12, 0.05), eject: new THREE.Vector3(0.015, 0.02, -0.03) };
  return g;
}

// ======================= SG-12 (shotgun bơm) =======================
export function buildShotgun() {
  const gb = new GeoBuilder();
  side(gb, 'steel', [[-0.12, 0.034], [-0.12, -0.03], [0.0, -0.04], [0.14, -0.04], [0.15, 0.034]], 0.0185, 0, C.st, { bevel: 0.004 });
  slab(gb, 'blk', 0.0, 0.07, 0.006, 0.026, 0.001, 0.0225, 0x0c0c0d, { bevel: 0.0005, bevSeg: 1 });
  side(gb, 'poly', [[0.016, -0.036], [-0.025, -0.036], [-0.058, -0.125], [-0.022, -0.132], [0.012, -0.08]], 0.0135, 0, C.blk, { bevel: 0.004 });
  side(gb, 'blk', [[0.026, -0.04], [0.03, -0.068], [0.05, -0.076], [0.09, -0.072], [0.098, -0.04]], 0.003, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  // báng gỗ có má tì
  side(gb, 'wood', [[-0.12, 0.03], [-0.38, 0.03], [-0.4, -0.08], [-0.38, -0.088], [-0.12, -0.034]], 0.0135, 0, C.wood, { bevel: 0.005 });
  slab(gb, 'rubber', -0.412, -0.388, -0.092, 0.034, 0.0155, 0, C.rub, { bevel: 0.004 });
  // nòng + ống chứa đạn + tay bơm
  bar(gb, 'steel', 0.15, 0.62, 0.016, 0, 0.0115, 0.0115, 0x2f3236, 18); bar(gb, 'steel', 0.15, 0.5, -0.02, 0, 0.0125, 0.0125, 0x2f3236, 18);
  bar(gb, 'poly', 0.2, 0.37, -0.02, 0, 0.0215, 0.0215, C.blk, 18);
  for (let i = 0; i < 7; i++) bar(gb, 'rubber', 0.21 + i * 0.02, 0.216 + i * 0.02, -0.02, 0, 0.0222, 0.0222, 0x0a0a0a, 18);
  bar(gb, 'steel', 0.5, 0.505, -0.02, 0, 0.0155, 0.0155, C.st2, 14); bar(gb, 'steel', 0.6, 0.64, 0.016, 0, 0.0125, 0.0125, C.st2, 18);
  gb.box('steel', 0, 0.034, -0.6, 0.006, 0.014, 0.008, { color: 0x0a0a0a }); gb.box('steel', 0, 0.038, -0.1, 0.012, 0.012, 0.014, { color: 0x0a0a0a });
  slab(gb, 'steel', -0.06, 0.15, 0.034, 0.042, 0.004, 0, C.st2, { bevel: 0.0008, bevSeg: 1 });
  const g = finish(gb);
  g.userData = { name: 'SG-12', length: 1.05, muzzle: new THREE.Vector3(0, 0.016, -0.64), gripR: new THREE.Vector3(0, -0.085, 0.015), gripL: new THREE.Vector3(0, -0.02, -0.285), sight: new THREE.Vector3(0, 0.05, -0.1), mag: new THREE.Vector3(0, -0.05, -0.1), eject: new THREE.Vector3(0.02, 0.02, -0.04) };
  return g;
}

// ======================= SR-7 (súng bắn tỉa bơm tay + ống ngắm) =======================
export function buildSniper() {
  const gb = new GeoBuilder(), ex = [];
  side(gb, 'blk', [[-0.1, 0.03], [-0.1, -0.03], [0.0, -0.04], [0.24, -0.04], [0.26, 0.03]], 0.0175, 0, C.blk2, { bevel: 0.004 });
  slab(gb, 'steel', -0.02, 0.26, 0.03, 0.04, 0.012, 0, C.st, { bevel: 0.0015 });
  rail(gb, 'steel', -0.02, 0.255, 0.04, 0.011, 0, C.st);
  side(gb, 'poly', [[0.016, -0.036], [-0.025, -0.036], [-0.055, -0.125], [-0.02, -0.133], [0.012, -0.08]], 0.0135, 0, C.blk, { bevel: 0.004 });
  side(gb, 'blk', [[0.028, -0.04], [0.032, -0.068], [0.05, -0.076], [0.09, -0.072], [0.098, -0.04]], 0.003, 0, C.blk2, { bevel: 0.0008, bevSeg: 1 });
  side(gb, 'poly', [[0.07, -0.04], [0.07, -0.1], [0.115, -0.1], [0.115, -0.04]], 0.013, 0, C.mag, { bevel: 0.003 }); // hộp tiếp đạn
  // báng khung nhôm điều chỉnh + má tì
  side(gb, 'poly', [[-0.1, 0.03], [-0.34, 0.052], [-0.34, -0.02], [-0.1, -0.034]], 0.013, 0, C.blk, { bevel: 0.0035 });
  slab(gb, 'rubber', -0.372, -0.346, -0.086, 0.056, 0.0165, 0, C.rub, { bevel: 0.0035 });
  side(gb, 'poly', [[-0.12, -0.03], [-0.346, -0.026], [-0.346, -0.086], [-0.32, -0.1], [-0.2, -0.04]], 0.0095, 0, C.blk, { bevel: 0.003 });
  side(gb, 'rubber', [[-0.1, 0.03], [-0.3, 0.048], [-0.3, 0.06], [-0.1, 0.042]], 0.0125, 0, C.blk2, { bevel: 0.003 });
  // ốp tay + nòng dài + giảm giật + chân chống
  side(gb, 'poly', [[0.24, 0.032], [0.55, 0.026], [0.55, -0.026], [0.24, -0.034]], 0.0185, 0, C.blk, { bevel: 0.004 });
  rail(gb, 'steel', 0.26, 0.5, 0.03, 0.01, 0, C.st);
  bar(gb, 'steel', 0.24, 0.9, 0.0, 0, 0.0105, 0.0085, C.st2, 18); bar(gb, 'blk', 0.78, 0.9, 0.0, 0, 0.0155, 0.0155, C.blk, 18);
  for (let i = 0; i < 4; i++) bar(gb, 'steel', 0.79 + i * 0.022, 0.795 + i * 0.022, 0.0, 0, 0.0162, 0.0162, C.st, 18);
  for (const s of [-1, 1]) { bar(gb, 'steel', 0.36, 0.52, -0.034, s * 0.03, 0.0035, 0.0035, C.st2, 8); gb.box('steel', s * 0.03, -0.034, -0.36, 0.008, 0.01, 0.014, { color: C.st }); }
  // tay kéo bơm bên phải
  gb.cyl('steel', 0.045, 0.014, -0.02, 0.0045, 0.0045, 0.045, { axis: 'x', seg: 10, color: C.st2, rot: [0, 0, 0] }); gb.sphere('steel', 0.072, 0.014, -0.02, 0.0095, 0.0095, 0.0095, { color: C.st, ws: 12, hs: 8 });
  // ống ngắm 4–12x: thân + chuông trước/sau + núm chỉnh + gắn
  const sv = 0.092;
  bar(gb, 'blk', 0.0, 0.2, sv, 0, 0.0155, 0.0155, C.blk, 20);
  bar(gb, 'blk', -0.07, 0.0, sv, 0, 0.0185, 0.0155, C.blk2, 20); bar(gb, 'blk', 0.2, 0.28, sv, 0, 0.0155, 0.026, C.blk2, 20);
  bar(gb, 'steel', 0.0, 0.2, sv + 0.001, 0, 0.0158, 0.0158, 0x15161a, 20);
  gb.cyl('blk', 0, sv + 0.022, -0.1, 0.0075, 0.0075, 0.014, { seg: 12, color: C.blk2 }); gb.cyl('blk', 0.022, sv, -0.1, 0.0075, 0.0075, 0.014, { axis: 'x', seg: 12, color: C.blk2 });
  for (const u of [0.04, 0.17]) { slab(gb, 'steel', u - 0.012, u + 0.012, 0.04, sv - 0.014, 0.0095, 0, C.st, { bevel: 0.0015 }); }
  const lensF = new THREE.Mesh(new THREE.CircleGeometry(0.0235, 24), new THREE.MeshStandardMaterial({ color: 0x1a3a46, roughness: 0.04, metalness: 0.6, emissive: 0x0a2530, emissiveIntensity: 0.4 })); lensF.position.set(0, sv, -0.2805); lensF.rotation.y = Math.PI; ex.push(lensF);
  const lensR = new THREE.Mesh(new THREE.CircleGeometry(0.0145, 24), new THREE.MeshStandardMaterial({ color: 0x1a3a46, roughness: 0.04, metalness: 0.6 })); lensR.position.set(0, sv, 0.0705); ex.push(lensR);
  const g = finish(gb, ex);
  g.userData = { name: 'SR-7', length: 1.27, muzzle: new THREE.Vector3(0, 0, -0.9), gripR: new THREE.Vector3(0, -0.085, 0.015), gripL: new THREE.Vector3(0, -0.02, -0.38), sight: new THREE.Vector3(0, 0.092, 0.0), mag: new THREE.Vector3(0, -0.09, -0.09), eject: new THREE.Vector3(0.03, 0.014, -0.02), scope: true };
  return g;
}
export const BUILDERS = { ak12: buildAK12, mp7: buildMP7, pistol: buildPistol, shotgun: buildShotgun, sniper: buildSniper };
