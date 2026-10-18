// Texture thủ tục (vẽ bằng JS lúc khởi động) — không cần file ảnh ngoài, chạy offline hoàn toàn.
// Mỗi hàm trả về {map, bump}. Texture tileable, kích thước ô thật được ghi chú (mét) để UV đúng tỉ lệ 1:1.
import * as THREE from 'three';
import { RNG } from '../core/util.js';

// ---------- Nhiễu giá trị có thể lặp (tileable) ----------
function hash(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, y, px, py, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const ax = ((x0 % px) + px) % px, bx = (ax + 1) % px;
  const ay = ((y0 % py) + py) % py, by = (ay + 1) % py;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v00 = hash(ax, ay, seed), v10 = hash(bx, ay, seed), v01 = hash(ax, by, seed), v11 = hash(bx, by, seed);
  return v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy;
}
function fbm(u, v, per, oct, seed) {
  let a = 1, s = 0, n = 0, p = per;
  for (let o = 0; o < oct; o++) {
    s += a * vn(u * p, v * p, p, p, seed + o * 17);
    n += a;
    a *= 0.5;
    p *= 2;
  }
  return s / n;
}
const ss = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a || 1e-9)));
  return t * t * (3 - 2 * t);
};
const mixc = (o, a, b, t) => {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
};

// ---------- Hạ tầng canvas ----------
function maps(S, fn, opts = {}) {
  const ca = document.createElement('canvas'), cb = document.createElement('canvas');
  ca.width = ca.height = cb.width = cb.height = S;
  const xa = ca.getContext('2d'), xb = cb.getContext('2d');
  const ia = xa.createImageData(S, S), ib = xb.createImageData(S, S);
  const A = [0, 0, 0];
  const out = { h: 128 };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      out.h = 128;
      fn((x + 0.5) / S, (y + 0.5) / S, A, out);
      const i = (y * S + x) * 4;
      ia.data[i] = A[0] > 255 ? 255 : A[0] < 0 ? 0 : A[0];
      ia.data[i + 1] = A[1] > 255 ? 255 : A[1] < 0 ? 0 : A[1];
      ia.data[i + 2] = A[2] > 255 ? 255 : A[2] < 0 ? 0 : A[2];
      ia.data[i + 3] = 255;
      const h = out.h > 255 ? 255 : out.h < 0 ? 0 : out.h;
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = h;
      ib.data[i + 3] = 255;
    }
  xa.putImageData(ia, 0, 0);
  xb.putImageData(ib, 0, 0);
  return { ca, cb, ctxA: xa, ctxB: xb };
}
function finish(ca, cb, aniso) {
  const mk = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: mk(ca, true), bump: cb ? mk(cb, false) : null };
}

