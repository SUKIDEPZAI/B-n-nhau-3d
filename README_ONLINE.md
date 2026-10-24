# Dragon anrena — Online (Colyseus) · hướng dẫn chạy / deploy / test

> **Trạng thái trung thực:** phần mô phỏng server (`server/sim.js`), API hồ sơ (`server/routes.js`), JWT, và adapter client (`src/net/online.js`) đã được chạy thử bằng `node --test` (16 test pass, gồm loopback client↔server).
> **Chưa chạy thử:** `server/rooms/ArenaRoom.js` + `server/index.js` (cần `npm install colyseus` — sandbox build không cài được), SDK `colyseus.js` tải từ CDN, kết nối thật từ trình duyệt, Render/PostgreSQL, và API `https://tool-online.onrender.com/api` của nền tảng. Hãy chạy các bước test bên dưới trước khi công bố.

> **Chạy trên FalixNodes:** xem `README_FALIX.md` (gói sẵn bằng `npm run build:falix`).

## Kiến trúc
```
Browser (GitHub Pages)                    Game server (Render / VPS)
 main.js ──hooks──> src/net/online.js      server/index.js  (http + WebSocket cùng 1 cổng)
 src/net/realtime.js (Colyseus client) ──ws──> server/rooms/ArenaRoom.js ─> server/sim.js (authoritative)
 src/net/platform.js ──https──────────────> server/routes.js  /api/auth/guest, /api/profile ─> store (Postgres | memory)
```
- Client chỉ gửi **ý định**: `in` {s,mx,mz,yaw,pitch,j,c,a} ≤ 20 Hz, `fire` {dx,dy,dz}, `reload`, `weapon`.
- Server tự mô phỏng 20 Hz bằng chính `stepMove`/`WEAPONS`/`rayUnit` của game: vị trí, đạn, tốc độ bắn, sát thương, hạ gục, hồi sinh, điểm, kết thúc trận. Client **không** gửi được HP/điểm/hit.
- Client dự đoán di chuyển bằng cùng `stepMove`, đối chiếu snapshot (bỏ qua lệch < 0,35 m, kéo dần nếu lệch, snap nếu > 3 m); người khác nội suy trễ 110 ms.
- Định danh: token HS256 do **server** ký (`POST /api/auth/guest`). Public app key không phải danh tính người chơi và không được dùng để xác thực.
- Hồ sơ: `GET/PUT /api/profile` theo `userId` trong token; thống kê (`stats`) chỉ server ghi; body ≤ 4 KB; rate limit theo IP.
- Không có secret trong frontend. `src/net/config.js` chỉ chứa giá trị công khai.

## Biến môi trường (chỉ đặt ở server — Render Dashboard › Environment)
| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `JWT_SECRET` | có (≥ 24 ký tự) | khoá ký token; server từ chối chạy nếu thiếu |
| `DATABASE_URL` | không | Postgres của Render. Trống = lưu RAM (mất khi restart) |
| `PGSSL` | không | `disable` khi Postgres local không có TLS |
| `ALLOWED_ORIGINS` | nên đặt | ví dụ `https://sukidepzai.github.io` (CORS + kiểm tra Origin của WebSocket) |
| `ALLOW_ANON` | không | `1` chỉ để test local không cần token |
| `PORT` | không | mặc định 2567 (Render tự cấp) |

Migration: `server/migrations/001_init.sql` (bảng `profiles`) — chạy tay một lần: `psql "$DATABASE_URL" -f server/migrations/001_init.sql` (`store.js` KHÔNG tự tạo bảng; thiếu bước này thì lưu hồ sơ trên Postgres sẽ lỗi).

