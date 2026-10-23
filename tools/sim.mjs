// Mô phỏng nhanh (không vẽ) để kiểm tra logic trận: node tools/sim.mjs <html> <mode> <steps>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [file, mode = 'tdm', steps = '3000', shot = ''] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] });
const touch = !!process.env.TOUCH; const p = await b.newPage({ viewport: touch ? { width: 844, height: 390 } : { width: 1100, height: 620 }, hasTouch: touch, isMobile: touch });
p.on('console', (m) => { const t = m.text(); if (!/PCFSoft/.test(t)) console.log('console:', t.slice(0, 300)); });
p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 600)));
await p.addInitScript('window.__manual=true'); if (process.env.INV) await p.addInitScript(`localStorage.setItem('ff_inv2', '${process.env.INV}')`);
await p.goto('file://' + file);
await p.evaluate(`window.__start('${mode}')`); await p.evaluate('window.__step(1)');
const r = await p.evaluate(`(async()=>{
  const G=window.__G(), I=window.__input, P=G.P; const out=[]; const t0=performance.now();
  for(let k=0;k<${steps};k++){
    // người chơi "tự động": nhắm kẻ địch gần nhất nhìn thấy và bắn
    let best=null,bd=1e9; for(const u of G.units){ if(u===P||!u.alive||u.decoy||!G.hostile(P,u))continue; const d=Math.hypot(u.x-P.x,u.z-P.z); if(d<bd&&d<60&&G.world.los({x:P.x,y:P.y+1.6,z:P.z},{x:u.x,y:u.y+1.3,z:u.z})){bd=d;best=u;} }
    if(best&&P.alive){ const ty=Math.atan2(-(best.x-P.x),-(best.z-P.z)); P.yaw=ty; P.pitch=Math.atan2(best.y+1.4-(P.y+1.6),bd); I.fire=true; I.mz=0; } else { I.fire=false; I.mz=1; I.mx=0; if(k%200===0) P.yaw+=1.1; }
    window.__sim(0.05);
    
    if(k%600===0) out.push([k,G.t.toFixed(0),JSON.stringify(G.score),G.units.filter(u=>u.alive).length,P.hp|0,P.kills,P.deaths]);
  }
  out.push({end:!G.running, score:G.score, ms:(performance.now()-t0)|0, kills:G.units.map(u=>u.name+':'+u.kills+'/'+u.deaths).join(' ')});
  return out;})()`);
for (const x of r) console.log(JSON.stringify(x));
if (process.env.SHOTJS) console.log(JSON.stringify(await p.evaluate(process.env.SHOTJS)));
if (shot) await p.screenshot({ path: shot, timeout: 150000 });
await b.close();