// ---------- Xây (masonry): đá lát, đá hộc, gạch ----------
function masonry(seed, rows, wMin, wMax, hVar, jitterRow) {
  const rng = new RNG(seed);
  const R = [];
  let hs = [];
  for (let i = 0; i < rows; i++) hs.push(1 + (rng.next() - 0.5) * 2 * hVar);
  const hsum = hs.reduce((a, b) => a + b, 0);
  let v = 0;
  for (let i = 0; i < rows; i++) {
    const h = hs[i] / hsum;
    const stones = [];
    const ws = [];
    let tot = 0;
    while (tot < 1) {
      const w = wMin + rng.next() * (wMax - wMin);
      ws.push(w);
      tot += w;
    }
    // chuẩn hoá để tổng = 1
    let u = jitterRow ? rng.next() * 0.2 : 0;
    const ws2 = ws.map((w) => w / tot);
    let acc = 0;
    for (const w of ws2) {
      stones.push({ u0: acc, u1: acc + w, r: rng.next(), r2: rng.next() });
      acc += w;
    }
    R.push({ v0: v, v1: v + h, stones, off: u, r: rng.next() });
    v += h;
  }
  return R;
}
function masonryTex(S, aniso, o) {
  const rows = masonry(o.seed, o.rows, o.wMin, o.wMax, o.hVar ?? 0, true);
  const pal = o.palette, grout = o.grout, gw = o.groutW, dome = o.dome ?? 0.04;
  const tmp = [0, 0, 0];
  const { ca, cb } = maps(S, (u, v, A, B) => {
    let row = rows[rows.length - 1];
    for (let i = 0; i < rows.length; i++) if (v < rows[i].v1) { row = rows[i]; break; }
    let uu = u - row.off;
    uu -= Math.floor(uu);
    let st = row.stones[row.stones.length - 1];
    for (let i = 0; i < row.stones.length; i++) if (uu < row.stones[i].u1) { st = row.stones[i]; break; }
    const du = Math.min(uu - st.u0, st.u1 - uu) * o.tile; // mét tới cạnh trái/phải
    const dv = Math.min(v - row.v0, row.v1 - v) * o.tile;
    const edge = Math.min(du, dv * (o.vScale ?? 1));
    const n = fbm(u, v, 8, 3, o.seed + 3);
    const fine = vn(u * 120, v * 120, 120, 120, o.seed + 9);
    const pi = Math.floor(st.r * pal.length) % pal.length;
    const pj = (pi + 1) % pal.length;
    mixc(tmp, pal[pi], pal[pj], st.r2);
    const shade = 0.86 + (n - 0.5) * 0.3 + (fine - 0.5) * 0.12;
    const d = ss(0, dome, edge);
    const g = ss(gw * 0.4, gw, edge);
    A[0] = (tmp[0] * (0.78 + 0.22 * d) * shade) * g + grout[0] * (1 - g) * (0.8 + n * 0.4);
    A[1] = (tmp[1] * (0.78 + 0.22 * d) * shade) * g + grout[1] * (1 - g) * (0.8 + n * 0.4);
    A[2] = (tmp[2] * (0.78 + 0.22 * d) * shade) * g + grout[2] * (1 - g) * (0.8 + n * 0.4);
    B.h = 40 + 190 * d * g + (fine - 0.5) * 30;
  });
  return finish(ca, cb, aniso);
}

// ---------- Các texture cụ thể ----------
function plaster(S, aniso) {
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const blot = fbm(u, v, 3, 4, 11);
    const grain = vn(u * 96, v * 96, 96, 96, 5);
    const grain2 = vn(u * 220, v * 220, 220, 220, 9);
    const st = vn(u * 26, v * 3, 26, 3, 21);
    const st2 = vn(u * 9, v * 2, 9, 2, 33);
    let l = 0.9 + (blot - 0.5) * 0.17 + (grain - 0.5) * 0.06 + (grain2 - 0.5) * 0.035;
    l -= ss(0.6, 0.95, st) * 0.07 * st2;
    const pit = grain2 > 0.965 ? 0.12 : 0;
    l -= pit;
    A[0] = 255 * l;
    A[1] = 255 * l * 0.985;
    A[2] = 255 * l * 0.955;
    B.h = 128 + (grain - 0.5) * 70 + (blot - 0.5) * 70 - pit * 300;
  });
  return finish(ca, cb, aniso);
}

