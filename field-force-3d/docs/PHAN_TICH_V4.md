# Phân tích mã nguồn bản v4 (2D, 1 file index.html) và cách bản 5.0 xử lý

| # | Phát hiện trong v4 | Hậu quả | Bản 5.0 |
|---|---|---|---|
| 1 | Toàn bộ logic nằm trong 1 file, đạn/va chạm chỉ 2D | Không thể có độ cao, mái nhà, nhảy, đạn xuyên cửa sổ | Thế giới 3D thật: AABB 3D + lưới không gian 4 m (`core/phys.js`), tia bắn 3D |
| 2 | Đơn vị tuỳ ý (pixel) | Không thể làm đúng tỉ lệ 1:1 | **1 đơn vị = 1 mét**: lính 1,80 m, AK-12 0,95 m, cửa 2,1 m, bậc thang 0,17 m |
| 3 | Cấp phát mảng/đối tượng mỗi khung (`.map/.filter`, `{}` trong vòng lặp) | GC giật hình trên điện thoại | Vật thể dùng chung (`_tmp`), pool hạt/vệt đạn, không cấp phát trong vòng lặp nóng |
| 4 | Bot tìm kẻ địch O(N²) mỗi khung, chạy A* mỗi khung | Tụt FPS khi đông bot | Cảm nhận mỗi 0,18–0,28 s (so le), hàng đợi A* 1 đường/khung, lưới 1 m + làm mượt |
| 5 | AI nhiều lớp wrapper chồng nhau | Khó sửa hành vi | `Bot.update` một chỗ: sense → fight/hunt/patrol |
| 6 | Không hồi sinh, không chế độ | Hết người là hết game | Hồi sinh, 3 chế độ (TDM / Chiếm điểm / Sinh tồn), kết thúc + chơi lại |
| 7 | localStorage không có phiên bản schema | Dữ liệu cũ làm hỏng bản mới | Chỉ lưu 2 khoá đơn giản (chế độ, chất lượng), bọc try/catch |
| 8 | Logic reset lặp ở nhiều nơi | Lỗi trạng thái cũ còn sót | `startMatch()` là điểm khởi tạo duy nhất |
| 9 | Texture/hình vẽ canvas tạo lại mỗi khung | Tốn CPU | Texture tạo 1 lần, hình khối **gộp theo vật liệu** (`GeoBuilder`): cả làng ≈ 130k tam giác trong ~20 draw call |

# Hiệu năng bản 5.0
* Cả khung hình ≈ **98 draw call** (kể cả bóng + 10 lính + hiệu ứng), 1 draw call/lính (SkinnedMesh 13 xương).
* **Độ phân giải động**: đo thời gian khung (EMA); > 22 ms giảm tỉ lệ vẽ 10 %, < 14,5 ms tăng lại (0,6–1,0).
* 3 mức đồ hoạ (thấp: Lambert, không bóng; vừa; cao: PBR + bóng 2048). Tự chọn: cảm ứng = vừa, máy tính = cao.
* Bóng mặt trời bám theo người chơi, làm tròn theo texel (không rung); minimap vẽ mỗi 2 khung.
* Mô phỏng 4000 bước (200 s game, 10 người) chạy ~2,5 s CPU trong trình duyệt headless.
