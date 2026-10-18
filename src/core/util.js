// Tiện ích toán học dùng chung. Toàn bộ game dùng ĐƠN VỊ = MÉT, trục Y hướng lên,
// hướng "tiến" của mô hình/camera là -Z (yaw = 0 nhìn về -Z), +X là bên phải.
export const PI = Math.PI;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a || 1e-9), 0, 1);
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoothstep = (a, b, v) => smooth(invLerp(a, b, v));
/** Làm mượt theo thời gian, độc lập tốc độ khung hình. */
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const wrapPi = (a) => {
  a = (a + PI) % TAU;
  if (a < 0) a += TAU;
  return a - PI;
};
export const angDiff = (a, b) => wrapPi(a - b);
export const dampAngle = (a, b, k, dt) => a + wrapPi(b - a) * (1 - Math.exp(-k * dt));
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/** Bộ sinh số ngẫu nhiên có seed (mulberry32) để map luôn dựng giống nhau. */
export class RNG {
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

export const rnd = new RNG((Math.random() * 1e9) | 0); // RNG gameplay (không cần tái lập)

/** Vị trí 2D có độ phân giải ô lưới -> khoá số nguyên nhanh. */
export const cellKey = (ix, iz) => (ix + 1024) * 4096 + (iz + 1024);

export function hexToRgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