// Ngói ống (coppo) — ô 1 m x 1 m: 5 cặp ngói / m, 6 hàng / m (v tăng dần xuống mép mái)
function roofTile(S, aniso) {
  const COLS = 5, ROWS = 6;
  const pal = [[198, 96, 54], [184, 82, 48], [210, 108, 62], [168, 72, 44], [190, 100, 66]];
  const tmp = [0, 0, 0];
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const cu = u * COLS, cv = v * ROWS;
    const col = Math.floor(cu), row = Math.floor(cv);
    const fu = cu - col, fv = cv - row;
    const rv = hash(col, row, 71), rv2 = hash(col, row, 5);
    const cover = Math.abs(fu - 0.5) < 0.27;
    const prof = Math.cos((fu - 0.5) * Math.PI * 2); // 1 = sống ngói, -1 = lòng máng
    const slope = -Math.sin((fu - 0.5) * Math.PI * 2);
    const lit = 0.8 + 0.2 * slope;
    const ao = 0.74 + 0.26 * (prof * 0.5 + 0.5);
    const shadow = (1 - ss(0, 0.3, fv)) * 0.5;
    const hi = ss(0.86, 0.97, fv) * 0.16;
    const pi = Math.floor(rv * pal.length);
    mixc(tmp, pal[pi % pal.length], pal[(pi + 1) % pal.length], rv2);
    const wear = fbm(u, v, 4, 4, 41);
    const moss = ss(0.62, 0.9, fbm(u, v, 3, 3, 77)) * 0.5;
    let k = lit * ao * (1 - shadow) + hi;
    k *= cover ? 1.06 : 0.9;
    k *= 0.82 + wear * 0.36;
    const r = tmp[0] * k, g = tmp[1] * k, b = tmp[2] * k;
    A[0] = r * (1 - moss) + 70 * moss * k;
    A[1] = g * (1 - moss) + 82 * moss * k;
    A[2] = b * (1 - moss) + 52 * moss * k;
    // vệt vôi trắng
    const lime = ss(0.93, 1, vn(u * 14, v * 40, 14, 40, 8)) * 0.22;
    A[0] += lime * 90; A[1] += lime * 90; A[2] += lime * 80;
    B.h = 40 + 150 * (prof * 0.5 + 0.5) * (cover ? 1 : 0.7) + 60 * fv;
  });
  return finish(ca, cb, aniso);
}

function asphalt(S, aniso) {
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const n = fbm(u, v, 4, 4, 17);
    const g1 = vn(u * 150, v * 150, 150, 150, 3);
    const g2 = vn(u * 300, v * 300, 300, 300, 6);
    let l = 0.34 + (n - 0.5) * 0.14 + (g1 - 0.5) * 0.12 + (g2 - 0.5) * 0.09;
    // vết nứt
    const cr = Math.abs(vn(u * 6, v * 6, 6, 6, 91) - 0.5);
    l -= (1 - ss(0, 0.012, cr)) * 0.12;
    // đá dăm sáng
    if (g2 > 0.93) l += 0.12;
    A[0] = 255 * l * 1.0; A[1] = 255 * l * 0.97; A[2] = 255 * l * 1.04;
    B.h = 110 + (g1 - 0.5) * 120 + (g2 - 0.5) * 80 - (1 - ss(0, 0.012, cr)) * 60;
  });
  return finish(ca, cb, aniso);
}

function dirt(S, aniso) {
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const n = fbm(u, v, 4, 5, 13);
    const g = vn(u * 130, v * 130, 130, 130, 2);
    const peb = vn(u * 40, v * 40, 40, 40, 17);
    let l = 0.52 + (n - 0.5) * 0.28 + (g - 0.5) * 0.1;
    let pe = 0;
    if (peb > 0.84) { pe = (peb - 0.84) * 3; l += pe * 0.5; }
    A[0] = 255 * l * 0.86; A[1] = 255 * l * 0.72; A[2] = 255 * l * 0.52;
    B.h = 100 + (n - 0.5) * 80 + (g - 0.5) * 60 + pe * 300;
  });
  return finish(ca, cb, aniso);
}

