// Kiểm thử chơi thử: node tools/play.mjs <html> <outPrefix> [touch]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [file, out, touch = ''] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] });
const vp = touch ? { width: 844, height: 390 } : { width: 1100, height: 620 };
const p = await b.newPage({ viewport: vp, hasTouch: !!touch, isMobile: !!touch });
p.on('console', (m) => { const t = m.text(); if (!/PCFSoft/.test(t)) console.log('console:', t.slice(0, 300)); });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 600)));
await p.addInitScript('window.__manual=true'); await p.goto('file://' + file);
await p.screenshot({ path: out + '_menu.png' });
await p.evaluate("window.__start('" + (process.env.MODE || 'tdm') + "')");
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate('window.__step(1)')));
await p.screenshot({ path: out + '_0.png', timeout: 150000 });
console.log(JSON.stringify(await p.evaluate('(()=>{const i=window.__G().eng.renderer.info;return {calls:i.render.calls,tris:i.render.triangles,geo:i.memory.geometries,tex:i.memory.textures}})()')));
for (let i = 1; i <= 3; i++) {
  await p.evaluate("(()=>{const G=window.__G();const I=null;})()");
  console.log(JSON.stringify(await p.evaluate('window.__step(120)')));
  await p.screenshot({ path: out + '_' + i + '.png', timeout: 150000 });
}
await b.close();
