// Colyseus connection wrapper: SDK loading, join/create/quick-play, reconnect with backoff, latency probe, listener cleanup.
// States: idle | loading | connecting | connected | reconnecting | disconnected | room-full | not-found | auth-failed | error
import { NET, wsUrl } from './config.js';

let sdkPromise = null;
function loadSdk() {
  if (window.Colyseus) return Promise.resolve(window.Colyseus);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = NET.colyseusSdk; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => (window.Colyseus ? res(window.Colyseus) : rej(new Error('sdk-missing')));
    s.onerror = () => { sdkPromise = null; rej(new Error('sdk-load-failed')); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}
export function classifyError(e) {
  const m = String((e && (e.message || e.code)) || e || '');
  if (/room-full|full|locked|maxClients/i.test(m)) return 'room-full';
  if (/not found|invalid room|no rooms|roomId/i.test(m)) return 'not-found';
  if (/unauthorized|401/i.test(m)) return 'auth-failed';
  return 'error';
}

export class Realtime {
  constructor() {
    this.state = 'idle'; this.detail = ''; this.rtt = 0; this.room = null; this.client = null;
    this.stateCbs = new Set(); this.handlers = new Map(); this.token = ''; this.reconnectToken = ''; this.disposed = false;
    this.pingTimer = 0; this.reconnectTimer = 0; this.wantLeave = false;
  }
  onState(cb) { this.stateCbs.add(cb); cb(this.state, this.detail); return () => this.stateCbs.delete(cb); }
  setState(s, d = '') { this.state = s; this.detail = d; for (const cb of this.stateCbs) { try { cb(s, d); } catch (e) { console.error(e); } } }
  /** Registers a message handler; survives reconnects. Returns an unsubscribe function. */
  on(type, cb) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(cb);
    return () => this.handlers.get(type)?.delete(cb);
  }
  get code() { return this.room ? this.room.roomId || this.room.id : ''; }
  async connect({ token, mode = 'quick', code = '', name = '', isPrivate = false }) {
    if (this.disposed) return null;
    this.wantLeave = false; this.token = token;
    try {
      this.setState('loading', 'Đang tải thư viện mạng…');
      const C = await loadSdk();
      this.setState('connecting', 'Đang kết nối máy chủ…');
      this.client = new C.Client(wsUrl(NET.serverUrl));
      const opts = { token, name, private: isPrivate };
      const room = mode === 'create' ? await this.client.create(NET.room, opts) : mode === 'join' ? await this.client.joinById(code.trim().toUpperCase(), opts) : await this.client.joinOrCreate(NET.room, opts);
      this.attach(room); this.setState('connected', ''); this.startPing();
      return room;
    } catch (e) {
      const s = classifyError(e); this.setState(s, String((e && e.message) || e)); throw e;
    }
  }
  attach(room) {
    this.detach(); this.room = room; this.reconnectToken = room.reconnectionToken || '';
    for (const [type, set] of this.handlers) room.onMessage(type, (m) => { for (const cb of set) { try { cb(m); } catch (e) { console.error(e); } } });
    room.onMessage('pong', (m) => { this.rtt = Math.round(performance.now() - (m && m.t)); });
    room.onError((code, msg) => this.setState('error', `${code} ${msg || ''}`));
    room.onLeave((code) => this.handleLeave(code, room));
  }
  detach() { if (this.room) { try { this.room.removeAllListeners(); } catch { /* ignore */ } } }
  handleLeave(code, room) {
    if (this.room !== room) return;
    this.stopPing();
    if (this.wantLeave || code === 1000) { this.room = null; this.setState('idle', ''); return; }
    if (code === 4008) { this.room = null; this.setState('disconnected', 'Bạn bị ngắt vì gửi dữ liệu quá nhanh.'); return; }
    this.reconnect();
  }
  async reconnect() {
    const C = window.Colyseus, t0 = performance.now(); let attempt = 0;
    const waits = [500, 1000, 2000, 3000, 4000];
    while (!this.disposed && !this.wantLeave && performance.now() - t0 < NET.reconnectWindowMs) {
      attempt++; this.setState('reconnecting', `Mất kết nối — đang thử lại (${attempt})…`);
      try {
        const room = await this.client.reconnect(this.reconnectToken);
        if (this.wantLeave || this.disposed) { room.leave(); return; }
        this.attach(room); this.setState('connected', ''); this.startPing(); this.emit('reconnected', { attempt }); return;
      } catch (e) { void C; }
      await new Promise((r) => (this.reconnectTimer = setTimeout(r, waits[Math.min(attempt - 1, waits.length - 1)])));
    }
    if (!this.wantLeave && !this.disposed) { this.room = null; this.setState('disconnected', 'Không thể kết nối lại. Máy chủ có thể đã khởi động lại hoặc phòng đã đóng.'); }
  }
  emit(type, m) { for (const cb of this.handlers.get(type) || []) { try { cb(m); } catch (e) { console.error(e); } } }
  send(type, msg) { if (this.room && this.state === 'connected') { try { this.room.send(type, msg); } catch { /* socket closing */ } } }
  startPing() { this.stopPing(); this.pingTimer = setInterval(() => this.send('ping', { t: performance.now() }), 2000); }
  stopPing() { clearInterval(this.pingTimer); this.pingTimer = 0; }
  async leave() {
    this.wantLeave = true; clearTimeout(this.reconnectTimer); this.stopPing();
    const r = this.room; this.room = null; this.detach();
    if (r) { try { await r.leave(true); } catch { /* already closed */ } }
    this.setState('idle', '');
  }
  /** Releases every listener and timer. Call when the game/scene is torn down. */
  dispose() { this.disposed = true; this.leave(); this.handlers.clear(); this.stateCbs.clear(); }
}
