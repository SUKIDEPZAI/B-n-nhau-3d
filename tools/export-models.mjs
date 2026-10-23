// Xuất toàn bộ model ra GLB + OBJ (mở được trong Blender): node tools/export-models.mjs <model-lab.html> <thư mục ra>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [file, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 400)));
await p.addInitScript('window.__x=1');
await p.goto('file://' + file);
await p.waitForFunction('window.__ready', null, { timeout: 120000 });
for (const n of await p.evaluate('window.__names')) {
  const r = await p.evaluate((n) => window.__exportAll(n), n);
  const base = ({ 'Lính phe xanh': 'linh_xanh', 'Lính phe đỏ': 'linh_do', 'AK-12': 'AK12', 'MP7': 'MP7', 'Pistol G17': 'G17', 'SG-12 Shotgun': 'SG12_shotgun', 'SR-7 Bắn tỉa': 'SR7_sniper', 'Hộp y tế': 'medkit', 'Tấm giáp': 'armor_plate', 'Thùng đạn': 'ammo_box', 'Lựu đạn': 'grenade', 'Lính sa mạc': 'linh_sa_mac', 'Lính rừng': 'linh_rung', 'Lính đêm': 'linh_dem' })[n] || 'model';
  fs.writeFileSync(`${outDir}/${base}.glb`, Buffer.from(r.glb, 'base64'));
  fs.writeFileSync(`${outDir}/${base}.obj`, r.obj);
  console.log(n, (r.glb.length * 0.75 / 1024).toFixed(0) + ' KB glb');
}
await b.close();
