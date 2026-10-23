# Field Force 3D — Village Operations (v5.0)
Bắn súng chiến thuật góc nhìn thứ ba/thứ nhất, bản làng Địa Trung Hải, chơi trực tiếp bằng **một file HTML** (`dist/field-force-3d.html`, mở bằng Chrome/Safari, kể cả điện thoại).

**Chế độ:** Đội đối kháng 5v5 (tới 40) · Chiếm điểm A/B/C (tới 200) · Sinh tồn cá nhân 7 bot (tới 15).
**Điều khiển PC:** WASD · chuột · chuột phải ngắm · R nạp · Space nhảy · C ngồi · 1/2/3 đổi súng · G lựu đạn · V đổi góc nhìn · Q quét (ABILITY) · E hologram · T emote · X ra lệnh (COMMAND) · Esc tạm dừng.
**Điều khiển điện thoại:** cần analog trái, kéo vùng phải để xoay, nút bắn (kéo để vừa bắn vừa xoay), ngắm, nhảy, ngồi, nạp, đổi súng, lựu đạn, 4 kỹ năng bên trái.
**Model:** `dist/model-lab.html` xem model theo mét thật và xuất GLB/OBJ; `models/` có sẵn GLB/OBJ (mở bằng Blender: File → Import).
Xem `docs/` cho phân tích v4 và kiến trúc. Bản cũ: `legacy_v4/`.

## Chạy trên GitHub Pages (cả game lẫn model)
1. Tạo repo Public, upload TOÀN BỘ thư mục này (hoặc `git push`).
2. **Settings → Pages → Source = GitHub Actions** (workflow `.github/workflows/pages.yml` tự build và đăng).
   Cách nhanh không cần Actions: Source = *Deploy from a branch* → `main` / `(root)` — vì `index.html` và `model-lab.html` đã build sẵn ở thư mục gốc.
3. Mở `https://<user>.github.io/<repo>/` (game) · `.../model-lab.html` (xem/xuất model) · `.../models/AK12.glb` (tải model GLB/OBJ: AK12, MP7, G17, linh_xanh, linh_do).
Mọi thứ dùng đường dẫn tương đối, three.js đã nằm trong `vendor/` nên không phụ thuộc CDN.

## Cửa hàng & quảng cáo (Google AdSense H5 Games Ads)
* Lobby → **CỬA HÀNG**: xem quảng cáo nhận thưởng để mở súng (SG-12: 2 lượt, SR-7: 3 lượt) và trang phục (Sa mạc 1, Rừng 1, Đêm 2). Tiến độ lưu trong localStorage.
* Mặc định chưa có ID AdSense nên game dùng **quảng cáo mô phỏng 5 giây** để thử luồng nhận thưởng.
* Để chạy quảng cáo thật: đăng ký AdSense, bật *H5 Games Ads* cho đúng tên miền của game, rồi điền `publisherId: 'ca-pub-…'` trong `src/config.js` (giữ `testMode: true` khi thử, đổi `false` khi chạy thật) và build lại: `node build.mjs`.
* Code: `src/ads.js` (Ad Placement API: `adConfig`, `adBreak` loại `reward` và `next`), `src/shop.js` (kho đồ, giao diện).
