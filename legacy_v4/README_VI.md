# Field Force 3D Tactical — Village Operations

Game bắn súng chiến thuật 3D chạy trên HTML/CSS/JavaScript thuần và WebGL 2. Không cần npm hoặc bước build. Bản này tập trung vào bản đồ làng, HUD cảm ứng và tối ưu dựng cảnh.

## Chạy game
1. Giải nén ZIP, giữ nguyên thư mục `assets`.
2. Mở `Field_Force_3D_Tactical/index.html` bằng Chrome hoặc Edge hiện đại có hỗ trợ WebGL 2 và tăng tốc đồ họa.
3. Chọn Đấu đội hoặc Không đội, sau đó bấm bắt đầu.
4. Nếu trình duyệt chặn mở file trực tiếp hoặc không khởi tạo WebGL, hãy chạy bằng máy chủ tĩnh/localhost. Game không cần API bên ngoài.

## Điều khiển PC
- `W A S D` hoặc phím mũi tên: di chuyển.
- Chuột: xoay camera/ngắm ngang và dọc; giữ chuột trái để bắn. Nhấp vào vùng game để khóa con trỏ nếu trình duyệt cho phép.
- `1` đến `6`: AK-47, Uzi, dao, shotgun, sniper, pistol.
- `R`: nạp đạn; `H`: hồi máu; `F`: nhặt vật phẩm; `V`: chuyển FPS/TPP.
- `Space`: nhảy; `Ctrl`: ngồi thấp; `Q`: ngắm.

## Điều khiển Android / cảm ứng
- Giữ và kéo joystick tròn góc trái để di chuyển.
- Vuốt trực tiếp vùng trống bên phải/trung tâm để xoay camera, thay đổi góc ngắm lên/xuống. Không cần joystick ngắm thứ hai.
- Giữ nút BẮN hình tròn để bắn liên tục.
- Các nút tròn riêng cho ngắm, nhảy, ngồi thấp, nạp đạn, hồi máu và nhặt đồ được bố trí quanh vùng ngón cái.
- Cụm sáu vũ khí nằm cạnh đáy màn hình ở chế độ ngang; xếp 3×2 khi màn hình dọc. HUD tận dụng `safe-area-inset-*` để tránh vùng khuyết/notch.
- Có thể thử xoay ngang trước khi vào trận; trình duyệt có thể từ chối khóa hướng/mở toàn màn hình tùy quyền của Android.

## Gameplay
- Đấu đội: người chơi + 9 bot phe xanh đấu với 10 bot phe đỏ.
- Không đội: người chơi đối đầu 19 bot.
- Ba cứ điểm A/B/C, vé đội, súng, vật phẩm, cứu thương và AI cục bộ lưu học qua trận.
- Bot có pathfinding A* trên lưới để đi vòng nhà/hàng rào; các bot ở xa sử dụng mesh mức chi tiết thấp hơn.
- Game offline với bot, chưa có multiplayer trực tuyến.

## Tài liệu kỹ thuật
- `CODE_AUDIT_VI.md`: kiểm tra kiến trúc, từng nhóm dòng/hàm, vấn đề còn tồn tại, kết quả kiểm thử và hướng phát triển.
- `CHANGELOG_VI.md`: nhật ký thay đổi theo phiên bản.

## Giới hạn đã biết
- Đồ họa là low-poly dựng bằng `MeshBuilder` tự viết, chưa phải vật liệu PBR/photogrammetry. OBJ/PNG đi kèm trong `assets` được giữ lại; runtime hiện dựng phần lớn cảnh/súng bằng hình học thủ tục.
- Các viên đạn và va chạm nhân vật chủ yếu tính trên mặt phẳng X/Z của chiến trường; góc pitch điều khiển camera nhưng chưa phải mô phỏng đạn 3D có trọng lực đầy đủ.
- AI là luật + thống kê/bandit, không phải mô hình học sâu. Một phần AI còn được nối qua wrapper trong cùng script, cần refactor từng bước.
- Không thể xác nhận FPS hoặc ảnh render trên thiết bị thật chỉ bằng kiểm tra cú pháp; hãy thử trên Chrome/Edge hỗ trợ WebGL 2 và ghi lại thiết bị/FPS khi nghiệm thu.
