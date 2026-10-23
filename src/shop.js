// Cửa hàng: mở khoá súng / trang phục bằng cách xem quảng cáo; lưu trong localStorage.
import * as THREE from 'three';
import { BUILDERS } from './models/weapons.js';
import { Soldier } from './models/soldier.js';
import { rewardedAd, adsMode, rewardWait } from './ads.js';

export const ITEMS = [
  { id: 'ak12', type: 'weapon', name: 'AK-12', desc: 'Súng trường 5,45 mm. Cân bằng, tầm xa tốt.', ads: 0, stat: [26, 600, 30] },
  { id: 'mp7', type: 'weapon', name: 'MP7', desc: 'Tiểu liên nhỏ gọn, tốc độ bắn cao.', ads: 0, stat: [18, 900, 40] },
  { id: 'shotgun', type: 'weapon', name: 'SG-12', desc: 'Shotgun bơm, 9 viên chì. Cực mạnh ở cự ly gần.', ads: 2, stat: ['9×13', 70, 6] },
  { id: 'sniper', type: 'weapon', name: 'SR-7', desc: 'Bắn tỉa có ống ngắm. Một phát trúng đầu hạ gục.', ads: 3, stat: [95, 48, 5] },
  { id: 'std', type: 'skin', name: 'Tiêu chuẩn', desc: 'Quân phục mặc định.', ads: 0 },
  { id: 'desert', type: 'skin', name: 'Sa mạc', desc: 'Màu cát, phù hợp bản đồ nắng.', ads: 1 },
  { id: 'wood', type: 'skin', name: 'Rừng rậm', desc: 'Xanh rêu, ẩn nấp trong bụi cây.', ads: 1 },
  { id: 'night', type: 'skin', name: 'Đêm', desc: 'Đồ đen chiến thuật.', ads: 2 },
];
const KEY = 'ff_inv2';
let inv = { owned: ['ak12', 'mp7', 'std'], prog: {}, primary: 'ak12', skin: 'std' };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && Array.isArray(j.owned)) inv = { ...inv, ...j, owned: [...new Set([...inv.owned, ...j.owned])] }; } catch { /* mặc định */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(inv)); } catch { /* bỏ qua */ } };
export const loadout = () => ({ primary: inv.primary, skin: inv.skin });
const owned = (id) => inv.owned.includes(id);
const $ = (id) => document.getElementById(id);

// ---- ảnh xem trước: render 1 lần bằng WebGL nhỏ rồi huỷ ----
const thumbs = {};
function makeThumbs() {
  try {
    const W = 360, H = 210, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(W, H, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, W / H, 0.05, 20);
    sc.add(new THREE.HemisphereLight(0xeaf0ff, 0x8a7656, 2.0)); const d = new THREE.DirectionalLight(0xfff0d8, 3); d.position.set(-1.5, 2.5, 2); sc.add(d); const d2 = new THREE.DirectionalLight(0x88aaff, 1.2); d2.position.set(2, 1, -2); sc.add(d2);
    for (const it of ITEMS) {
      let o;
      if (it.type === 'weapon') o = BUILDERS[it.id]();
      else { const s = new Soldier(it.id === 'std' ? 'blue' : 'blue_' + it.id); s.setWeapon(BUILDERS.ak12()); for (let i = 0; i < 25; i++) s.update(0.05, { speed: 0 }); o = s.root; }
      sc.add(o); o.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      if (it.type === 'weapon') { o.rotation.y = -0.45; o.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(o), c2 = b2.getCenter(new THREE.Vector3()); const big = Math.max(sz.z, sz.y * 1.5); cam.position.set(c2.x, c2.y + big * 0.1, c2.z + big * 1.18); cam.lookAt(c2); o.position.x -= 0; }
      else { o.rotation.y = 0.5; cam.position.set(c.x + 0.2, c.y + 0.1, c.z + 4.1); cam.lookAt(c); }
      r.setClearColor(0x000000, 0); r.render(sc, cam); thumbs[it.id] = cv.toDataURL('image/png'); sc.remove(o);
    }
    r.dispose(); r.forceContextLoss?.();
  } catch (e) { console.warn('thumbs', e); }
}

