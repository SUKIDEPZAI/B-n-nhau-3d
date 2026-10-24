// Hiệu ứng: hạt (tia lửa, chớp nòng, nổ, khói) và vệt đạn — mỗi loại 1 draw call, không cấp phát khi chạy.
import * as THREE from 'three';

const VS = 'attribute float aSize;attribute vec4 aCol;varying vec4 vC;uniform float uScale;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(aSize*uScale/max(-mv.z,.1),0.);}';
const FS = 'varying vec4 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.15,d);gl_FragColor=vec4(vC.rgb,vC.a*a);}';

class Pool {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0; this.next = 0;
    this.pos = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.col = new Float32Array(cap * 4);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.uni = { uScale: { value: 500 } };
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uni, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false; this.pts.renderOrder = 5;
    scene.add(this.pts);
    this.geo = g;
  }
  add(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav; this.drag[i] = drag;
    const c = i * 4; this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a; this.size[i] = s0;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      const t = 1 - this.life[i] / this.max[i], k = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.3; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.col[i * 4 + 3] = this.col[i * 4 + 3] * (1 - dt / Math.max(this.life[i] + dt, 0.001) * 0.9);
    }
    if (any || this.dirty) {
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true;
    }
    this.dirty = any;
  }
}

export class FX {
  constructor(scene) {
    this.glow = new Pool(scene, 256, true);
    this.smoke = new Pool(scene, 96, false);
    // vệt đạn: LineSegments cộng sáng
    const N = 40;
    this.N = N; this.tr = [];
    for (let i = 0; i < N; i++) this.tr.push({ on: false, ax: 0, ay: 0, az: 0, dx: 0, dy: 0, dz: 0, len: 0, d: 0, spd: 0, c: 0 });
    this.tp = new Float32Array(N * 6); this.tc = new Float32Array(N * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.tp, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.tc, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 6;
    scene.add(this.lines); this.tg = g; this.ti = 0;
  }
  setCamera(cam, renderer) { const s = renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)); this.glow.uni.uScale.value = s; this.smoke.uni.uScale.value = s; }
  flash(x, y, z, size = 0.35) { this.glow.add(x, y, z, 0, 0, 0, 0.05, size, size * 0.5, 1, 0.8, 0.45, 1); }
  spark(x, y, z, nx, ny, nz, n = 5, dust = true) {
    for (let i = 0; i < n; i++) {
      const sp = 2 + Math.random() * 4;
      this.glow.add(x, y, z, (nx + (Math.random() - 0.5) * 1.1) * sp, (ny + Math.random() * 0.8) * sp, (nz + (Math.random() - 0.5) * 1.1) * sp, 0.25 + Math.random() * 0.2, 0.05, 0.02, 1, 0.7, 0.3, 1, 12, 1);
    }
    if (dust) this.smoke.add(x, y, z, nx * 0.6, ny * 0.6 + 0.2, nz * 0.6, 0.7, 0.18, 0.5, 0.62, 0.58, 0.5, 0.45, -0.1, 2);
  }
  blood(x, y, z, nx, ny, nz) {
    for (let i = 0; i < 4; i++) this.smoke.add(x, y, z, (nx + (Math.random() - 0.5)) * 1.5, (ny + Math.random() * 0.6) * 1.5, (nz + (Math.random() - 0.5)) * 1.5, 0.45, 0.08, 0.16, 0.55, 0.06, 0.05, 0.8, 8, 2);
  }
  explosion(x, y, z) {
    this.glow.add(x, y + 0.4, z, 0, 0, 0, 0.18, 2.5, 6, 1, 0.75, 0.35, 1);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, e = Math.random() * 1.2, sp = 3 + Math.random() * 8;
      this.glow.add(x, y + 0.3, z, Math.cos(a) * sp, Math.sin(e) * sp * 0.8, Math.sin(a) * sp, 0.35 + Math.random() * 0.4, 0.45, 0.1, 1, 0.55 + Math.random() * 0.3, 0.2, 0.9, 7, 1.6);
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.283, sp = 1 + Math.random() * 3;
      this.smoke.add(x, y + 0.5, z, Math.cos(a) * sp, 1 + Math.random() * 2.5, Math.sin(a) * sp, 1.4 + Math.random(), 1.0, 3.2, 0.25, 0.24, 0.23, 0.6, -0.6, 1.5);
    }
  }
  tracer(ax, ay, az, bx, by, bz, c = 0) {
    const t = this.tr[this.ti]; this.ti = (this.ti + 1) % this.N;
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz) || 1;
    t.on = true; t.ax = ax; t.ay = ay; t.az = az; t.dx = dx / d; t.dy = dy / d; t.dz = dz / d; t.len = d; t.d = 0; t.spd = 320; t.c = c;
  }
  update(dt) {
    this.glow.update(dt); this.smoke.update(dt);
    let any = false;
    for (let i = 0; i < this.N; i++) {
      const t = this.tr[i], o = i * 6;
      if (!t.on) { if (this.tp[o] !== 0 || this.tp[o + 3] !== 0) { this.tp.fill(0, o, o + 6); } continue; }
      any = true;
      t.d += t.spd * dt;
      const head = Math.min(t.d, t.len), tail = Math.max(0, t.d - 7);
      if (tail >= t.len) { t.on = false; this.tp.fill(0, o, o + 6); continue; }
      this.tp[o] = t.ax + t.dx * tail; this.tp[o + 1] = t.ay + t.dy * tail; this.tp[o + 2] = t.az + t.dz * tail;
      this.tp[o + 3] = t.ax + t.dx * head; this.tp[o + 4] = t.ay + t.dy * head; this.tp[o + 5] = t.az + t.dz * head;
      const r = t.c ? 1 : 1, g = t.c ? 0.45 : 0.85, b = t.c ? 0.3 : 0.5;
      this.tc[o] = 0; this.tc[o + 1] = 0; this.tc[o + 2] = 0; this.tc[o + 3] = r; this.tc[o + 4] = g; this.tc[o + 5] = b;
    }
    if (any || this.tdirty) { this.tg.attributes.position.needsUpdate = true; this.tg.attributes.color.needsUpdate = true; }
    this.tdirty = any;
  }
}
