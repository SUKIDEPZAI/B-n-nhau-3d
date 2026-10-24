// Làng Địa Trung Hải 1:1 (mét): phố chính, quảng trường, nhà 2 tầng ngói đất nung, nhà xanh có
// loggia gỗ + tháp nhỏ như ảnh tham chiếu, cây tròn, cây bách, hàng rào ván, dây điện, v.v.
import * as THREE from 'three';
import { GeoBuilder, Frame } from '../core/geo.js';
import { RNG } from '../core/util.js';
import { World } from '../core/phys.js';

export function createMaterials(T, pbr = true) {
  const Mat = pbr ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
  const m = (o) => new Mat({ vertexColors: true, ...o });
  const tex = (t, bs = 1.5) => ({ map: T[t].map, bumpMap: pbr ? T[t].bump : null, bumpScale: bs });
  const rp = pbr ? (r, me = 0) => ({ roughness: r, metalness: me }) : () => ({});
  const M = {
    plaster: m({ ...tex('plaster', 1.2), ...rp(0.95) }),
    roof: m({ ...tex('roof', 3), ...rp(0.85), side: THREE.DoubleSide }),
    asphalt: m({ ...tex('asphalt', 1), ...rp(0.95) }),
    grass: m({ ...tex('grass', 0.5), ...rp(1) }),
    dirt: m({ ...tex('dirt', 1.5), ...rp(1) }),
    wood: m({ ...tex('wood', 1), ...rp(0.8), side: THREE.DoubleSide }),
    shutter: m({ ...tex('shutter', 1), ...rp(0.85) }),
    cobble: m({ ...tex('cobble', 2), ...rp(0.9) }),
    stone: m({ ...tex('stone', 2), ...rp(0.95) }),
    slab: m({ ...tex('slab', 1), ...rp(0.9) }),
    brick: m({ ...tex('brick', 1.5), ...rp(0.9) }),
    leaf: m({ map: T.leaf.map, ...rp(0.85) }),
    bark: m({ ...tex('bark', 1), ...rp(0.95) }),
    glass: m({ ...rp(0.08, 0.1) }),
    metal: m({ ...rp(0.45, 0.8) }),
    paint: m({ ...rp(0.7, 0.05), side: THREE.DoubleSide }),
    wire: m({ ...rp(0.6) }),
    fabric: m({ ...rp(0.95), side: THREE.DoubleSide }),
  };
  return M;
}

const TRIM = 0xefe6d2;
const WALLS = { terra: 0xcb7d55, blue: 0x5a8fae, cream: 0xe3d4b2, ochre: 0xd6a95e, rose: 0xcb8c7c, green: 0xa4b89a };
const SHUT = { terra: 0x6a8a62, blue: 0x7a4a2c, cream: 0x4f7a6a, ochre: 0x7a4a2c, rose: 0x5a7a8c, green: 0x7a4a2c };

// nhà: x0,z0,x1,z1, front (hướng mặt tiền), floors, c (màu tường), flags
const HOUSES = [
  // hàng Tây (mặt hướng +x ra phố chính)
  { x0: -19.5, z0: -58, x1: -6.5, z1: -46, f: '+x', fl: 2, c: 'terra' },
  { x0: -18.5, z0: -43, x1: -6.5, z1: -31, f: '+x', fl: 2, c: 'blue', balc: 1 },
  { x0: -20.5, z0: -28, x1: -6.5, z1: -17, f: '+x', fl: 2, c: 'cream', balc: 1 },
  { x0: -17.5, z0: -14, x1: -6.5, z1: -6, f: '+x', fl: 1, c: 'ochre', shop: 1 },
  { x0: -19.5, z0: 15, x1: -6.5, z1: 26, f: '+x', fl: 2, c: 'rose', balc: 1 },
  { x0: -18.5, z0: 29, x1: -6.5, z1: 41, f: '+x', fl: 2, c: 'blue', balc: 1, chim: 1 },
  { x0: -20.5, z0: 44, x1: -6.5, z1: 56, f: '+x', fl: 2, c: 'terra' },
  // hàng Đông (mặt hướng -x)
  { x0: 6.5, z0: -58, x1: 19.5, z1: -46, f: '-x', fl: 2, c: 'cream', chim: 1 },
  { x0: 6.5, z0: -43, x1: 18.5, z1: -31, f: '-x', fl: 2, c: 'terra' },
  { x0: 6.5, z0: -28, x1: 20.5, z1: -17, f: '-x', fl: 2, c: 'rose', balc: 1 },
  { x0: 6.5, z0: -14, x1: 18.5, z1: -6, f: '-x', fl: 2, c: 'ochre' },
  { x0: 6.5, z0: 15, x1: 20.5, z1: 27, f: '-x', fl: 2, c: 'blue', loggia: 1, cupola: 1 }, // nhà xanh trong ảnh
  { x0: 6.5, z0: 30, x1: 19.5, z1: 41, f: '-x', fl: 2, c: 'ochre', balc: 1 },
  { x0: 6.5, z0: 44, x1: 20.5, z1: 56, f: '-x', fl: 2, c: 'rose' },
  // hàng sau
  { x0: -44, z0: -40, x1: -31, z1: -28, f: '+x', fl: 1, c: 'terra' },
  { x0: -44, z0: 14, x1: -31, z1: 26, f: '+x', fl: 2, c: 'cream' },
  { x0: 31, z0: -40, x1: 44, z1: -28, f: '-x', fl: 2, c: 'ochre' },
  { x0: 31, z0: 14, x1: 44, z1: 26, f: '-x', fl: 2, c: 'blue', balc: 1 },
  { x0: 31, z0: -12, x1: 45, z1: 4, f: '-x', fl: 2, c: 'cream', cupola: 1 },
];

