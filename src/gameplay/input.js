// Điều khiển: bàn phím + chuột (pointer lock) và cảm ứng (cần analog, vùng xoay, nút bắn kéo-để-xoay).
export class Input {
  constructor() {
    this.touch = matchMedia('(pointer:coarse)').matches;
    this.mx = 0; this.mz = 0;       // mx phải +, mz tiến +
    this.lx = 0; this.ly = 0;       // tích luỹ xoay (radian)
    this.fire = false; this.adsHold = false; this.crouchT = false;
    this.e = { jump: 0, reload: 0, swap: 0, nade: 0, scan: 0, holo: 0, emote: 0, cmd: 0, cam: 0, pause: 0, slot: -1 };
    this.keys = new Set();
    this.sens = this.touch ? 0.0042 : 0.0022;
    this.locked = false;
    document.body.classList.toggle('touch', this.touch);
    this._keys(); this._mouse(); if (this.touch) this._touch();
  }
  _keys() {
    addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      const k = ev.code; this.keys.add(k);
      const e = this.e;
      if (k === 'Space') e.jump = 1; else if (k === 'KeyR') e.reload = 1; else if (k === 'KeyG') e.nade = 1;
      else if (k === 'KeyQ') e.scan = 1; else if (k === 'KeyE') e.holo = 1; else if (k === 'KeyT') e.emote = 1; else if (k === 'KeyX') e.cmd = 1;
      else if (k === 'KeyV') e.cam = 1; else if (k === 'Escape') e.pause = 1; else if (k === 'KeyC' || k === 'ControlLeft') this.crouchT = !this.crouchT;
      else if (k === 'Digit1') e.slot = 0; else if (k === 'Digit2') e.slot = 1; else if (k === 'Digit3') e.slot = 2;
      if (k === 'Space' || k.startsWith('Arrow')) ev.preventDefault();
    });
    addEventListener('keyup', (ev) => this.keys.delete(ev.code));
    addEventListener('blur', () => this.keys.clear());
  }
  _mouse() {
    const cv = document.getElementById('game');
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === cv; if (!this.locked && this.active) this.e.pause = 1; });
    addEventListener('mousedown', (ev) => { if (this.touch || !this.active || ev.target.closest?.('button')) return; if (!this.locked) { cv.requestPointerLock?.(); return; } if (ev.button === 0) this.fire = true; else if (ev.button === 2) this.adsHold = true; });
    addEventListener('mouseup', (ev) => { if (ev.button === 0) this.fire = false; else if (ev.button === 2) this.adsHold = false; });
    addEventListener('mousemove', (ev) => { if (this.locked) { this.lx += ev.movementX * this.sens; this.ly += ev.movementY * this.sens; } });
    addEventListener('contextmenu', (ev) => ev.preventDefault());
    addEventListener('wheel', (ev) => { if (this.locked) this.e.slot = -2 - Math.sign(ev.deltaY); }, { passive: true });
  }
  _touch() {
    const $ = (id) => document.getElementById(id);
    const joy = $('joy'), knob = $('knob');
    let jid = -1, jx = 0, jy = 0;
    const jm = (ev) => {
      const r = joy.getBoundingClientRect(), R = r.width / 2;
      let dx = ev.clientX - (r.left + R), dy = ev.clientY - (r.top + R); const d = Math.hypot(dx, dy), m = Math.min(d, R);
      if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      jx = dx / R; jy = dy / R; this.mx = Math.abs(jx) < 0.12 ? 0 : jx; this.mz = Math.abs(jy) < 0.12 ? 0 : -jy;
    };
    joy.addEventListener('pointerdown', (ev) => { jid = ev.pointerId; joy.setPointerCapture(jid); jm(ev); });
    joy.addEventListener('pointermove', (ev) => { if (ev.pointerId === jid) jm(ev); });
    const je = (ev) => { if (ev.pointerId !== jid) return; jid = -1; knob.style.transform = ''; this.mx = this.mz = 0; };
    joy.addEventListener('pointerup', je); joy.addEventListener('pointercancel', je);
    // vùng xoay
    const dragLook = (el, onDown, onUp) => {
      let id = -1, px = 0, py = 0;
      el.addEventListener('pointerdown', (ev) => { id = ev.pointerId; el.setPointerCapture(id); px = ev.clientX; py = ev.clientY; onDown?.(); });
      el.addEventListener('pointermove', (ev) => { if (ev.pointerId !== id) return; this.lx += (ev.clientX - px) * this.sens; this.ly += (ev.clientY - py) * this.sens; px = ev.clientX; py = ev.clientY; });
      const up = (ev) => { if (ev.pointerId !== id) return; id = -1; onUp?.(); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    dragLook($('lookzone'));
    for (const id of ['fire', 'fire2']) dragLook($(id), () => { this.fire = true; $(id).classList.add('on'); }, () => { this.fire = false; $(id).classList.remove('on'); });
    const tap = (id, fn) => $(id).addEventListener('pointerdown', (ev) => { ev.preventDefault(); fn(); });
    const e = this.e;
    $('ads').addEventListener('pointerdown', () => { this.adsT = !this.adsT; $('ads').classList.toggle('on', this.adsT); });
    tap('jump', () => (e.jump = 1)); tap('reload', () => (e.reload = 1)); tap('swap', () => (e.swap = 1)); tap('nade', () => (e.nade = 1));
    tap('crouch', () => { this.crouchT = !this.crouchT; $('crouch').classList.toggle('on', this.crouchT); });
  }
  get ads() { return this.adsHold || !!this.adsT; }
  /** gộp phím vào mx/mz (gọi mỗi khung) */
  poll() {
    if (!this.touch) {
      const k = this.keys;
      this.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      this.mz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    }
  }
  take() { const o = [this.lx, this.ly]; this.lx = this.ly = 0; return o; }
}
