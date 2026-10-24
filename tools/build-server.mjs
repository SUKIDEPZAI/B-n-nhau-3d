// Builds the upload folder for FalixNodes: falix/{index.js, package.json, public/index.html, env.example, README}.
// The server code + three.js (needed to rebuild the collision map) are bundled into ONE file; only colyseus and pg stay external.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
let esbuild;
try { esbuild = await import('esbuild'); } catch { esbuild = await import(process.env.ESBUILD_PATH || '/opt/npm-tools/node_modules/esbuild/lib/main.js'); }
const out = path.join(root, 'falix');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'public'), { recursive: true });
await esbuild.build({
  entryPoints: [path.join(root, 'server/index.js')], outfile: path.join(out, 'index.js'), bundle: true, platform: 'node', format: 'cjs', target: 'node18',
  minify: false, legalComments: 'none', external: ['colyseus', '@colyseus/ws-transport', 'pg'],
  alias: { three: path.join(root, 'vendor/three/three.module.js'), 'three/addons': path.join(root, 'vendor/three/addons') },
});
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: 'dragon-arena-server', version: '5.2.0', private: true, main: 'index.js', scripts: { start: 'node index.js' }, engines: { node: '>=18' }, dependencies: { colyseus: '^0.15.0', '@colyseus/ws-transport': '^0.15.0', pg: '^8.11.0' } }, null, 2));
const html = path.join(root, 'index.html'); if (fs.existsSync(html)) fs.copyFileSync(html, path.join(out, 'public/index.html'));
fs.copyFileSync(path.join(root, 'server/migrations/001_init.sql'), path.join(out, '001_init.sql'));
fs.writeFileSync(path.join(out, 'env.example'), `# Rename to ".env" (File Manager > New file ".env") and fill in. Never share this file.
JWT_SECRET=PASTE_A_RANDOM_STRING_OF_32_OR_MORE_CHARACTERS
# Leave empty to store profiles in data/profiles.json. For Falix PostgreSQL (Databases page) use the URL it shows:
DATABASE_URL=
PGSSL=disable
# Needed only if the game page is hosted somewhere else (e.g. GitHub Pages over https). Comma separated.
ALLOWED_ORIGINS=
`);
console.log('falix/ ready:', fs.readdirSync(out).join(', '), (fs.statSync(path.join(out, 'index.js')).size / 1024).toFixed(0) + ' KB');
