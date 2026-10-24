// Serves the single-file game from the game server itself (same origin => no CORS, no mixed-content problem on plain http hosts).
import fs from 'node:fs';
import path from 'node:path';

export function createStatic(dir) {
  const file = path.join(dir, 'index.html');
  let cache = null, mtime = 0;
  const load = () => {
    const st = fs.statSync(file);
    if (!cache || st.mtimeMs !== mtime) {
      mtime = st.mtimeMs;
      // The server URL is the page origin; injected at serve time so the same build works on any host/port.
      cache = Buffer.from(fs.readFileSync(file, 'utf8').replace('<head>', '<head><script>window.__FF_SERVER__=location.origin</script>'));
    }
    return cache;
  };
  return (req, res, url) => {
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url.pathname !== '/' && url.pathname !== '/index.html') { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not_found"}'); }
    try {
      const body = load();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Game files not found. Upload index.html into the "public" folder next to index.js.');
    }
  };
}