function windowAt(F, u, y, w, h, shut, flowers) {
  F.box('plaster', u, y, 0.04, w + 0.3, h + 0.3, 0.08, { color: TRIM });
  F.box('glass', u, y, 0.09, w, h, 0.02, { color: 0x1d2a33 });
  F.box('plaster', u, y, 0.11, 0.05, h, 0.03, { color: TRIM });
  F.box('plaster', u, y + 0.12, 0.11, w, 0.05, 0.03, { color: TRIM });
  F.box('stone', u, y - h / 2 - 0.13, 0.13, w + 0.44, 0.08, 0.28, { color: 0xd2c9b2 });
  if (shut !== undefined) for (const s of [-1, 1]) F.box('shutter', u + s * (w / 2 + w / 4 + 0.14), y, 0.07, w / 2, h + 0.1, 0.05, { color: shut });
  if (flowers) {
    F.box('wood', u, y - h / 2 - 0.3, 0.3, w + 0.2, 0.2, 0.26, { color: 0x6a4a30 });
    for (let k = 0; k < 6; k++) F.sphere('leaf', u - w / 2 + (k + 0.5) * (w / 6), y - h / 2 - 0.12, 0.3, 0.1, 0.09, 0.1, { ws: 6, hs: 4, color: k % 2 ? 0xd8466a : 0x5f9a3c });
  }
}

