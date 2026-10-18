// Chụp ảnh bằng Chromium headless (SwiftShader). Dùng: node tools/shots.mjs <html> <out.png> '<js gọi sau khi sẵn sàng>' [w h]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [file, out, js = '', w = 960, h = 540, touch = ''] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, hasTouch: !!touch, isMobile: !!touch });
p.on('console', (m) => console.log('console:', m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 500)));
await p.goto('file://' + file);
await p.waitForFunction('window.__ready', null, { timeout: 120000 });
if (js) console.log(JSON.stringify(await p.evaluate(js)));
await p.waitForTimeout(300);
await p.screenshot({ path: out });
await b.close();
