// GeoBuilder: bộ dựng mesh theo nhóm vật liệu. Mọi hình học (nhà, súng, lính, cây…) được
// "vẽ" vào builder rồi gộp thành vài BufferGeometry -> ít draw call. UV tính theo MÉT
// (uv = toạ độ thế giới / kích thước ô texture) nên texture lặp đúng tỉ lệ thật.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _one = new THREE.Vector3(1, 1, 1);

export function toRgb(c) {
  if (c === undefined || c === null) return [1, 1, 1];
  if (Array.isArray(c)) return c;
  if (typeof c === 'number') return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  if (c.isColor) return [c.r, c.g, c.b];
  return [1, 1, 1];
}
// sRGB hex -> tuyến tính (vertex color trong Three được coi là tuyến tính)
const s2l = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export function lin(hex) {
  const c = toRgb(hex);
  return [s2l(c[0]), s2l(c[1]), s2l(c[2])];
}

// 6 mặt hộp: [pháp tuyến, 4 đỉnh (CCW nhìn từ ngoài), hàm uv(local)]
const FACES = [
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], u: (p) => -p[2], w: (p) => p[1] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], u: (p) => p[2], w: (p) => p[1] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], u: (p) => p[0], w: (p) => -p[2] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], u: (p) => p[0], w: (p) => p[2] },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], u: (p) => p[0], w: (p) => p[1] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], u: (p) => -p[0], w: (p) => p[1] },
];
export const FACE = { PX: 1, NX: 2, PY: 4, NY: 8, PZ: 16, NZ: 32 };
/** Kích thước thật (mét) của một ô texture lặp, theo khoá vật liệu. */
export const TILE = { plaster: 2, roof: 1, asphalt: 3, grass: 4, dirt: 2, wood: 1, woodDark: 1, shutter: 1, cobble: 2, stone: 2, slab: 2, brick: 1.2, leaf: 1, bark: 1 };

export class GeoBuilder {
  constructor() {
    this.groups = new Map();
    this.skinned = false;
  }
  group(key) {
    let g = this.groups.get(key);
    if (!g) {
      g = { p: [], n: [], u: [], c: [], i: [], b: [], nv: 0 };
      this.groups.set(key, g);
    }
    return g;
  }
  get triangleCount() {
    let t = 0;
    for (const g of this.groups.values()) t += g.i.length / 3;
    return t;
  }

  /** Thêm một tam giác/quad thô: pos là mảng [x,y,z]. */
  quad(key, p0, p1, p2, p3, o = {}) {
    const g = this.group(key);
    const col = o.color !== undefined ? o.linear ? toRgb(o.color) : lin(o.color) : [1, 1, 1];
    const s = o.uv ?? TILE[key] ?? 2;
    const su = Array.isArray(s) ? s[0] : s,
      sv = Array.isArray(s) ? s[1] : s;
    // pháp tuyến theo mặt
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (o.flip) { nx = -nx; ny = -ny; nz = -nz; }
    // uv: chiếu theo mặt phẳng (u dọc cạnh p0->p1, v dọc cạnh p0->p3) tính theo mét
    const lu = Math.hypot(ax, ay, az), lv = Math.hypot(bx, by, bz);
    const uvs = o.uvs || (o.flipV ? [[0, lv / sv], [lu / su, lv / sv], [lu / su, 0], [0, 0]] : [[0, 0], [lu / su, 0], [lu / su, lv / sv], [0, lv / sv]]);
    const ou = o.uvOff ? o.uvOff[0] : 0, ov = o.uvOff ? o.uvOff[1] : 0;
    const pts = [p0, p1, p2, p3];
    const b = g.nv;
    for (let k = 0; k < 4; k++) {
      g.p.push(pts[k][0], pts[k][1], pts[k][2]);
      g.n.push(nx, ny, nz);
      g.u.push(uvs[k][0] + ou, uvs[k][1] + ov);
      const sh = o.shade ? o.shade[k] ?? 1 : 1;
      g.c.push(col[0] * sh, col[1] * sh, col[2] * sh);
      g.b.push(o.bone ?? 0);
    }
    if (o.flip) g.i.push(b, b + 2, b + 1, b, b + 3, b + 2);
    else g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    g.nv += 4;
    if (o.bone !== undefined) this.skinned = true;
  }
  tri(key, p0, p1, p2, o = {}) {
    const g = this.group(key);
    const col = o.color !== undefined ? lin(o.color) : [1, 1, 1];
    const s = o.uv ?? TILE[key] ?? 2;
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const lu = Math.hypot(ax, ay, az);
    const dot = (ax * bx + ay * by + az * bz) / (lu || 1);
    const hv = Math.sqrt(Math.max(0, bx * bx + by * by + bz * bz - dot * dot));
    const uvs = o.uvs || [[0, 0], [lu / s, 0], [dot / s, hv / s]];
    const b = g.nv;
    [p0, p1, p2].forEach((p, k) => {
      g.p.push(p[0], p[1], p[2]);
      g.n.push(nx, ny, nz);
      g.u.push(uvs[k][0], uvs[k][1]);
      g.c.push(col[0], col[1], col[2]);
      g.b.push(o.bone ?? 0);
    });
    g.i.push(b, b + 1, b + 2);
    g.nv += 3;
    if (o.bone !== undefined) this.skinned = true;
  }