function buildHouse(gb, world, s, rng) {
  const front = s.f;
  const alongZ = front === '+x' || front === '-x';
  const W = alongZ ? s.z1 - s.z0 : s.x1 - s.x0, D = alongZ ? s.x1 - s.x0 : s.z1 - s.z0;
  const yaw = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }[front];
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  const F = new Frame(gb, cx, 0, cz, yaw);
  const col = WALLS[s.c], shut = SHUT[s.c], H = s.fl * 3.1 + 0.3;
  const hall = s.shop ? 3.6 : 3.1;
  const Hh = s.fl === 1 ? hall + 0.3 : H;
  // thân + chân đá
  F.box('stone', 0, 0.35, 0, W + 0.1, 0.7, D + 0.1, { color: 0xbdb39c });
  F.box('plaster', 0, 0.7 + (Hh - 0.7) / 2, 0, W, Hh - 0.7, D, { color: col, shade: [0.86, 1] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box('plaster', sx * (W / 2), Hh / 2 + 0.35, sz * (D / 2), 0.32, Hh - 0.7, 0.32, { color: TRIM });
  if (s.fl > 1) for (let f = 1; f < s.fl; f++) F.box('plaster', 0, f * 3.1 + 0.3, 0, W + 0.12, 0.22, D + 0.12, { color: TRIM });
  // các mặt
  const faces = [
    { fr: F.sub(0, 0, D / 2, 0), L: W, front: true },
    { fr: F.sub(0, 0, -D / 2, Math.PI), L: W },
    { fr: F.sub(W / 2, 0, 0, Math.PI / 2), L: D },
    { fr: F.sub(-W / 2, 0, 0, -Math.PI / 2), L: D },
  ];
  for (const fc of faces) {
    const n = Math.max(1, Math.round(fc.L / 3.0));
    for (let f = 0; f < s.fl; f++)
      for (let i = 0; i < n; i++) {
        const u = -fc.L / 2 + (i + 0.5) * (fc.L / n);
        const isDoor = fc.front && f === 0 && i === (n >> 1);
        if (isDoor) {
          fc.fr.box('plaster', u, 1.2, 0.05, 1.5, 2.4, 0.1, { color: TRIM });
          fc.fr.box('wood', u, 1.15, 0.12, 1.05, 2.2, 0.06, { color: s.shop ? 0x3d5a46 : 0x5a3a24 });
          fc.fr.box('metal', u + 0.38, 1.1, 0.17, 0.05, 0.14, 0.04, { color: 0xc9a85a });
          fc.fr.box('stone', u, 0.1, 0.35, 1.7, 0.2, 0.7, { color: 0xcfc6b0 });
        } else if (!(s.shop && fc.front && f === 0)) {
          windowAt(fc.fr, u, f * 3.1 + 1.75, 0.95, 1.45, f % 2 ? shut : fc.front ? shut : undefined, fc.front && f === 1 && rng.chance(0.4));
        } else {
          // cửa kính cửa hàng
          fc.fr.box('plaster', u, 1.5, 0.05, 2.2, 1.7, 0.1, { color: TRIM });
          fc.fr.box('glass', u, 1.5, 0.1, 2.0, 1.5, 0.02, { color: 0x24323a });
        }
      }
  }
  if (s.shop) {
    // mái hiên sọc
    const A = faces[0].fr;
    for (let k = 0; k < 10; k++) A.box('fabric', -W / 2 + 0.8 + (k + 0.5) * ((W - 1.6) / 10), 2.9 - 0.12, 0.8, (W - 1.6) / 10, 0.05, 1.7, { color: k % 2 ? 0xe9e1cc : 0xb4432f, rot: [0.22, 0, 0] });
  }
  // ban công gỗ / loggia
  if ((s.balc || s.loggia) && s.fl > 1) {
    const A = faces[0].fr, bw = s.loggia ? W - 1.2 : Math.min(4.6, W * 0.55), d = 1.3, y = 3.4;
    const wood = s.loggia ? 0x7a5236 : 0x5a3a26;
    A.box('wood', 0, y, d / 2, bw, 0.14, d, { color: wood });
    for (let k = -2; k <= 2; k++) A.box('wood', k * (bw / 4.4), y - 0.35, d - 0.25, 0.1, 0.1, 0.9, { color: wood, rot: [0.7, 0, 0] });
    const nb = Math.floor(bw / 0.13);
    for (let k = 0; k <= nb; k++) A.box('wood', -bw / 2 + k * (bw / nb), y + 0.58, d - 0.04, 0.035, 1.0, 0.035, { color: wood });
    A.box('wood', 0, y + 1.1, d - 0.04, bw, 0.07, 0.09, { color: wood });
    for (const sx of [-1, 1]) { A.box('wood', sx * (bw / 2 - 0.04), y + 0.58, d / 2, 0.035, 1.0, d, { color: wood }); A.box('wood', sx * (bw / 2 - 0.04), y + 1.1, d / 2, 0.09, 0.07, d, { color: wood }); }
    if (s.loggia) {
      for (let k = 0; k <= 4; k++) { A.box('wood', -bw / 2 + 0.1 + k * ((bw - 0.2) / 4), y + 1.5, d - 0.08, 0.14, 3.0, 0.14, { color: wood }); }
      for (let k = 0; k < 4; k++) { const ux = -bw / 2 + 0.1 + (k + 0.5) * ((bw - 0.2) / 4), w2 = (bw - 0.2) / 4 - 0.1; A.box('wood', ux, y + 0.6, d - 0.05, w2 * 1.05, 0.05, 0.05, { color: wood, rot: [0, 0, 0.62] }); A.box('wood', ux, y + 0.6, d - 0.05, w2 * 1.05, 0.05, 0.05, { color: wood, rot: [0, 0, -0.62] }); }
      // mái hiên gỗ nâu của loggia
      A.box('wood', 0, y + 3.05, d / 2 - 0.1, bw + 0.8, 0.12, d + 0.9, { color: 0x6b4a32, rot: [0.1, 0, 0] });
    }
  }
  // mái ngói
  const k = 0.42, oh = 0.65, ohs = 0.5, hs = D / 2 + oh, L = W / 2 + ohs, rise = k * (D / 2), drop = k * oh, y0 = Hh;
  F.quad('roof', [-L, y0 - drop, hs], [L, y0 - drop, hs], [L, y0 + rise, 0], [-L, y0 + rise, 0], { flipV: true, uv: 1 });
  F.quad('roof', [L, y0 - drop, -hs], [-L, y0 - drop, -hs], [-L, y0 + rise, 0], [L, y0 + rise, 0], { flipV: true, uv: 1 });
  F.quad('wood', [-L, y0 - drop - 0.14, hs], [L, y0 - drop - 0.14, hs], [L, y0 - drop, hs], [-L, y0 - drop, hs], { color: 0x4a3426 });
  F.quad('wood', [L, y0 - drop - 0.14, -hs], [-L, y0 - drop - 0.14, -hs], [-L, y0 - drop, -hs], [L, y0 - drop, -hs], { color: 0x4a3426 });
  F.quad('paint', [-L, y0 - drop - 0.05, hs], [L, y0 - drop - 0.05, hs], [L, y0 - drop - 0.05, -hs], [-L, y0 - drop - 0.05, -hs], { color: 0x3a2c22 });
  F.box('roof', 0, y0 + rise + 0.06, 0, 2 * L, 0.14, 0.34, { color: 0xb8704c, uv: 1 });
  for (const sx of [-1, 1]) F.tri('plaster', sx > 0 ? [W / 2, y0, D / 2] : [-W / 2, y0, -D / 2], sx > 0 ? [W / 2, y0, -D / 2] : [-W / 2, y0, D / 2], [sx * (W / 2), y0 + rise, 0], { color: col });
  // ống khói
  if (s.chim || rng.chance(0.4)) { F.box('brick', W * 0.28, y0 + rise * 0.5 + 0.9, -D * 0.2, 0.7, 1.9, 0.7, { color: 0xe6d6c0 }); F.box('stone', W * 0.28, y0 + rise * 0.5 + 1.9, -D * 0.2, 0.92, 0.12, 0.92, { color: 0x9c9484 }); }
  // máng xối + ống thoát
  F.cyl('metal', 0, y0 - drop - 0.2, hs - 0.02, 0.05, 0.05, 2 * L, { axis: 'x', color: 0x6c7075, seg: 6 });
  F.cyl('metal', W / 2 - 0.1, Hh / 2, D / 2 + 0.07, 0.045, 0.045, Hh, { color: 0x6c7075, seg: 6 });
  // tháp nhỏ (cupola) trên mái
  if (s.cupola) {
    const tx = W * 0.22, ty = y0 + rise - 0.2;
    F.box('plaster', tx, ty + 1.0, 0, 1.9, 2.4, 1.9, { color: col });
    for (const q of [[0, 0.96], [0, -0.96]]) F.box('shutter', tx, ty + 1.3, q[1], 0.9, 1.1, 0.06, { color: 0x5a3a24 });
    for (const q of [[0.96, 0], [-0.96, 0]]) F.box('shutter', tx + q[0], ty + 1.3, 0, 0.06, 1.1, 0.9, { color: 0x5a3a24 });
    const py = ty + 2.2;
    const a = [tx - 1.25, py, -1.25], b = [tx + 1.25, py, -1.25], c = [tx + 1.25, py, 1.25], d2 = [tx - 1.25, py, 1.25], ap = [tx, py + 2.1, 0];
    F.tri('roof', a, b, ap, { uv: 1, color: 0xb8704c }); F.tri('roof', b, c, ap, { uv: 1, color: 0xb8704c }); F.tri('roof', c, d2, ap, { uv: 1, color: 0xb8704c }); F.tri('roof', d2, a, ap, { uv: 1, color: 0xb8704c });
    F.cyl('metal', tx, py + 2.45, 0, 0.02, 0.03, 0.7, { color: 0x333333, seg: 5 });
  }
  // va chạm: thân nhà (cao tới đỉnh mái)
  world.add(s.x0, 0, s.z0, s.x1, y0 + rise, s.z1, 'wall');
  return { cx, cz };
}

function fenceLine(gb, world, x0, z0, x1, z1, h = 1.8, col = 0x4d3a3c) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const F = new Frame(gb, cx, 0, cz, ang);
  F.box('wood', 0, h / 2, 0, len, h, 0.05, { color: col, uv: 1 });
  F.box('wood', 0, h * 0.2, -0.05, len, 0.08, 0.05, { color: col });
  F.box('wood', 0, h * 0.8, -0.05, len, 0.08, 0.05, { color: col });
  for (let t = 0; t <= len; t += 2.4) F.box('wood', -len / 2 + t, h / 2 + 0.05, 0, 0.12, h + 0.1, 0.12, { color: 0x3a2c2e });
  world.add(Math.min(x0, x1) - 0.1, 0, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, h, Math.max(z0, z1) + 0.1, 'wood');
}
function stoneWall(gb, world, x0, z0, x1, z1, h = 1.0) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0) + 0.5, d = Math.abs(z1 - z0) + 0.5;
  gb.box('stone', cx, h / 2, cz, w, h, d, { color: 0xcfc4a8 });
  gb.box('stone', cx, h + 0.05, cz, w + 0.1, 0.12, d + 0.1, { color: 0xddd2b8 });
  world.add(cx - w / 2, 0, cz - d / 2, cx + w / 2, h + 0.1, cz + d / 2, 'stone');
}
function pillar(gb, world, x, z, h = 2.0) {
  gb.box('stone', x, h / 2, z, 0.6, h, 0.6, { color: 0xc8bc9c });
  gb.box('stone', x, h + 0.08, z, 0.74, 0.16, 0.74, { color: 0xddd2b8 });
  world.add(x - 0.3, 0, z - 0.3, x + 0.3, h + 0.16, z + 0.3, 'stone');
}
function hedge(gb, world, x, z, w, d, h = 1.3, rng) {
  const along = w >= d;
  gb.box('leaf', x, h / 2 - 0.1, z, w, h - 0.2, d, { color: 0x4f7a34, uv: 1.2, shade: [0.55, 1] });
  const n = Math.max(2, Math.round((along ? w : d) / 0.9));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    gb.sphere('leaf', x + (along ? t * w : 0), h - 0.15, z + (along ? 0 : t * d), (along ? w / n : d) * 0.7 + 0.15, 0.4, (along ? d : d / n) * 0.7 + 0.15, { ws: 7, hs: 5, color: rng.pick([0x5d8a3a, 0x4a7430, 0x6c9840]), uv: 1 });
  }
  world.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'soft');
}
function roundTree(gb, world, x, z, s = 1, rng) {
  gb.cyl('bark', x, 1.2 * s, z, 0.1 * s, 0.17 * s, 2.4 * s, { seg: 7 });
  const geo = new THREE.IcosahedronGeometry(1, 3), p = geo.attributes.position, v = new THREE.Vector3();
  const ph = rng.range(0, 99);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * 4.1 + ph) * Math.sin(v.y * 3.7 + ph * 0.7) * Math.sin(v.z * 4.3 + ph * 1.3);
    v.multiplyScalar(1 + n * 0.14);
    p.setXYZ(i, v.x * 1.9 * s, v.y * 1.6 * s, v.z * 1.9 * s);
  }
  geo.computeVertexNormals();
  gb.geometry('leaf', geo, GeoBuilder.mat(x, 3.9 * s, z), { color: 0xffffff, uvScale: 3, shade: [0.5, 1.08], shadeY0: 2.4 * s, shadeH: 3 * s });
  geo.dispose();
  world.add(x - 0.2, 0, z - 0.2, x + 0.2, 2.6 * s, z + 0.2, 'wood');
}
function cypress(gb, world, x, z, h, rng) {
  const pts = [];
  const r = 0.5 + h * 0.045;
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(0.02, r * Math.sin(Math.pow(t, 0.7) * Math.PI) * (1 - t * 0.25) + 0.02), t * h)); }
  const geo = new THREE.LatheGeometry(pts, 8);
  gb.geometry('leaf', geo, GeoBuilder.mat(x, 0.3, z, 0, rng.range(0, 6), 0), { color: 0x5f8a58, uvScale: 2, shade: [0.45, 1], shadeY0: 0, shadeH: h });
  geo.dispose();
  if (world) world.add(x - 0.15, 0, z - 0.15, x + 0.15, 4, z + 0.15, 'wood');
}
function barrel(gb, world, x, z) {
  const pts = [[0.001, 0], [0.26, 0], [0.31, 0.2], [0.33, 0.45], [0.31, 0.7], [0.26, 0.9], [0.001, 0.9]].map((p) => new THREE.Vector2(p[0], p[1]));
  const geo = new THREE.LatheGeometry(pts, 12);
  gb.geometry('wood', geo, GeoBuilder.mat(x, 0, z), { color: 0x8a5a36, uvScale: 1 });
  geo.dispose();
  for (const y of [0.15, 0.45, 0.75]) gb.cyl('metal', x, y, z, y === 0.45 ? 0.335 : 0.315, y === 0.45 ? 0.335 : 0.315, 0.04, { color: 0x4a4a4a, seg: 12 });
  world.addC(x, z, 0.66, 0.66, 0.9, 'wood');
}
function crate(gb, world, x, z, s = 0.8, rot = 0) {
  gb.box('wood', x, s / 2, z, s, s, s, { color: 0x9a7448, rot: [0, rot, 0], uv: 0.8 });
  gb.box('wood', x, s / 2, z, s + 0.04, 0.08, s + 0.04, { color: 0x6a4a2c, rot: [0, rot, 0] });
  world.addC(x, z, s * 1.05, s * 1.05, s, 'wood');
}
function bench(gb, world, x, z, yaw) {
  const F = new Frame(gb, x, 0, z, yaw);
  for (let k = 0; k < 4; k++) F.box('wood', 0, 0.46, -0.16 + k * 0.11, 1.7, 0.04, 0.09, { color: 0x7a3b28, uv: 0.5 });
  for (let k = 0; k < 3; k++) F.box('wood', 0, 0.62 + k * 0.1, -0.22 - k * 0.03, 1.7, 0.08, 0.03, { color: 0x7a3b28, uv: 0.5 });
  for (const sx of [-0.75, 0.75]) { F.box('metal', sx, 0.22, 0, 0.05, 0.44, 0.45, { color: 0x2a2a2e }); F.box('metal', sx, 0.55, -0.22, 0.05, 0.5, 0.04, { color: 0x2a2a2e }); }
  world.add(x - 0.9, 0, z - 0.4, x + 0.9, 0.9, z + 0.4, 'wood');
}
function lampPost(gb, world, x, z) {
  gb.cyl('metal', x, 2.0, z, 0.05, 0.08, 4.0, { color: 0x2c3033, seg: 8 });
  gb.box('metal', x, 4.1, z, 0.34, 0.5, 0.34, { color: 0x2c3033 });
  gb.box('glass', x, 4.1, z, 0.28, 0.4, 0.28, { color: 0xf3e2a8 });
  world.add(x - 0.1, 0, z - 0.1, x + 0.1, 4, z + 0.1, 'metal');
}
function well(gb, world, x, z) {
  gb.cyl('stone', x, 0.5, z, 0.95, 1.0, 1.0, { color: 0xcfc4a8, seg: 14 });
  for (const sx of [-0.85, 0.85]) gb.box('wood', x + sx, 1.5, z, 0.12, 2.0, 0.12, { color: 0x5a3a24 });
  gb.cyl('wood', x, 2.45, z, 0.07, 0.07, 1.8, { axis: 'x', color: 0x5a3a24, seg: 6 });
  gb.quad('roof', [x - 1.3, 2.3, z + 1.0], [x + 1.3, 2.3, z + 1.0], [x + 1.3, 2.9, z], [x - 1.3, 2.9, z], { uv: 1, flipV: true });
  gb.quad('roof', [x + 1.3, 2.3, z - 1.0], [x - 1.3, 2.3, z - 1.0], [x - 1.3, 2.9, z], [x + 1.3, 2.9, z], { uv: 1, flipV: true });
  world.addC(x, z, 2.0, 2.0, 1.0, 'stone');
}
function fountain(gb, world, x, z) {
  gb.cyl('stone', x, 0.3, z, 2.7, 2.8, 0.6, { color: 0xd9ceb4, seg: 20 });
  gb.cyl('glass', x, 0.52, z, 2.45, 2.45, 0.04, { color: 0x6aa0b8, seg: 20 });
  gb.cyl('stone', x, 1.1, z, 0.25, 0.4, 1.6, { color: 0xd9ceb4, seg: 10 });
  gb.cyl('stone', x, 1.95, z, 1.1, 0.4, 0.3, { color: 0xd9ceb4, seg: 14 });
  gb.cyl('stone', x, 2.5, z, 0.12, 0.25, 0.9, { color: 0xd9ceb4, seg: 8 });
  world.addC(x, z, 5.4, 5.4, 0.6, 'stone');
  world.addC(x, z, 0.8, 0.8, 2.8, 'stone');
}
function car(gb, world, x, z, yaw, col) {
  const F = new Frame(gb, x, 0, z, yaw);
  const prof = [[-1.82, 0.32], [1.82, 0.32], [1.84, 0.62], [1.45, 0.78], [0.75, 0.92], [0.5, 1.42], [-0.55, 1.45], [-1.15, 1.0], [-1.8, 0.95]];
  F.extrude('paint', prof, 1.5, GeoBuilder.mat(0, 0, 0, 0, Math.PI / 2, 0), { color: col, bevel: 0.03 });
  for (const sx of [-0.76, 0.76]) {
    F.box('glass', sx, 1.15, -0.0, 0.02, 0.38, 1.0, { color: 0x20303a });
    for (const wz of [-1.1, 1.1]) F.cyl('paint', sx * 1.02, 0.28, wz, 0.28, 0.28, 0.2, { axis: 'x', color: 0x1a1a1a, seg: 12 });
  }
  F.box('glass', 0, 1.13, 0.6, 1.4, 0.4, 0.02, { color: 0x20303a, rot: [-0.9, 0, 0] });
  F.box('metal', 0, 0.45, 1.86, 1.5, 0.14, 0.08, { color: 0x8a8a8a });
  F.box('metal', 0, 0.45, -1.84, 1.5, 0.14, 0.08, { color: 0x8a8a8a });
  const c = Math.abs(Math.cos(yaw)) > 0.7;
  world.addC(x, z, c ? 1.62 : 3.66, c ? 3.66 : 1.62, 1.45, 'metal');
}
function pole(gb, world, x, z) {
  gb.cyl('wood', x, 4.5, z, 0.1, 0.16, 9, { color: 0x5a4636, seg: 7 });
  gb.box('wood', x, 8.2, z, 2.2, 0.12, 0.12, { color: 0x4a3a2c });
  world.add(x - 0.16, 0, z - 0.16, x + 0.16, 9, z + 0.16, 'wood');
}
function wire(gb, a, b, sag = 0.6) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]); }
  gb.tube('wire', pts, 0.011, { color: 0x111111, segs: 12, radial: 3 });
}

