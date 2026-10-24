# Kiến trúc 5.0
```
src/main.js            vòng lặp, người chơi, camera TPP/FPP, chế độ trận, HUD, minimap
src/core/engine.js     renderer, bầu trời shader, PMREM, đèn + bóng bám người chơi, viewmodel pass
src/core/geo.js        GeoBuilder: gộp hộp/trụ/cầu/đùn thành 1 geometry theo vật liệu (UV theo mét)
src/core/phys.js       World (AABB 3D, raycast, LOS) + Nav (lưới 1 m, A*, làm mượt)
src/world/textures.js  texture thủ tục (vữa, ngói, đá, nhựa đường, cỏ…) + bump
src/world/village.js   19 nhà, tường, hàng rào, cây, xe, cột điện, giếng, đài phun… + spawn/mục tiêu/vật phẩm
src/models/weapons.js  AK-12, MP7, G17 theo thước thật
src/models/soldier.js  lính SkinnedMesh 13 xương, hoạt hoạ thủ tục, IK 2 xương cho tay cầm súng
src/gameplay/          bots.js, combat.js (vũ khí + tia vs người), fx.js, input.js, audio.js
src/ui/                body.html + hud.css (HUD mobile bám ảnh tham chiếu)
tools/                 model-lab.js (xem/xuất model), export-models.mjs, shots/play/sim (kiểm thử)
```
Hệ toạ độ: +Y lên, hướng tiến −Z, yaw 0 nhìn −Z, +X phải.
Build: `node build.mjs` (esbuild, three r186 đã vendor sẵn, không cần mạng) → `dist/field-force-3d.html` chạy offline.
