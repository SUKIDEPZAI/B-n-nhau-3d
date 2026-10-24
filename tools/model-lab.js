// Model Lab: xem model theo mét (lưới 1 m/10 cm), đo hộp bao, xuất GLB/OBJ để mở trong Blender.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { BUILDERS } from '../src/models/weapons.js';
import { buildMedkit, buildArmorPlate, buildAmmoBox, buildGrenade } from '../src/models/props.js';
import { Soldier } from '../src/models/soldier.js';
import { Engine } from '../src/core/engine.js';
import { createTextures } from '../src/world/textures.js';
import { createMaterials, buildVillage } from '../src/world/village.js';

const canvas = document.createElement('canvas'); canvas.id = 'game'; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
document.body.prepend(canvas);
const eng = new Engine(canvas, 'high');
eng.sun.castShadow = true;
const scene = eng.scene, cam = eng.camera;
const grid = new THREE.GridHelper(10, 100, 0x888888, 0x444444); scene.add(grid);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x555a5e, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true; scene.add(ground);
const ctl = new OrbitControls(cam, canvas);
let cur = null, box = null, name = '';
const ui = document.getElementById('ui');
ui.innerHTML = '<b>Model Lab</b> — kích thước thật (m)<br><select id=sel></select><br><button id=glb>Xuất GLB</button><button id=obj>Xuất OBJ</button><button id=spin>Xoay</button><pre id=info></pre><small>Kéo chuột để xoay, lăn để zoom. Lưới nhỏ = 10 cm.</small>';
let spin = true; document.getElementById('spin').onclick = () => (spin = !spin);
const models = {
  'AK-12': () => BUILDERS.ak12(), 'MP7': () => BUILDERS.mp7(), 'Hộp y tế': buildMedkit, 'Tấm giáp': buildArmorPlate, 'Thùng đạn': buildAmmoBox, 'Lựu đạn': buildGrenade, 'Pistol G17': () => BUILDERS.pistol(), 'SG-12 Shotgun': () => BUILDERS.shotgun(), 'SR-7 Bắn tỉa': () => BUILDERS.sniper(),
  'Lính phe xanh': () => { const s = new Soldier('blue'); s.setWeapon(BUILDERS.ak12()); for (let i = 0; i < 30; i++) s.update(0.05, { speed: 0 }); return s.root; },
  'Lính sa mạc': () => { const s = new Soldier('blue_desert'); s.setWeapon(BUILDERS.ak12()); for (let i = 0; i < 30; i++) s.update(0.05, { speed: 0 }); return s.root; },
  'Lính rừng': () => { const s = new Soldier('blue_wood'); s.setWeapon(BUILDERS.ak12()); for (let i = 0; i < 30; i++) s.update(0.05, { speed: 0 }); return s.root; },
  'Lính đêm': () => { const s = new Soldier('blue_night'); s.setWeapon(BUILDERS.sniper()); for (let i = 0; i < 30; i++) s.update(0.05, { speed: 0 }); return s.root; },
  'Lính phe đỏ': () => { const s = new Soldier('red'); s.setWeapon(BUILDERS.mp7()); for (let i = 0; i < 30; i++) s.update(0.05, { speed: 0 }); return s.root; },
};
const sel = document.getElementById('sel');
for (const k of Object.keys(models)) sel.add(new Option(k, k));
function show(n) {
  if (cur) scene.remove(cur);
  name = n; cur = models[n](); scene.add(cur);
  cur.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  cur.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(cur);
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  let tris = 0; cur.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  document.getElementById('info').textContent = `Dài (Z): ${sz.z.toFixed(3)} m\nRộng (X): ${sz.x.toFixed(3)} m\nCao (Y): ${sz.y.toFixed(3)} m\nTam giác: ${tris | 0}`;
  const big = Math.max(sz.x, sz.y, sz.z);
  if (n.startsWith('Lính')) cur.position.set(0, 0, 0); else cur.position.set(-c.x, 0.9 - c.y, -c.z);
  ctl.target.set(0, n.startsWith('Lính') ? 0.95 : 0.9, 0);
  cam.position.set(big * 1.1 + 0.3, ctl.target.y + big * 0.25, big * 1.4 + 0.5);
  cam.near = 0.01; cam.updateProjectionMatrix();
  window.__lab = { sz, tris };
}
sel.onchange = () => show(sel.value);
function save(blob, fn) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click(); }
document.getElementById('glb').onclick = () => new GLTFExporter().parse(cur, (r) => save(new Blob([r], { type: 'model/gltf-binary' }), name.replace(/\W+/g, '_') + '.glb'), console.error, { binary: true, onlyVisible: true });
document.getElementById('obj').onclick = () => save(new Blob([new OBJExporter().parse(cur)], { type: 'text/plain' }), name.replace(/\W+/g, '_') + '.obj');
const urlM = new URLSearchParams(location.search).get('m'); if (urlM && models[urlM]) sel.value = urlM;
show(sel.value);
let t0 = performance.now();
function loop() { requestAnimationFrame(loop); const dt = (performance.now() - t0) / 1000; t0 = performance.now(); if (spin && cur) cur.rotation.y += dt * 0.5; ctl.update(); eng.followShadow(0, 0, 0); eng.render(); }
loop();
window.__ready = true;
window.__show = (n, ry) => { sel.value = n; show(n); spin = false; cur.rotation.y = ry || 0; eng.render(); return window.__lab.sz; };
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
window.__exportAll = async (n) => { sel.value = n; show(n); spin = false; cur.rotation.y = 0; cur.updateMatrixWorld(true);
  const glb = await new Promise((ok, no) => new GLTFExporter().parse(cur, ok, no, { binary: true, onlyVisible: true }));
  return { glb: b64(glb), obj: new OBJExporter().parse(cur) }; };
window.__names = Object.keys(models);
window.__view = (px, py, pz, tx, ty, tz) => { cam.position.set(px, py, pz); ctl.target.set(tx, ty, tz); cam.lookAt(tx, ty, tz); ctl.update(); eng.render(); };