function grass(S, aniso) {
  const { ca, cb, ctxA, ctxB } = maps(S, (u, v, A, B) => {
    const n = fbm(u, v, 3, 5, 29);
    const m = fbm(u, v, 9, 3, 55);
    const l = 0.5 + (n - 0.5) * 0.35 + (m - 0.5) * 0.12;
    A[0] = 255 * (0.35 + 0.26 * (1 - l) + (n - 0.5) * 0.12);
    A[1] = 255 * (0.55 + 0.17 * l);
    A[2] = 255 * (0.22 + 0.06 * l);
    B.h = 128 + (m - 0.5) * 80;
  });
  // lá cỏ: nét ngắn có bọc (wrap) để vẫn tileable
  const rng = new RNG(1234);
  const blades = Math.floor(S * S * 0.07);
  for (let i = 0; i < blades; i++) {
    const x = rng.next() * S, y = rng.next() * S, len = 3 + rng.next() * 7;
    const a = -Math.PI / 2 + (rng.next() - 0.5) * 1.3;
    const dark = rng.next() < 0.5;
    ctxA.strokeStyle = dark ? `rgba(58,92,28,0.35)` : `rgba(168,196,92,0.30)`;
    ctxA.lineWidth = 1;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        const px = x + ox, py = y + oy;
        if (px < -12 || px > S + 12 || py < -12 || py > S + 12) continue;
        ctxA.beginPath();
        ctxA.moveTo(px, py);
        ctxA.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        ctxA.stroke();
      }
  }
  void ctxB;
  return finish(ca, cb, aniso);
}

// Ván gỗ đứng — ô 1 m: 4 tấm 25 cm, vân dọc theo v
function wood(S, aniso, planks = 4) {
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const pu = u * planks, pi = Math.floor(pu), fu = pu - pi;
    const base = 0.72 + (hash(pi, 3, 5) - 0.5) * 0.22;
    const grain = vn(u * 60, v * 5, 60, 5, 19 + pi);
    const ring = Math.sin((fu * 7 + grain * 5 + hash(pi, 1, 9) * 6) * 3.14);
    const knot = vn(u * 9, v * 6, 9, 6, 61 + pi);
    let l = base + (grain - 0.5) * 0.18 + ring * 0.045;
    if (knot > 0.9) l -= (knot - 0.9) * 2.4;
    const gap = ss(0.0, 0.035, Math.min(fu, 1 - fu));
    l *= 0.4 + 0.6 * gap;
    const end = ss(0, 0.02, Math.min(v, 1 - v)) ; void end;
    A[0] = 255 * l * 0.98; A[1] = 255 * l * 0.9; A[2] = 255 * l * 0.78;
    B.h = 90 + (grain - 0.5) * 60 + 80 * gap;
  });
  return finish(ca, cb, aniso);
}

// Cánh cửa chớp (louvers) — ô 1 m x 1 m, 12 lá
function shutter(S, aniso) {
  const N = 14;
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const fv = (v * N) % 1;
    const slat = Math.sin(fv * Math.PI);
    const g = vn(u * 40, v * 3, 40, 3, 11);
    const l = 0.55 + slat * 0.4 + (g - 0.5) * 0.12;
    const frame = Math.min(u, 1 - u) < 0.07 || v < 0.03 || v > 0.97 ? 1.12 : 1;
    A[0] = 255 * l * frame; A[1] = 255 * l * frame; A[2] = 255 * l * frame;
    B.h = 60 + slat * 150;
  });
  return finish(ca, cb, aniso);
}

function leaf(S, aniso) {
  const { ca, cb, ctxA } = maps(S, (u, v, A, B) => {
    const n = fbm(u, v, 5, 4, 7);
    A[0] = 255 * (0.12 + n * 0.12); A[1] = 255 * (0.26 + n * 0.18); A[2] = 255 * (0.08 + n * 0.06);
    B.h = 128;
  });
  const rng = new RNG(808);
  const cols = ['#3f6a22', '#527f2b', '#2f5619', '#6a9a36', '#4b7a26', '#7aa840'];
  for (let i = 0; i < 900; i++) {
    const x = rng.next() * S, y = rng.next() * S, r = 2.5 + rng.next() * 5, a = rng.next() * 6.28;
    ctxA.fillStyle = cols[Math.floor(rng.next() * cols.length)];
    ctxA.globalAlpha = 0.55 + rng.next() * 0.4;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        const px = x + ox, py = y + oy;
        if (px < -10 || px > S + 10 || py < -10 || py > S + 10) continue;
        ctxA.beginPath();
        ctxA.ellipse(px, py, r, r * 0.55, a, 0, 6.283);
        ctxA.fill();
      }
  }
  ctxA.globalAlpha = 1;
  return finish(ca, null, aniso);
}

