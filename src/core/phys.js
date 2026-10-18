// Va chạm 3D bằng hộp AABB + lưới không gian (đơn vị mét). Dùng cho di chuyển, đạn, tầm nhìn bot.
const CELL = 4;
export class World {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
    this.bounds = { x0: -62, x1: 62, z0: -68, z1: 68 };
  }
  add(x0, y0, z0, x1, y1, z1, kind = 'wall') {
    const b = { x0, y0, z0, x1, y1, z1, kind, id: this.boxes.length };
    this.boxes.push(b);
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++)
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const k = ix * 4096 + iz;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(b);
      }
    return b;
  }
  addC(cx, cz, w, d, h, kind) { return this.add(cx - w / 2, 0, cz - d / 2, cx + w / 2, h, cz + d / 2, kind); }
  near(x, z, r, fn) {
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const a = this.grid.get(ix * 4096 + iz);
        if (a) for (let i = 0; i < a.length; i++) fn(a[i]);
      }
  }
  /** Mặt đứng cao nhất dưới chân (trong tầm bước lên stepH). */
  groundAt(x, z, r, y, stepH) {
    let g = 0;
    this.near(x, z, r, (b) => {
      if (b.y1 <= y + stepH && b.y1 > g && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) g = b.y1;
    });
    return g;
  }
  /** Di chuyển hình trụ (r, h) theo (dx,dz); trượt dọc tường. Trả về vị trí đã giải va chạm. */
  move(p, dx, dz, r, h, stepH = 0.5) {
    const B = this.bounds;
    for (let axis = 0; axis < 2; axis++) {
      if (axis === 0) p.x += dx; else p.z += dz;
      this.near(p.x, p.z, r + 0.2, (b) => {
        if (b.y1 <= p.y + stepH || b.y0 >= p.y + h) return;
        const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
        let ex = p.x - cx, ez = p.z - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 >= r * r) return;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (ex / d) * push; p.z += (ez / d) * push;
        } else {
          // tâm nằm trong hộp: đẩy ra cạnh gần nhất
          const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rr, t, bt);
          if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
        }
      });
    }
    p.x = Math.max(B.x0 + r, Math.min(B.x1 - r, p.x));
    p.z = Math.max(B.z0 + r, Math.min(B.z1 - r, p.z));
  }
  /** Tia vs AABB. Trả về {t, nx,ny,nz, box} hoặc null. dir phải chuẩn hoá. */
  raycast(ox, oy, oz, dx, dy, dz, maxT, skipSoft = false) {
    let best = null, bt = maxT;
    const steps = Math.ceil(maxT / (CELL * 0.5));
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxT, s * CELL * 0.5);
      const x = ox + dx * t, z = oz + dz * t;
      const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
      for (let a = -1; a <= 1; a++)
        for (let c = -1; c <= 1; c++) {
          const arr = this.grid.get((ix + a) * 4096 + (iz + c));
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            const b = arr[i];
            if (seen.has(b.id)) continue;
            seen.add(b.id);
            if (skipSoft && b.kind === 'soft') continue;
            let t0 = 0, t1 = bt, nx = 0, ny = 0, nz = 0, ok = true;
            const O = [ox, oy, oz], D = [dx, dy, dz], lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
            for (let k = 0; k < 3; k++) {
              if (Math.abs(D[k]) < 1e-9) { if (O[k] < lo[k] || O[k] > hi[k]) { ok = false; break; } continue; }
              let ta = (lo[k] - O[k]) / D[k], tb = (hi[k] - O[k]) / D[k], sg = -1;
              if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; }
              if (ta > t0) { t0 = ta; nx = ny = nz = 0; if (k === 0) nx = sg; else if (k === 1) ny = sg; else nz = sg; }
              if (tb < t1) t1 = tb;
              if (t0 > t1) { ok = false; break; }
            }
            if (ok && t0 < bt && t0 >= 0) { bt = t0; best = { t: t0, nx, ny, nz, box: b }; }
          }
        }
    }
    return best;
  }
  los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
    return !this.raycast(a.x, a.y, a.z, dx / d, dy / d, dz / d, d - 0.1);
  }
}

/** Lưới dẫn đường 1 m + A* + làm mượt đường đi. */
export class Nav {
  constructor(world, r = 0.45) {
    const B = world.bounds;
    this.x0 = B.x0; this.z0 = B.z0; this.w = Math.ceil(B.x1 - B.x0); this.h = Math.ceil(B.z1 - B.z0);
    this.blocked = new Uint8Array(this.w * this.h);
    const p = { x: 0, y: 0, z: 0 };
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const x = this.x0 + i + 0.5, z = this.z0 + j + 0.5;
        let bl = 0;
        world.near(x, z, r + 1, (b) => {
          if (b.y1 < 0.6 || b.y0 > 1.5) return;
          const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
          if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) bl = 1;
        });
        this.blocked[j * this.w + i] = bl;
      }
    void p;
    this.world = world;
  }
  idx(x, z) {
    const i = Math.max(0, Math.min(this.w - 1, Math.floor(x - this.x0))), j = Math.max(0, Math.min(this.h - 1, Math.floor(z - this.z0)));
    return j * this.w + i;
  }
  center(k) { return { x: this.x0 + (k % this.w) + 0.5, z: this.z0 + Math.floor(k / this.w) + 0.5 }; }
  nearestFree(x, z) {
    const k0 = this.idx(x, z);
    if (!this.blocked[k0]) return k0;
    const i0 = k0 % this.w, j0 = Math.floor(k0 / this.w);
    for (let r = 1; r < 8; r++)
      for (let j = j0 - r; j <= j0 + r; j++)
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          if (!this.blocked[j * this.w + i]) return j * this.w + i;
        }
    return k0;
  }
  walkable(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.5);
    for (let s = 1; s < n; s++) {
      const t = s / n;
      if (this.blocked[this.idx(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)]) return false;
    }
    return true;
  }
  path(from, to) {
    const s = this.nearestFree(from.x, from.z), g = this.nearestFree(to.x, to.z);
    if (s === g) return [{ x: to.x, z: to.z }];
    const N = this.blocked.length, W = this.w;
    const gs = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [];
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = i * 2 + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
    const gx = g % W, gz = Math.floor(g / W);
    gs[s] = 0; push(s, 0);
    let n = 0;
    while (heap.length && n++ < 9000) {
      const [, k] = pop();
      if (closed[k]) continue;
      if (k === g) break;
      closed[k] = 1;
      const x = k % W, z = Math.floor(k / W);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
          const nk = nz * W + nx;
          if (this.blocked[nk] || closed[nk]) continue;
          if (dx && dz && (this.blocked[z * W + nx] || this.blocked[nz * W + x])) continue;
          const ng = gs[k] + (dx && dz ? 1.414 : 1);
          if (ng < gs[nk]) { gs[nk] = ng; prev[nk] = k; push(nk, ng + Math.hypot(nx - gx, nz - gz)); }
        }
    }
    if (prev[g] < 0) return [];
    const pts = [];
    for (let k = g; k !== s && k >= 0; k = prev[k]) pts.push(this.center(k));
    pts.reverse();
    // làm mượt: bỏ điểm giữa nếu đi thẳng được
    const out = [];
    let cur = { x: from.x, z: from.z }, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.walkable(cur, pts[j])) j--;
      out.push(pts[j]); cur = pts[j]; i = j + 1;
    }
    return out;
  }
}
