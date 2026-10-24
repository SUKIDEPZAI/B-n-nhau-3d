// REST client for the game server: guest identity token + profile save/load. All data is scoped to the token's user id on the server.
import { NET } from './config.js';

const KEY = 'ff_net_token';
const mem = {};
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
};
async function req(path, opt = {}) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(NET.serverUrl + path, { ...opt, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(body.error || 'http-' + r.status); e.status = r.status; throw e; }
    return body;
  } finally { clearTimeout(to); }
}
export const platform = {
  enabled() { return !!NET.serverUrl; },
  token() { return ls.get(KEY); },
  /** Returns a valid token, creating a guest identity when needed. */
  async login(name) {
    let t = ls.get(KEY);
    if (t) { try { const p = await req('/api/profile', { headers: { Authorization: 'Bearer ' + t } }); this.profile = p.profile; return { token: t, profile: p.profile }; } catch (e) { if (e.status !== 401) throw e; } }
    const r = await req('/api/auth/guest', { method: 'POST', body: JSON.stringify({ name, appId: NET.appId }) });
    ls.set(KEY, r.token); this.profile = r.profile || null;
    return { token: r.token, profile: this.profile };
  },
  async loadProfile() { const t = ls.get(KEY); if (!t) return null; const r = await req('/api/profile', { headers: { Authorization: 'Bearer ' + t } }); this.profile = r.profile; return r.profile; },
  async saveProfile(patch) { const t = ls.get(KEY); if (!t) throw new Error('not-logged-in'); const r = await req('/api/profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + t }, body: JSON.stringify(patch) }); this.profile = r.profile; return r.profile; },
  profile: null,
};