export function buildVillage(M, opts = {}) {
  const rng = new RNG(2026);
  const world = new World();
  const gb = new GeoBuilder();
  const group = new THREE.Group();
  const info = { spawns: { blue: [], red: [] }, objectives: [], items: [], houses: HOUSES, lights: [] };

  // ---- mặt đất + đồi xa ----
  const SZ = 900, SEG = 90;
  const gg = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG);
  gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position, gcol = new Float32Array(gp.count * 3);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), r = Math.max(Math.abs(x) / 1.0, Math.abs(z) / 1.1);
    const t = Math.min(1, Math.max(0, (r - 80) / 140));
    const n = Math.sin(x * 0.021) * Math.cos(z * 0.017) + Math.sin(x * 0.05 + z * 0.043) * 0.45 + 0.6;
    gp.setY(i, t * t * (6 + Math.max(0, n) * 34));
    const g = 0.78 + 0.22 * Math.sin(x * 0.13) * Math.sin(z * 0.11);
    gcol[i * 3] = (0.55 + t * 0.25) * g; gcol[i * 3 + 1] = (0.68 - t * 0.05) * g; gcol[i * 3 + 2] = (0.38 + t * 0.05) * g;
  }
  gg.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
  const uv = gg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, gp.getX(i) / 4, gp.getZ(i) / 4);
  const ground = new THREE.Mesh(gg, M.grass);
  ground.receiveShadow = true;
  group.add(ground);

  // ---- đường ----
  const flat = (key, x0, z0, x1, z1, y, color, uv = undefined) => gb.quad(key, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], { color, uv });
  flat('asphalt', -3.4, -68, 3.4, 68, 0.03, 0xd8d0dc);
  flat('cobble', -62, 1.5, 62, 7.5, 0.035, 0xffffff);
  flat('asphalt', -3.4, 1.5, 3.4, 7.5, 0.04, 0xd8d0dc);
  for (const sx of [-1, 1]) {
    gb.box('slab', sx * 4.6, 0.07, 0, 2.4, 0.14, 136, { color: 0xffffff });
    gb.box('stone', sx * 3.5, 0.08, 0, 0.2, 0.16, 136, { color: 0xb8b0a0 });
    for (let z = -66; z < 66; z += 1.2) if (Math.abs(z - 4.5) > 6) gb.box('paint', sx * 3.25, 0.035, z + 0.3, 0.14, 0.01, 0.55, { color: z % 2.4 < 1.2 ? 0xf2f2f2 : 0x222222 });
  }
  gb.cyl('cobble', 0, 0.045, 4.5, 11, 11, 0.04, { seg: 40, uvScale: 22 });
  for (const sx of [-26, 26]) flat('dirt', sx - 1.8, -62, sx + 1.8, 62, 0.025, 0xffffff);
  flat('dirt', -58, -26, -30, -23, 0.025, 0xffffff);

  // ---- nhà ----
  for (const h of HOUSES) buildHouse(gb, world, h, rng);

  // ---- hàng rào / tường / hàng cây ----
  for (const sx of [-1, 1]) {
    fenceLine(gb, world, sx * 24, -62, sx * 24, -44);
    fenceLine(gb, world, sx * 24, -26, sx * 24, -8);
    fenceLine(gb, world, sx * 24, 8, sx * 24, 26);
    fenceLine(gb, world, sx * 24, 42, sx * 24, 62);
    fenceLine(gb, world, sx * 48, -40, sx * 48, 30, 1.8, 0x5a4a3a);
    pillar(gb, world, sx * 24, -43); pillar(gb, world, sx * 24, -27); pillar(gb, world, sx * 24, 7); pillar(gb, world, sx * 24, 27); pillar(gb, world, sx * 24, 41);
    stoneWall(gb, world, sx * 40, 34, sx * 52, 34); stoneWall(gb, world, sx * 40, -46, sx * 52, -46);
    hedge(gb, world, sx * 27.5, -34, 1.2, 8, 1.4, rng); hedge(gb, world, sx * 27.5, 18, 1.2, 9, 1.4, rng);
  }
  // viền bản đồ: hàng rào cây dày
  const B = world.bounds;
  for (let x = B.x0 + 2; x < B.x1; x += 3.5) { hedge(gb, world, x, B.z0 + 0.8, 3.6, 1.6, 2.4, rng); hedge(gb, world, x, B.z1 - 0.8, 3.6, 1.6, 2.4, rng); }
  for (let z = B.z0 + 2; z < B.z1; z += 3.5) { hedge(gb, world, B.x0 + 0.8, z, 1.6, 3.6, 2.4, rng); hedge(gb, world, B.x1 - 0.8, z, 1.6, 3.6, 2.4, rng); }
  world.add(B.x0 - 5, 0, B.z0 - 5, B.x1 + 5, 30, B.z0 - 0.01, 'wall');
  world.add(B.x0 - 5, 0, B.z1 + 0.01, B.x1 + 5, 30, B.z1 + 5, 'wall');
  world.add(B.x0 - 5, 0, B.z0, B.x0 - 0.01, 30, B.z1, 'wall');
  world.add(B.x1 + 0.01, 0, B.z0, B.x1 + 5, 30, B.z1, 'wall');

  // ---- cây ----
  const rt = [[-8.2, 12, 1.15], [8.4, -9.5, 1.0], [-5.6, -24, 1.0], [5.6, 36, 1.05], [-5.6, 50, 0.95], [5.8, -52, 1.0], [-31, 2, 1.1], [31, 8, 1.1], [-34, 34, 1], [36, -22, 1], [-36, -20, 1.05], [-9.5, -36, 0.9]];
  for (const [x, z, s] of rt) roundTree(gb, world, x, z, s, rng);
  for (const [x, z, h] of [[5.2, 12, 13], [-5.2, -12, 12], [5.2, -38, 14], [-5.2, 34, 13], [5.2, 22, 11], [-5.2, -49, 12], [5.2, 47, 13], [-25, 30, 12], [25, -30, 13], [-50, 4, 12], [50, -6, 12]]) cypress(gb, world, x, z, h, rng);
  // rừng xa (không va chạm)
  for (let i = 0; i < 160; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(75, 230), x = Math.cos(a) * r * 0.95, z = Math.sin(a) * r * 1.05;
    if (Math.abs(x) < 66 && Math.abs(z) < 72) continue;
    const h = Math.max(0, Math.min(1, (Math.max(Math.abs(x), Math.abs(z) / 1.1) - 80) / 140));
    const y = h * h * (6 + Math.max(0, Math.sin(x * 0.021) * Math.cos(z * 0.017) + Math.sin(x * 0.05 + z * 0.043) * 0.45 + 0.6) * 34);
    if (rng.chance(0.55)) { const g2 = new THREE.Group(); void g2; cypress(gb, null, x, z, rng.range(10, 18), rng); gb.groups.get('leaf'); }
    else gb.sphere('leaf', x, y + 4, z, 4.5, 4, 4.5, { ws: 7, hs: 5, color: 0x5a7f36, uvScale: 3 });
    void y;
  }

  // ---- đồ vật ----
  fountain(gb, world, 0, 4.5);
  well(gb, world, -24, -24);
  for (const [x, z] of [[-5.4, -10], [5.4, -10], [-5.4, 20], [5.4, 33], [-5.4, 44], [5.4, -33], [-5.4, -33], [5.4, 52]]) lampPost(gb, world, x, z);
  bench(gb, world, 5.4, 10, -Math.PI / 2); bench(gb, world, -5.4, 0, Math.PI / 2); bench(gb, world, 9, 4.5 + 6.2, 0); bench(gb, world, -9, -2.5, Math.PI);
  bench(gb, world, 5.6, 28.5, -Math.PI / 2);
  for (const [x, z] of [[-4.6, 26.8], [4.4, -4.5], [-4.2, 8], [4.8, 48], [-7, 4.5 + 9], [10, 4.5 - 9], [-25.5, 6], [24.5, -5], [-26, -40], [27, 36]]) barrel(gb, world, x, z);
  for (const [x, z, s, r] of [[-3.8, 27.8, 0.8, 0.2], [-4.6, 27.2, 0.7, 0.5], [4.2, -8.5, 0.9, 0], [25.6, 12, 0.8, 0.4], [-27, 30, 0.9, 0.1], [26, -42, 0.8, 0.7], [-3.2, 40, 1.0, 0.3], [3.4, -22, 1.0, 0.9], [-12, 4.5 + 4, 0.8, 0.2], [14, 4.5 - 3.5, 0.8, 0.5]]) crate(gb, world, x, z, s, r);
  car(gb, world, 5.2, -14, 0, 0xb85a2a); car(gb, world, -5.3, 33, 0.06, 0xd9d5c8); car(gb, world, -27, -8, Math.PI / 2, 0x4f6a7a);
  for (const [x, z, w, d] of [[-12.5, 14, 3, 1], [12.5, -4.5, 3, 1], [4, 3, 0, 0]]) if (w) hedge(gb, world, x, z, w, d, 1.2, rng);
  hedge(gb, world, -6.9, 28, 0.9, 1.4, 1.5, rng); hedge(gb, world, 6.9, 28, 0.9, 1.4, 1.5, rng);
  // cột điện + dây (như ảnh): vắt ngang phố
  const poles = [[-4.6, -40], [4.6, -12], [-4.6, 16], [4.6, 46]];
  for (const [x, z] of poles) pole(gb, world, x, z);
  for (let i = 0; i < poles.length - 1; i++) for (const dy of [0, 0.35]) wire(gb, [poles[i][0] - 0.9, 8.1 - dy, poles[i][1]], [poles[i + 1][0] - 0.9, 8.1 - dy, poles[i + 1][1]], 0.9);
  for (const [x, z] of poles) wire(gb, [x + 0.9, 8.1, z], [x > 0 ? 6.3 : -6.3, 6.3, z + 2], 0.4);
  wire(gb, [-6.5, 6.4, -2], [6.5, 6.4, 3], 0.7);
  // dây phơi đồ
  const cl = (a, b, y) => { wire(gb, [a[0], y, a[1]], [b[0], y, b[1]], 0.3); for (let k = 1; k < 4; k++) { const t = k / 4, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; gb.box('fabric', x, y - 0.45 - Math.sin(t * 3.14) * 0.3, z, 0.05, 0.7, 0.5, { color: rng.pick([0xd8d0c0, 0xb84a3a, 0x4a7a9a, 0xe0c060]) }); } };
  cl([-6.45, 24], [-6.45, 18], 5.5); cl([6.45, 38], [6.45, 32], 5.6);

  // ---- điểm hồi sinh / mục tiêu / vật phẩm ----
  for (let i = 0; i < 6; i++) { info.spawns.blue.push({ x: -5 + i * 2, z: 59 + (i % 2) * 2 }); info.spawns.red.push({ x: -5 + i * 2, z: -59 - (i % 2) * 2 }); }
  info.spawns.blue.push({ x: -26, z: 50 }, { x: 26, z: 50 }); info.spawns.red.push({ x: -26, z: -50 }, { x: 26, z: -50 });
  info.objectives = [{ id: 'A', x: -26, z: 18 }, { id: 'B', x: 0, z: 4.5 }, { id: 'C', x: 26, z: -16 }];
  info.items = [
    { type: 'med', x: 3.2, z: 24 }, { type: 'med', x: -3.2, z: -26 }, { type: 'armor', x: 0, z: -4 }, { type: 'armor', x: 0, z: 14 },
    { type: 'ammo', x: -26, z: 6 }, { type: 'ammo', x: 26, z: 4 }, { type: 'mp7', x: -25, z: -30 }, { type: 'shotgun', x: 25, z: 30 }, { type: 'sniper', x: 0, z: -48 },
  ];

  // ---- gộp mesh ----
  const geos = gb.build();
  for (const [key, geo] of geos) {
    const mesh = new THREE.Mesh(geo, M[key] || M.paint);
    mesh.castShadow = key !== 'glass'; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  info.triangles = gb.triangleCount;
  return { group, world, info };
}