## Chạy local
```bash
npm install
cp .env.example .env            # rồi sửa JWT_SECRET (không commit .env)
JWT_SECRET=$(openssl rand -hex 24) ALLOW_ANON=0 ALLOWED_ORIGINS=http://localhost:8080 npm run server
npm run build && npx http-server dist -p 8080     # hoặc mở bằng server tĩnh bất kỳ
# mở http://localhost:8080/field-force-3d.html?server=http://localhost:2567
```
## Deploy
1. Render › New › Blueprint, trỏ vào repo (dùng `render.yaml`); đặt `DATABASE_URL`, `ALLOWED_ORIGINS`.
2. Chạy migration (xem trên).
3. Đặt `serverUrl` trong `src/net/config.js` thành URL Render (`https://….onrender.com`), `npm run build`, copy `dist/field-force-3d.html` thành `index.html`, push lên GitHub Pages.
4. Gói Free của Render ngủ sau ~15 phút: lần kết nối đầu có thể chậm 30–60 s (UI hiển thị "Đang kết nối…").

## Test thủ công (2 client)
1. `npm run test:server` — phải thấy 16 pass.
2. Mở 2 cửa sổ trình duyệt (một ẩn danh) với `?server=…`. Cửa sổ A: **Tạo phòng** → ghi mã phòng. Cửa sổ B: nhập mã → **Vào phòng**.
3. **Join/leave:** A thấy B xuất hiện + thông báo; đóng B → A thấy "đã rời phòng".
4. **Đồng bộ di chuyển/bắn:** đi, nhảy, ngồi ở A, B phải thấy mượt; bắn trúng → hit marker, kill feed, bảng điểm cuối trận (15 hạ gục hoặc 6 phút).
5. **Latency:** thanh trên cùng hiển thị `Online · xx ms`. Giả lập mạng chậm bằng DevTools › Network › Slow 3G hoặc `clumsy`; nhân vật của bạn không được giật lùi liên tục.
6. **Reconnect:** DevTools › Network › Offline 5 giây rồi Online → banner vàng "đang kết nối lại", sau đó trở lại cùng nhân vật (cửa sổ cho phép 20 s).
7. **Server restart:** dừng/khởi động lại server → client báo "Không thể kết nối lại…", về menu, vào phòng mới được.
8. **Room-full:** mở 9 client vào cùng phòng → client thứ 9 báo "Phòng đã đầy".
9. **Save/load hồ sơ:** nhập tên, vào online, ra menu (lưu tự động), xoá `localStorage` rồi vào lại: `GET /api/profile` (kèm token) trả đúng tên. Kiểm tra bảo mật: `curl -X PUT …/api/profile` không token → 401; gửi `stats` → bị bỏ qua.

## Chưa triển khai / hạn chế (nói thẳng)
- `ArenaRoom`/`index.js`/SDK CDN chưa chạy thật (xem đầu file). Đặt mã phòng ngắn bằng `this.roomId = …` trong `onCreate` dựa theo hành vi Colyseus 0.15 — nếu bản bạn cài không cho phép, sẽ dùng id mặc định (mã dài hơn, `joinById` vẫn đúng).
- Online chỉ có **sinh tồn cá nhân** (FFA, tối đa 8 người, không bot). Chưa đồng bộ: lựu đạn, hologram, quét/ra lệnh, vật phẩm nhặt, súng shotgun/sniper (server whitelist `ak12`, `mp7`, `pistol`), trang phục của người khác.
- Trang phục/súng mua bằng quảng cáo là dữ liệu trong trình duyệt; server **không** kiểm chứng quyền sở hữu (chưa có entitlement phía server nên online bị giới hạn theo whitelist).
- `pg` chưa chạy thử với Postgres thật.
- Kết quả trận chưa cộng vào `stats` trên server (`store.addResult` đã có nhưng chưa nối vào room).
- Tạm dừng (Esc) khi online không dừng thế giới; nhân vật vẫn bị tấn công.
- API nền tảng `tool-online.onrender.com/api` **không được gọi**: endpoint/header của public app key chưa được xác minh nên không tự bịa. Auth hiện là token khách do server của bạn ký; muốn dùng auth nền tảng, thay `platform.login()` và `onAuth()` theo tài liệu của nền tảng.
- Chưa có chống gian lận nâng cao (aimbot), chưa đo tải nhiều phòng.
