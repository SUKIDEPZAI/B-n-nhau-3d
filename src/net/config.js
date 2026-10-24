// PUBLIC client configuration. Nothing in this file is a secret: never put JWT_SECRET, DATABASE_URL or service keys here.
// `serverUrl` is the base URL of the deployed game server (see server/index.js). Leave empty to keep online mode disabled.
// It can also be supplied at runtime with ?server=https://your-server.example (handy for local tests).
const qs = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
// Priority: ?server= > window.__FF_SERVER__ (injected by server/static.js when the game is served by the game server itself)
const fromQuery = qs.get('server') || (typeof window !== 'undefined' && window.__FF_SERVER__) || '';

export const NET = {
  appName: 'Dragon anrena',
  appId: 'f5372cd3-b516-405d-8e66-842d7b2d4b4e',
  // Public app key from the Orbit Developer Portal. It identifies the APP, not the player, and is NOT used for auth.
  // Left empty on purpose: paste it only after you copied it from the portal. Not required by the self-hosted server.
  publicAppKey: '',
  // Documented platform API base. NOT called by this adapter (its endpoints are unverified); kept for a future provider.
  platformApi: '', // Đã bỏ API phụ thuộc Render; online dùng máy chủ Falix bên dưới.
  serverUrl: (fromQuery || 'http://serverbannhau.falixsrv.me:50886').replace(/\/+$/, ''),
  colyseusSdk: 'https://cdn.jsdelivr.net/npm/colyseus.js@0.15/dist/colyseus.js',
  room: 'arena',
  inputHz: 20,
  reconnectWindowMs: 20000,
};
export const wsUrl = (u) => u.replace(/^http/i, 'ws');
