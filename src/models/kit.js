// Bộ dựng chi tiết cho vũ khí: biên dạng nhìn nghiêng (u = tiến về phía nòng, v = cao) đùn theo bề ngang X, có vát cạnh.
import * as THREE from 'three';
const _a = new THREE.Matrix4(), _b = new THREE.Matrix4();
/** (u,v,độ dày) → thế giới (z=-u, y=v, x=độ dày), dịch ngang x. */
export function sideM(x = 0) { _a.makeRotationY(Math.PI / 2); _b.makeTranslation(x, 0, 0); return _b.clone().multiply(_a); }
export const side = (gb, key, pts, hw, x, color, o = {}) => gb.extrude(key, pts, hw * 2, sideM(x), { color, bevel: o.bevel ?? 0.0022, bevSeg: o.bevSeg ?? 2, curveSegments: 8, ...o });
export const slab = (gb, key, u0, u1, v0, v1, hw, x, color, o = {}) => side(gb, key, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], hw, x, color, o);
/** Trụ nằm dọc nòng: từ u0 (sau) đến u1 (trước), bán kính sau/trước. */
export const bar = (gb, key, u0, u1, v, x, rRear, rFront, color, seg = 16, o = {}) => gb.cyl(key, x, v, -(u0 + u1) / 2, rRear, rFront, Math.abs(u1 - u0), { axis: 'z', seg, color, ...o });
/** Đường cong dạng chuối (băng đạn): tâm bắt đầu (u0,v0), hướng xuống xoay dần về phía trước tổng cộng `bend` rad. */
export function banana(u0, v0, len, bend, w0, w1, steps = 10) {
  const R = len / bend, L = [], Rr = [];
  for (let i = 0; i <= steps; i++) {
    const a = bend * (i / steps), cu = u0 + R * (1 - Math.cos(a)), cv = v0 - R * Math.sin(a), w = (w0 + (w1 - w0) * (i / steps)) / 2;
    L.push([cu - Math.cos(a) * w, cv - Math.sin(a) * w]); Rr.push([cu + Math.cos(a) * w, cv + Math.sin(a) * w]);
  }
  return L.concat(Rr.reverse());
}
/** Dãy răng ray Picatinny. */
export function rail(gb, key, u0, u1, v, hw, x, color, pitch = 0.0105) {
  slab(gb, key, u0, u1, v, v + 0.005, hw * 0.9, x, color, { bevel: 0.0008, bevSeg: 1 });
  for (let u = u0 + 0.004; u < u1 - 0.004; u += pitch) gb.box(key, x, v + 0.0065, -(u + 0.003), hw * 2, 0.003, 0.0045, { color });
}
