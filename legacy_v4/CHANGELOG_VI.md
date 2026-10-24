# Nhật ký sửa lỗi — Field Force 3D Tactical

## Bản sửa lỗi logic và gameplay

- Sửa vị trí các điểm nhặt shotgun, sniper và pistol bị đặt trong vùng va chạm của tòa nhà.
- Chế độ không đội phân bố bot trên toàn bản đồ thay vì dồn ở khu vực spawn phía đỏ.
- Chế độ đấu đội: bot phe xanh và phe đỏ có thể tìm, nhắm bắn và hạ bot phe đối địch; phe đỏ vẫn có thể tấn công người chơi.
- Chế độ không đội: bot có thể giao chiến với bot khác và người chơi.
- Đạn của bot lưu mục tiêu cụ thể; hạ bot bởi bot khác không bị tính nhầm vào số mạng hạ gục của người chơi.
- Tăng mật độ kiểm tra đường đạn để hạn chế đạn xuyên qua vật cản mỏng do bỏ sót bước kiểm tra.
- Sửa nạp đạn để hoàn tất cho đúng khẩu súng bắt đầu nạp, kể cả khi người chơi đổi súng giữa chừng.
- Tăng số lần tìm vị trí spawn/vật phẩm hợp lệ; thêm quét dự phòng thay vì luôn trả về tâm bản đồ.
- Reset trạng thái phím, bắn, nạp đạn và thời gian bất tử khi bắt đầu trận mới.

## Kiểm tra đã thực hiện

- `node --check` trên JavaScript nhúng: đạt.
- Kiểm tra HTML: không có ID trùng lặp; không có ID bị thiếu trong các bộ chọn `querySelector('#...')` được kiểm tra.
- Kiểm tra ZIP: thực hiện sau khi đóng gói.
- Chưa xác nhận kiểm thử đồ họa trực tiếp: Chromium trong môi trường kiểm tra không khởi tạo được WebGL/EGL, nên cần mở game trên Chrome/Edge có tăng tốc đồ họa để kiểm thử trực quan.

## 2026-10-15 — Cải tiến góc nhìn thứ nhất và chuyển động súng
- Thay mô hình súng FPS cố định bằng mô hình vũ khí riêng cho AK-47, Uzi, shotgun, sniper, pistol và dao, có thêm cẳng tay/bàn tay.
- Gắn mô hình súng theo hệ trục camera: X (ngang), Y (lên/xuống), Z (hướng ngắm); súng xoay theo góc nhìn ngang và dọc.
- Thêm độ nghiêng nhẹ khi lia chuột, nhún súng khi di chuyển, độ giật khi bắn và hạ súng khi nạp đạn.
- Mô hình vũ khí FPS được vẽ như lớp gần camera để giảm hiện tượng bị địa hình che khuất.
- Kiểm tra cú pháp JavaScript bằng Node.js: đạt. Chưa kiểm thử hình ảnh bằng trình duyệt WebGL trong môi trường này.


## Sửa tâm ngắm và đường đạn (15/10/2026)
- Đạn người chơi bay theo chính xác hướng ngắm ngang ở tâm màn hình, bỏ độ lệch ngẫu nhiên khiến đạn lệch tâm.
- Nâng đường đạn hiển thị từ độ cao 33 lên 43 đơn vị để vệt đạn dễ căn với tâm ngắm hơn.
- Đạn bot cũng hiển thị ở cùng độ cao; logic sát thương và va chạm vẫn dùng tọa độ chiến trường.


