import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { createTextures } from './world/textures.js';
import { createMaterials, buildVillage } from './world/village.js';
(async () => {
  const eng = new Engine(document.getElementById('game'), 'high');
  const T = await createTextures({ res: 512, aniso: 8 });
  const M = createMaterials(T, true);
  const t0 = performance.now();
  const v = buildVillage(M);
  eng.scene.add(v.group);
  window.__ff = { eng, v, ms: performance.now() - t0, set(x, y, z, tx, ty, tz, fov = 65) { eng.camera.position.set(x, y, z); eng.camera.lookAt(tx, ty, tz); eng.camera.fov = fov; eng.camera.updateProjectionMatrix(); eng.followShadow(x, 0, z); eng.render(); } };
  window.__ready = true;
})();
