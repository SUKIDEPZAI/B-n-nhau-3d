// Định nghĩa vũ khí + kiểm tra tia với "người" (trụ đứng + đầu cầu), không cấp phát.
export const WEAPONS = {
  ak12: { id: 'ak12', name: 'AK-12', rpm: 600, dmg: 26, mag: 30, reserve: 150, spread: 0.010, recoil: 0.0125, range: 160, snd: 'ak12', reload: 2.3, auto: true },
  mp7: { id: 'mp7', name: 'MP7', rpm: 900, dmg: 18, mag: 40, reserve: 160, spread: 0.014, recoil: 0.008, range: 110, snd: 'mp7', reload: 1.9, auto: true },
  shotgun: { id: 'shotgun', name: 'SG-12', rpm: 70, dmg: 13, pellets: 9, mag: 6, reserve: 36, spread: 0.045, recoil: 0.04, range: 45, snd: 'shotgun', reload: 2.8, auto: false },
  sniper: { id: 'sniper', name: 'SR-7', rpm: 48, dmg: 95, mag: 5, reserve: 25, spread: 0.0012, recoil: 0.05, range: 320, snd: 'sniper', reload: 3.0, auto: false, scope: true },
  pistol: { id: 'pistol', name: 'G17', rpm: 420, dmg: 22, mag: 17, reserve: 68, spread: 0.008, recoil: 0.014, range: 90, snd: 'pistol', reload: 1.5, auto: false },
};
export const unitH = (u) => (u.crouch > 0.5 ? 1.3 : 1.8);
const _r = { t: 0, zone: 'body' };
/** Trả về {t, zone} dùng chung 1 đối tượng (đọc ngay, đừng giữ) hoặc null. */
export function rayUnit(u, ox, oy, oz, dx, dy, dz, tmax) {
  const h = unitH(u), R = 0.34;
  let best = Infinity, zone = 'body';
  const px = ox - u.x, pz = oz - u.z, a = dx * dx + dz * dz;
  if (a > 1e-8) {
    const b = px * dx + pz * dz, c = px * px + pz * pz - R * R, disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t >= 0 && t <= tmax) {
        const y = oy + dy * t;
        if (y >= u.y && y <= u.y + h) { best = t; zone = y < u.y + 0.75 ? 'leg' : 'body'; }
      }
    }
  }
  // đầu: cầu r=0.17
  const cx = u.x - ox, cy = u.y + h - 0.16 - oy, cz = u.z - oz, tc = cx * dx + cy * dy + cz * dz;
  if (tc > 0) {
    const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
    if (d2 < 0.0289) {
      const t = tc - Math.sqrt(0.0289 - d2);
      if (t >= 0 && t <= tmax && t < best + 0.4) { best = t; zone = 'head'; }
    }
  }
  if (best === Infinity) return null;
  _r.t = best; _r.zone = zone;
  return _r;
}
