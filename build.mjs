// Build: gom src/ + three (vendor) thành 1 file HTML chạy offline (double-click được).
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
let esbuild;
try { esbuild = await import('esbuild'); } catch { esbuild = await import(process.env.ESBUILD_PATH || '/opt/npm-tools/node_modules/esbuild/lib/main.js'); }
const alias = { three: path.join(root, 'vendor/three/three.module.js'), 'three/addons': path.join(root, 'vendor/three/addons') };
async function bundle(entry, out, title, css, body) {
  const r = await esbuild.build({ entryPoints: [path.join(root, entry)], bundle: true, minify: !process.env.DEV, format: 'iife', target: 'es2020', write: false, alias, legalComments: 'none' });
  const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#10151a"><title>${title}</title><style>${css}</style></head><body>${body}<script>${js}</script></body></html>`;
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, out), html);
  console.log(out, (html.length / 1024).toFixed(0) + ' KB');
}
const css = fs.readFileSync(path.join(root, 'src/ui/hud.css'), 'utf8');
await bundle(process.env.ENTRY||'src/main.js', 'dist/field-force-3d.html', 'Field Force 3D', css, fs.readFileSync(path.join(root, 'src/ui/body.html'), 'utf8'));
// Keep the root HTML and Falix's served page in sync after each build.
const builtHtml = path.join(root, 'dist/field-force-3d.html');
fs.copyFileSync(builtHtml, path.join(root, 'index.html'));
const falixPublic = path.join(root, 'falix/public');
fs.mkdirSync(falixPublic, { recursive: true });
fs.copyFileSync(builtHtml, path.join(falixPublic, 'index.html'));
if (fs.existsSync(path.join(root, 'tools/model-lab.js'))) await bundle('tools/model-lab.js', 'dist/model-lab.html', 'Model Lab', 'html,body{margin:0;height:100%;background:#15191e;color:#dde;font:13px system-ui;overflow:hidden}#ui{position:fixed;left:10px;top:10px;background:#0009;padding:10px;border-radius:8px;max-width:340px}button,select{margin:2px;padding:6px 10px}', '<div id="ui"></div>');