function bark(S, aniso) {
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const g = vn(u * 14, v * 2, 14, 2, 3);
    const g2 = vn(u * 40, v * 6, 40, 6, 8);
    const l = 0.42 + (g - 0.5) * 0.35 + (g2 - 0.5) * 0.15;
    A[0] = 255 * l * 0.9; A[1] = 255 * l * 0.7; A[2] = 255 * l * 0.52;
    B.h = 60 + 150 * g;
  });
  return finish(ca, cb, aniso);
}

// Vải tối (áo/bạt) có hạt dệt — dùng làm detail map cho nhân vật
function fabric(S, aniso) {
  const { ca, cb } = maps(S, (u, v, A, B) => {
    const w = (Math.sin(u * S * 1.6) * Math.sin(v * S * 1.6) + 1) * 0.5;
    const n = vn(u * 80, v * 80, 80, 80, 4);
    const l = 0.82 + w * 0.12 + (n - 0.5) * 0.12;
    A[0] = A[1] = A[2] = 255 * l;
    B.h = 90 + w * 100;
  });
  return finish(ca, cb, aniso);
}

/** Tạo toàn bộ texture. res: 256/512/1024. progress(0..1, tên). */
export async function createTextures({ res = 512, aniso = 4, progress } = {}) {
  const T = {};
  const hi = Math.min(1024, res * 2);
  const jobs = [
    ['plaster', () => plaster(res, aniso)],
    ['roof', () => roofTile(hi, aniso)],
    ['asphalt', () => asphalt(res, aniso)],
    ['grass', () => grass(res, aniso)],
    ['dirt', () => dirt(res, aniso)],
    ['wood', () => wood(res, aniso)],
    ['shutter', () => shutter(res >> 1, aniso)],
    ['leaf', () => leaf(res >> 1, aniso)],
    ['bark', () => bark(res >> 1, aniso)],
    ['fabric', () => fabric(res >> 1, aniso)],
    [
      'cobble',
      () =>
        masonryTex(res, aniso, {
          seed: 5, rows: 12, wMin: 0.1, wMax: 0.17, hVar: 0.12, tile: 2, groutW: 0.012, dome: 0.03,
          palette: [[150, 142, 128], [166, 156, 138], [132, 128, 118], [176, 160, 134], [140, 134, 124]],
          grout: [74, 68, 58],
        }),
    ],
    [
      'stone',
      () =>
        masonryTex(res, aniso, {
          seed: 12, rows: 6, wMin: 0.14, wMax: 0.34, hVar: 0.3, tile: 2, groutW: 0.016, dome: 0.045,
          palette: [[170, 158, 134], [150, 142, 124], [186, 170, 140], [132, 126, 112], [160, 148, 120]],
          grout: [118, 108, 92],
        }),
    ],
    [
      'slab',
      () =>
        masonryTex(res, aniso, {
          seed: 21, rows: 4, wMin: 0.32, wMax: 0.55, hVar: 0.05, tile: 2, groutW: 0.012, dome: 0.02,
          palette: [[184, 176, 160], [172, 164, 150], [192, 184, 168]],
          grout: [96, 92, 84],
        }),
    ],
    [
      'brick',
      () =>
        masonryTex(res, aniso, {
          seed: 33, rows: 16, wMin: 0.16, wMax: 0.17, hVar: 0, tile: 1.2, groutW: 0.01, dome: 0.012,
          palette: [[166, 86, 62], [150, 74, 54], [178, 98, 70], [138, 70, 52]],
          grout: [188, 178, 160],
        }),
    ],
  ];
  for (let i = 0; i < jobs.length; i++) {
    const [k, f] = jobs[i];
    T[k] = f();
    progress?.((i + 1) / jobs.length, k);
    await new Promise((r) => setTimeout(r, 0));
  }
  return T;
}