let tab = 'weapon', busy = false;
function render() {
  const list = $('shopList'); list.innerHTML = '';
  for (const it of ITEMS.filter((i) => i.type === tab)) {
    const has = owned(it.id), on = (it.type === 'weapon' ? inv.primary : inv.skin) === it.id, p = inv.prog[it.id] || 0;
    const el = document.createElement('div'); el.className = 'item' + (on ? ' on' : '') + (has ? '' : ' lock');
    const st = it.stat ? `<div class="st"><span>Sát thương <b>${it.stat[0]}</b></span><span>Tốc độ <b>${it.stat[1]}</b></span><span>Băng <b>${it.stat[2]}</b></span></div>` : '';
    el.innerHTML = `<div class="th">${thumbs[it.id] ? `<img alt="${it.name}" src="${thumbs[it.id]}">` : ''}${has ? '' : '<i class="lk">🔒</i>'}</div><div class="ib"><b>${it.name}</b><small>${it.desc}</small>${st}</div>`;
    const b = document.createElement('button');
    if (has) { b.textContent = on ? 'ĐANG DÙNG' : 'TRANG BỊ'; b.disabled = on; b.className = on ? 'dim' : 'eq'; b.onclick = () => { if (it.type === 'weapon') inv.primary = it.id; else inv.skin = it.id; save(); render(); onChange?.(); }; }
    else { b.className = 'ad'; b.innerHTML = `▶ XEM QUẢNG CÁO <em>${p}/${it.ads}</em>`; b.onclick = () => watch(it); }
    el.appendChild(b); list.appendChild(el);
  }
  $('shopMode').textContent = { sim: 'Chế độ thử: quảng cáo mô phỏng (chưa cấu hình AdSense — xem src/config.js)', real: ADS_LABEL, blocked: 'Không tải được quảng cáo (trình chặn quảng cáo hoặc mạng). Thử lại sau.' }[adsMode()];
  for (const t of document.querySelectorAll('#shopTabs button')) t.classList.toggle('sel', t.dataset.t === tab);
}
const ADS_LABEL = 'Quảng cáo do Google AdSense cung cấp. Xem hết để nhận thưởng.';
let onChange = null;
async function watch(it) {
  if (busy) return;
  const w = rewardWait(); if (w > 0) { toast(`Chờ ${Math.ceil(w / 1000)} giây rồi xem tiếp`); return; }
  busy = true; $('shopList').classList.add('busy');
  const r = await rewardedAd('unlock-' + it.id, { before: () => hooks.mute(true), after: () => hooks.mute(false) });
  busy = false; $('shopList').classList.remove('busy');
  if (r === 'viewed') {
    inv.prog[it.id] = (inv.prog[it.id] || 0) + 1;
    if (inv.prog[it.id] >= it.ads) { inv.owned.push(it.id); toast(`Đã mở khoá ${it.name}!`); if (it.type === 'weapon') inv.primary = it.id; else inv.skin = it.id; } else toast(`Còn ${it.ads - inv.prog[it.id]} lượt nữa để mở ${it.name}`);
    save(); onChange?.();
  } else if (r === 'dismissed') toast('Bạn cần xem hết quảng cáo để nhận thưởng');
  else if (r === 'cooldown') toast('Vui lòng chờ một chút rồi xem tiếp');
  else toast('Hiện chưa có quảng cáo, thử lại sau');
  render();
}
let tt = 0;
function toast(m) { const t = $('shopToast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400); }
const hooks = { mute: () => {} };
export function initShop(opts) {
  hooks.mute = opts.mute || hooks.mute; onChange = opts.onChange;
  makeThumbs();
  for (const b of document.querySelectorAll('#shopTabs button')) b.addEventListener('click', () => { tab = b.dataset.t; render(); });
  $('openShop').addEventListener('click', () => { $('shop').classList.remove('hide'); render(); });
  $('shopX').addEventListener('click', () => { $('shop').classList.add('hide'); onChange?.(); });
  onChange?.();
}
export const itemName = (id) => ITEMS.find((i) => i.id === id)?.name || id;