  /**
   * Hộp (cx,cy,cz = tâm; sx,sy,sz = kích thước). o: {rot:[rx,ry,rz], color, uv (mét/ô), bone,
   * skip (bitmask FACE.*), shade:[đáy,đỉnh] nhân màu theo độ cao (AO giả), uvOff}
   */
  box(key, cx, cy, cz, sx, sy, sz, o = {}) {
    const g = this.group(key);
    const col = lin(o.color);
    const s = o.uv ?? TILE[key] ?? 2;
    const su = Array.isArray(s) ? s[0] : s,
      sv = Array.isArray(s) ? s[1] : s;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const rotated = o.rot && (o.rot[0] || o.rot[1] || o.rot[2]);
    if (rotated) {
      _e.set(o.rot[0] || 0, o.rot[1] || 0, o.rot[2] || 0, 'YXZ');
      _q.setFromEuler(_e);
      _m4.compose(_v.set(cx, cy, cz), _q, _one);
      _nm.getNormalMatrix(_m4);
    }
    const sh0 = o.shade ? o.shade[0] : 1, sh1 = o.shade ? o.shade[1] : 1;
    const skip = o.skip || 0;
    const taper = o.taper; // [kx, kz] co đầu trên (0..1)
    for (let f = 0; f < 6; f++) {
      if (skip & (1 << f)) continue;
      const F = FACES[f];
      const b = g.nv;
      for (let k = 0; k < 4; k++) {
        const lv = F.v[k];
        let lx = lv[0] * hx, ly = lv[1] * hy, lz = lv[2] * hz;
        if (taper && lv[1] > 0) { lx *= taper[0]; lz *= taper[1]; }
        let px = lx, py = ly, pz = lz;
        let nx = F.n[0], ny = F.n[1], nz = F.n[2];
        if (rotated) {
          _v.set(lx, ly, lz).applyMatrix4(_m4);
          px = _v.x; py = _v.y; pz = _v.z;
          _n.set(nx, ny, nz).applyMatrix3(_nm).normalize();
          nx = _n.x; ny = _n.y; nz = _n.z;
        } else {
          px += cx; py += cy; pz += cz;
        }
        g.p.push(px, py, pz);
        g.n.push(nx, ny, nz);
        // uv theo mét, cộng lệch theo toạ độ thế giới để các hộp kề nhau liền mạch
        const lp = [lx + (rotated ? 0 : cx), ly + (rotated ? 0 : cy), lz + (rotated ? 0 : cz)];
        g.u.push(F.u(lp) / su + (o.uvOff ? o.uvOff[0] : 0), F.w(lp) / sv + (o.uvOff ? o.uvOff[1] : 0));
        const sh = o.shade ? sh0 + (sh1 - sh0) * ((ly + hy) / (sy || 1)) : 1;
        g.c.push(col[0] * sh, col[1] * sh, col[2] * sh);
        g.b.push(o.bone ?? 0);
      }
      g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
      g.nv += 4;
    }
    if (o.bone !== undefined) this.skinned = true;
  }