## 2026-10-16 — Nâng cấp mô hình súng, giao diện và cảm ứng
- Dựng lại mô hình súng FPS cho AK-47, Uzi, shotgun, sniper, pistol và dao với nhiều lớp hình học hơn: receiver, nòng và đầu nòng, tay cầm, báng, băng đạn, thước ngắm, ống ngắm và chi tiết vật liệu.
- Bổ sung trụ hình học theo trục Z trong `MeshBuilder` để dựng nòng súng và phụ kiện dạng ống; giữ nguyên các trụ theo trục X/Y đang dùng trong game.
- Làm lại mô hình vũ khí nhặt trên bản đồ với silhouette riêng và chi tiết dễ phân biệt hơn.
- Thiết kế lại HUD, nút cảm ứng và phản hồi trạng thái: nền kính tối, viền sáng, trạng thái nhấn/chọn và bố cục thích ứng màn hình nhỏ.
- Bỏ joystick ngắm bên phải; người chơi cảm ứng xoay camera bằng cách vuốt trực tiếp vùng trống trên màn hình. Vẫn giữ joystick trái để di chuyển và nút riêng để bắn.
- Thêm cụm nút chọn nhanh sáu vũ khí ở màn hình cảm ứng và làm nổi bật vũ khí đang chọn.
- Sắp xếp lại nhóm NẠP ĐẠN / HỒI MÁU / NHẶT, nút đổi FPS/TPP và nút BẮN; thêm bố cục riêng cho điện thoại màn hình ngang thấp.
- Đồng bộ lại nhãn đổi góc nhìn và trạng thái nút chọn súng khi bắt đầu trận mới.
- Cập nhật hướng dẫn chơi tiếng Việt.

### Kiểm tra bản nâng cấp giao diện/vũ khí
- `node --check` trên JavaScript nhúng: đạt sau khi sửa.
- Kiểm tra HTML bằng parser: không phát hiện ID trùng; điều khiển aim-stick cũ đã được loại khỏi markup.
- Đã thử khởi chạy Chromium headless để chụp ảnh, nhưng môi trường này không khởi tạo được EGL/WebGL và tiến trình bị treo; do đó chưa xác nhận hình ảnh render hoặc thao tác đa điểm trên thiết bị thật.


## 2026-10-17 — Village Operations v4: tái cấu trúc làng, HUD và hiệu năng
- Dùng bố cục làng cũ làm chủ đạo: trục đường lát đá, quảng trường giao lộ, các dãy nhà sơn màu xanh/kem/đất nung, mái ngói dốc, cửa chớp, ban công, cửa hàng, nhà thờ tháp chuông và đồ vật đường phố.
- Bổ sung giếng đá, xe kéo gỗ, biển chỉ đường, bồn cây, ghế, thùng gỗ, quầy hàng, cypress/hàng rào cây và các chi tiết nền; loại bỏ vạch tim đường kiểu xa lộ còn sót lại.
- Dựng toàn bộ kiến trúc và props thành các mesh tĩnh ghép lô để giảm số lượt gọi vẽ; bot ở xa dùng mesh LOD gộp và ẩn thanh máu nhỏ ở khoảng cách xa.
- Dùng lưới không gian cho va chạm, A* cho tuyến đi vòng vật cản và giữ dự phòng di chuyển khi không tìm được đường. A* có kiểm thử vượt chướng ngại vật nhân tạo.
- Tinh chỉnh bố cục HUD cho điện thoại ngang/dọc, safe-area và nút hành động tròn; joystick trái di chuyển, vuốt vùng trống để xoay camera, nút bắn độc lập và khay sáu vũ khí. Sửa selector joystick dọc bị tham chiếu nhầm ID.
- Sửa điều khiển chuột PC để thay đổi cả góc ngang và góc ngẩng camera.
- Điều chỉnh model lính low-detail cho bot ở xa.
- Giữ kiến trúc HTML/CSS/JavaScript thuần và không thêm dịch vụ/API ngoài.

### Kiểm tra tĩnh cho bản Village Operations v4
- `node --check` trên JavaScript nhúng: đạt.
- Parser HTML: không có ID trùng lặp. ID `aiReport` được tạo động khi lập báo cáo AI nên không xuất hiện trong HTML ban đầu.
- Parser CSS: không báo lỗi cú pháp.
- Kiểm thử A*: tìm được đường vòng quanh vách chặn giả lập.
- Kiểm thử tạo bản đồ: 68 vật cản, 159 props trang trí, 31 điểm/vật phẩm và ba cứ điểm A/B/C trong smoke test. Đây là số từ bài kiểm tra dựng bản đồ hiện tại, không phải số tam giác hay đo hiệu năng.
- Chưa kiểm thử render WebGL hoặc thao tác đa điểm trên Android/PC thật trong môi trường này; cần nghiệm thu trực quan ngoài môi trường hiện tại.
