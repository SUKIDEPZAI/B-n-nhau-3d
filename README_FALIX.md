# Chạy server online trên FalixNodes (client.falixnodes.net)

Thông tin dưới đây lấy từ hướng dẫn chính thức của Falix ([Node.js](https://client.falixnodes.net/guides/languages/nodejs), [WebSockets](https://client.falixnodes.net/guides/web-apps/websockets), [How app hosting works](https://client.falixnodes.net/guides/start/how-app-hosting-works)). Mình **chưa** chạy thử trên Falix thật.

## Falix yêu cầu gì → server đã làm gì
| Falix | Server |
|---|---|
| Chạy `node index.js` trong `/home/container` | `falix/index.js` là 1 file đã gói sẵn (kèm three.js) |
| Cổng đọc từ `SERVER_PORT`, bind `0.0.0.0` | đúng như vậy (`PORT` chỉ là dự phòng) |
| Console phải có chữ "Listening" | in `Listening on 0.0.0.0:<port> …` |
| `npm install` tự chạy từ `package.json` | `falix/package.json` chỉ có `colyseus`, `@colyseus/ws-transport`, `pg` |
| Biến môi trường: không có hướng dẫn chung | đọc file `.env` ở thư mục gốc (không ghi đè biến thật) |
| Trang https không được mở `ws://` | server tự phục vụ game ở `/` (cùng nguồn, dùng `ws://` thoải mái) |
| Proxy có thể đóng kết nối rảnh | ping WebSocket mỗi 10 s + client tự reconnect 20 s |

## Cài đặt (File Manager hoặc SFTP, đều vào `/home/container`)
1. Trên máy bạn: `npm run build && cp dist/field-force-3d.html index.html && npm run build:falix` (hoặc dùng sẵn thư mục `falix/` trong zip).
2. Tạo server Falix loại **Node.js**, Settings → chọn Node **20 trở lên** (Main file để mặc định `index.js`).
3. Upload **nội dung** thư mục `falix/` (không phải chính thư mục): `index.js`, `package.json`, `public/index.html`, `001_init.sql`.
4. Tạo file `.env` (đổi tên từ `env.example`), điền `JWT_SECRET` (chuỗi ngẫu nhiên ≥ 32 ký tự). Không có `JWT_SECRET` thì server từ chối chạy.
5. Bấm **Start**. Lần đầu sẽ `npm install` (mất một lúc). Thấy `Listening on 0.0.0.0:…` là xong.
6. Vào trang **Network** lấy địa chỉ `IP:PORT`, mở `http://IP:PORT/` trên trình duyệt để chơi. Gửi link này cho bạn bè.
7. Kiểm tra: `http://IP:PORT/health` phải trả `{"ok":true,…}`.

## Lưu hồ sơ
- Mặc định: file `data/profiles.json` trên Falix (không cần database). Cẩn thận: cài lại/đổi ứng dụng có thể xoá file.
- Dùng PostgreSQL của Falix (trang **Databases**): điền `DATABASE_URL=postgres://…` vào `.env`, thêm `PGSSL=disable`, chạy `001_init.sql` bằng công cụ database của Falix một lần. Chưa thử với Postgres thật.

## Chơi từ GitHub Pages (https) thì sao?
Trình duyệt chặn `ws://`/`http://` từ trang `https://`. Hai cách:
- **Khuyên dùng:** chơi trực tiếp từ link Falix `http://IP:PORT/` (không cần cấu hình gì).
- Hoặc gắn tên miền + HTTPS qua Reverse Proxy của Falix (trang Network/Domains), rồi: điền `https://tên-miền` vào `serverUrl` trong `src/net/config.js` (hoặc mở `…github.io/…/?server=https://tên-miền`), build lại, và đặt `ALLOWED_ORIGINS=https://sukidepzai.github.io` trong `.env`.

## Giới hạn / chưa kiểm chứng
- Chưa chạy trên Falix; chưa chạy `colyseus` thật (Room/WebSocket/reconnect). Đã test: bundle khởi động với Colyseus giả lập, `.env`, cổng `SERVER_PORT`, phục vụ game, API, file store, từ chối khởi động khi thiếu `JWT_SECRET`.
- Gói miễn phí Falix có đồng hồ phiên: hết giờ thì server dừng (cộng thêm giờ ở trang Timer) và RAM/CPU có hạn — giữ phòng nhỏ (tối đa 8 người/phòng).
- Cách Colyseus 0.15 chia sẻ một cổng giữa HTTP routes và matchmaking dựa vào tài liệu; nếu `/matchmake` bị 404 hãy gửi log để chỉnh.