  /** Thêm một THREE.BufferGeometry (Cylinder, Sphere, Extrude, Tube…) với ma trận biến đổi. */
  geometry(key, geo, matrix, o = {}) {
    const g = this.group(key);
    const col = lin(o.color);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    if (!nor) geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const M = matrix || _m4.identity();
    _nm.getNormalMatrix(M);
    const b = g.nv;
    const us = o.uvScale ?? 1;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(M);
      g.p.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(nrm, i).applyMatrix3(_nm).normalize();
      g.n.push(_n.x, _n.y, _n.z);
      g.u.push(uv ? uv.getX(i) * us : 0, uv ? uv.getY(i) * us : 0);
      let sh = 1;
      if (o.shade) sh = o.shade[0] + (o.shade[1] - o.shade[0]) * clamp01((_v.y - (o.shadeY0 ?? 0)) / (o.shadeH ?? 2));
      g.c.push(col[0] * sh, col[1] * sh, col[2] * sh);
      g.b.push(o.bone ?? 0);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) g.i.push(geo.index.getX(i) + b);
    else for (let i = 0; i < pos.count; i++) g.i.push(i + b);
    g.nv += pos.count;
    if (o.bone !== undefined) this.skinned = true;
  }

  /** Tiện ích: biến đổi geometry bằng pos/rot/scale. */
  static mat(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4();
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    return m.compose(new THREE.Vector3(px, py, pz), _q.clone(), new THREE.Vector3(sx, sy, sz));
  }
  /** Trụ tròn. axis: 'y' (mặc định) | 'x' | 'z'. */
  cyl(key, cx, cy, cz, rTop, rBot, h, o = {}) {
    const seg = o.seg ?? 10;
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !!o.open);
    let rx = 0, ry = 0, rz = 0;
    if (o.axis === 'x') rz = -Math.PI / 2;
    else if (o.axis === 'z') rx = Math.PI / 2;
    if (o.rot) { rx += o.rot[0]; ry += o.rot[1]; rz += o.rot[2]; }
    const M = GeoBuilder.mat(cx, cy, cz, rx, ry, rz, o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    this.geometry(key, geo, M, o);
    geo.dispose();
  }
  sphere(key, cx, cy, cz, rx, ry, rz, o = {}) {
    const geo = new THREE.SphereGeometry(1, o.ws ?? 12, o.hs ?? 8);
    const M = GeoBuilder.mat(cx, cy, cz, o.rot?.[0] ?? 0, o.rot?.[1] ?? 0, o.rot?.[2] ?? 0, rx, ry, rz);
    this.geometry(key, geo, M, o);
    geo.dispose();
  }
  /** Ống dọc đường cong (dây điện, ống nước…). */
  tube(key, points, radius, o = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.1);
    const geo = new THREE.TubeGeometry(curve, o.segs ?? 24, radius, o.radial ?? 4, false);
    this.geometry(key, geo, null, o);
    geo.dispose();
  }
  /** Đùn một đa giác 2D (mặt phẳng XY, đùn theo Z) — dùng cho thân súng, tay cầm, băng đạn… */
  extrude(key, pts2d, depth, M, o = {}) {
    const shape = new THREE.Shape(pts2d.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: !!o.bevel,
      bevelSize: o.bevel ?? 0,
      bevelThickness: o.bevel ?? 0,
      bevelSegments: o.bevSeg ?? 1,
      curveSegments: o.curveSegments ?? 6,
    });
    geo.translate(0, 0, -depth / 2); // đùn đối xứng quanh z = 0
    this.geometry(key, geo, M || null, { uvScale: o.uvScale ?? 1, ...o });
    geo.dispose();
  }

  /** Dựng ra Map<key, BufferGeometry>. */
  build() {
    const out = new Map();
    for (const [key, g] of this.groups) {
      if (!g.nv) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
      if (this.skinned) {
        const si = new Uint16Array(g.nv * 4), sw = new Float32Array(g.nv * 4);
        for (let i = 0; i < g.nv; i++) {
          si[i * 4] = g.b[i];
          sw[i * 4] = 1;
        }
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      }
      geo.setIndex(g.nv > 65535 ? new THREE.Uint32BufferAttribute(g.i, 1) : new THREE.Uint16BufferAttribute(g.i, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      out.set(key, geo);
    }
    return out;
  }
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Tính hộp bao (mét) của một đối tượng -> dùng cho Model Lab để kiểm tra tỉ lệ 1:1. */
export function measure(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  return { box, size };
}


/**
 * Frame: hệ toạ độ cục bộ (gốc + yaw) bọc GeoBuilder. Dựng một ngôi nhà/vật thể ở toạ độ cục bộ
 * (mặt tiền hướng +Z) rồi đặt vào thế giới ở bất kỳ hướng nào. Với yaw bội của 90° các hộp
 * vẫn song song trục (UV liền mạch, va chạm AABB chính xác).
 */
export class Frame {
  constructor(gb, ox = 0, oy = 0, oz = 0, yaw = 0) {
    this.gb = gb;
    this.ox = ox; this.oy = oy; this.oz = oz;
    this.yaw = yaw;
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    const k = Math.round(yaw / (Math.PI / 2));
    this.aligned = Math.abs(yaw - k * (Math.PI / 2)) < 1e-6;
    this.odd = this.aligned && Math.abs(k) % 2 === 1;
  }
  p(x, y, z) {
    return [this.ox + x * this.c + z * this.s, this.oy + y, this.oz - x * this.s + z * this.c];
  }
  sub(x, y, z, yaw = 0) {
    const q = this.p(x, y, z);
    return new Frame(this.gb, q[0], q[1], q[2], this.yaw + yaw);
  }
  matrix(m) {
    const M = GeoBuilder.mat(this.ox, this.oy, this.oz, 0, this.yaw, 0);
    return m ? M.multiply(m) : M;
  }
  box(key, x, y, z, sx, sy, sz, o = {}) {
    const q = this.p(x, y, z);
    if (this.aligned && !(o.rot && (o.rot[0] || o.rot[1] || o.rot[2]))) {
      const t = o.taper;
      this.gb.box(key, q[0], q[1], q[2], this.odd ? sz : sx, sy, this.odd ? sx : sz, { ...o, taper: t && this.odd ? [t[1], t[0]] : t, skip: this.odd || this.yaw ? remapSkip(o.skip || 0, this.yaw) : o.skip });
    } else {
      const r = o.rot || [0, 0, 0];
      this.gb.box(key, q[0], q[1], q[2], sx, sy, sz, { ...o, rot: [r[0], r[1] + this.yaw, r[2]] });
    }
  }
  quad(key, p0, p1, p2, p3, o = {}) {
    this.gb.quad(key, this.p(...p0), this.p(...p1), this.p(...p2), this.p(...p3), o);
  }
  tri(key, p0, p1, p2, o = {}) {
    this.gb.tri(key, this.p(...p0), this.p(...p1), this.p(...p2), o);
  }
  cyl(key, x, y, z, rTop, rBot, h, o = {}) {
    const q = this.p(x, y, z);
    const r = o.rot || [0, 0, 0];
    this.gb.cyl(key, q[0], q[1], q[2], rTop, rBot, h, { ...o, rot: [r[0], r[1] + this.yaw, r[2]] });
  }
  sphere(key, x, y, z, rx, ry, rz, o = {}) {
    const q = this.p(x, y, z);
    const r = o.rot || [0, 0, 0];
    this.gb.sphere(key, q[0], q[1], q[2], rx, ry, rz, { ...o, rot: [r[0], r[1] + this.yaw, r[2]] });
  }
  geometry(key, geo, m, o = {}) {
    this.gb.geometry(key, geo, this.matrix(m), o);
  }
  tube(key, pts, radius, o = {}) {
    this.gb.tube(key, pts.map((p) => this.p(...p)), radius, o);
  }
  extrude(key, pts2d, depth, m, o = {}) {
    this.gb.extrude(key, pts2d, depth, this.matrix(m), o);
  }
}
// ánh xạ bitmask mặt khi quay yaw bội 90°
function remapSkip(skip, yaw) {
  const k = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  if (!skip || !k) return skip;
  // thứ tự vòng quanh trục Y: +Z -> +X -> -Z -> -X khi yaw tăng (Ry dương: +Z đi sang +X)
  const ring = [FACE.PZ, FACE.PX, FACE.NZ, FACE.NX];
  let out = skip & (FACE.PY | FACE.NY);
  for (let i = 0; i < 4; i++) if (skip & ring[i]) out |= ring[(i + k) % 4];
  return out;
}
