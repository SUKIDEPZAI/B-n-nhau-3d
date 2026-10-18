# Field Force 3D Tactical — Báo cáo phân tích mã nguồn chuyên sâu

**Bản:** Village Operations v4 · **Ngày:** 17/10/2026  
**Nền tảng được giữ nguyên:** HTML + CSS + JavaScript thuần, WebGL 2, không cần npm/build step.  
**Phạm vi:** `index.html`, tài nguyên hiện có, điều khiển PC/Android, bản đồ, renderer, va chạm, AI, kiểm thử tĩnh.  

> Lưu ý về cách đọc mã: `index.html` có 756 dòng vật lý nhưng nhiều hàm JavaScript được nén thành một dòng rất dài. Vì vậy, báo cáo đi qua toàn bộ vùng mã bằng số dòng và tên hàm/chức năng thay vì giả vờ rằng mỗi câu lệnh nằm trên dòng riêng. Những kết quả ghi dưới đây phân biệt rõ kiểm tra tĩnh/logic cô lập với kiểm thử đồ họa thật.

## 1. Kết luận kiến trúc

Dự án là một game bắn súng 3D góc nhìn thứ ba/thứ nhất dùng WebGL 2 tự dựng. Cảnh, súng và binh sĩ phần lớn được dựng bằng `MeshBuilder`; cảnh tĩnh được ghép thành mesh lớn, trong khi bot/vật thể động có mesh riêng. Bản đồ mới hướng tới khu làng cổ: đường đá không kẻ vạch xa lộ, cụm nhà xanh/kem/đất nung hai tầng, mái ngói dốc, cửa chớp, ban công, cửa hàng, nhà thờ có tháp chuông, cây/hàng rào/ghế/giếng/xe kéo/quầy hàng.

### Đã có trong mã hiện tại

- WebGL 2 và shader màu đỉnh với ánh sáng đơn giản, sương theo khoảng cách.
- Camera FPS/TPP, góc ngắm ngang/dọc, súng FPS, bắn/nạp/đạn/cứu thương/nhặt vật phẩm.
- Bản đồ khoảng 3000 × 2200 đơn vị, ba cứ điểm A/B/C, 19 bot, hai chế độ.
- Spatial grid cho truy vấn vật cản, A* trên lưới nav 90 đơn vị và di chuyển dự phòng khi không tìm được đường.
- Mesh tĩnh/props được batch; bot ở xa dùng mesh LOD gộp; bộ render hạ độ phân giải trên thiết bị cảm ứng khi FPS thấp.
- HUD desktop, radar, các nút cảm ứng tròn, khay đổi súng, safe area và điều khiển vuốt trực tiếp để xoay camera.

### Những điều chưa thể kết luận chỉ qua mã

Không có benchmark FPS đáng tin cậy nếu chưa chạy trên thiết bị mục tiêu. Môi trường kiểm tra đã chặn khởi chạy trình duyệt/WebGL để chụp ảnh trực tiếp, nên báo cáo không đánh dấu “đã xác nhận hình ảnh thực tế”. Kiểm tra cú pháp đúng không chứng minh việc dựng hình, shader, tương tác đa điểm hoặc cân bằng trận đã hoàn toàn đúng.

## 2. Bản đồ phạm vi theo dòng/hàm

### Dòng 1–8 — Khung HTML và cấu hình trình duyệt

- `lang="vi"`, UTF-8, `viewport-fit=cover`, `theme-color` và màu tối cho trải nghiệm mobile.
- Canvas game là bề mặt WebGL. `viewport-fit=cover` cần đi cùng safe-area inset trong CSS để các nút không nằm dưới vùng khuyết; mục đích tương ứng với hướng dẫn MDN về `safe-area-inset-*`.
- Tên trang phản ánh bản `Village Operations 3D`.

### Dòng 9–27 — CSS cơ sở và điều khiển

- Khai báo bảng màu xanh ô-liu, vàng nhạt, xanh dương/đỏ cho HUD.
- `html/body` khóa cuộn và hành vi kéo trang; `canvas#game` dùng `touch-action:none` để thao tác vuốt không biến thành cuộn trang.
- `.panel`, thanh máu/đạn, vé đội, mục tiêu, minimap, crosshair, toast và menu được đặt bằng overlay.
- `.stick`, `.ring`, `.knob` mô tả joystick tròn; `.touchBtn` là nút hành động; `#fireBtn` là nút bắn giữ liên tục.
- Các breakpoint cũ vẫn còn bên dưới các lớp nâng cấp sau. CSS được ghi đè theo thứ tự, vì vậy khi thêm breakpoint mới cần kiểm tra quy tắc cuối cùng chứ không chỉ xem selector đầu tiên.

### Dòng 28–64 — Menu và chọn chế độ

- Menu toàn màn hình có vùng mô tả, nhân vật minh họa, nút chọn chế độ và nút bắt đầu.
- Các breakpoint thu gọn menu trên màn hình nhỏ.
- Mã chọn mode cập nhật mô tả bằng tiếng Việt; nút bắt đầu dựng lại trận và reset trạng thái chiến đấu.

### Dòng 65–103 — Lớp UI cải tiến ban đầu

- Tinh chỉnh HUD, icon/nút, kích cỡ khay vũ khí, focus outline.
- Có breakpoint màn hình rộng, mobile ngang, mobile dọc và màn hình thấp.
- Đây là lớp lịch sử; một vài quy tắc sau này đã được ghi đè bởi V4/V5/V6. Không nên xóa hàng loạt chỉ dựa trên việc trùng selector vì một số quy tắc cũ vẫn là fallback khi điều kiện media khác nhau.

### Dòng 106–184 — Lớp V4: ergonomics và hệ thống điều khiển

- Chuyển vùng hành động thành các nút tròn tuyệt đối quanh vùng ngón cái.
- Khay vũ khí dùng `repeat(6, ...)` ở landscape và 3×2 ở portrait.
- Các nút có vùng tương tác riêng, `pointer-events` và `touch-action` được tách khỏi vùng vuốt camera.
- `env(safe-area-inset-bottom/right)` giúp tránh che bởi mép màn hình/notch trên trình duyệt tương thích.

### Dòng 187–232 — Lớp V5: HUD cảm ứng kiểu tactical

- Viền HUD, màu nền bán trong suốt và phản hồi active/selected được tinh chỉnh.
- Nút nạp/hồi/nhặt/ngắm/nhảy/ngồi thấp có hình tròn, khác biệt kích thước theo vai trò.
- Đây là cảm hứng bố cục từ game bắn súng mobile nói chung; không sao chép ảnh/asset của game bên ngoài.

### Dòng 235–291 — Lớp V6 cuối cùng cho landscape/portrait

- Đây là lớp CSS cuối cùng có ưu tiên theo `pointer:coarse` và hướng màn hình, quyết định phần lớn layout trên Android.
- Landscape: minimap và trạng thái ở góc trái, điểm/vé ở trên giữa, dữ liệu vũ khí góc phải, joystick ở dưới trái, BẮN tròn dưới phải, sáu vũ khí ở gần giữa đáy và nhóm hành động bố trí tách nhau.
- Portrait: HUD gọn lại, khay súng 3×2, các nút tròn nằm quanh vùng bên phải.
- Đã sửa selector joystick portrait từng tham chiếu `#stick.left` không tồn tại thành `#moveStick.stick.left`.
- Safe area được áp dụng ở cạnh dưới. Cần kiểm thử trên điện thoại cụ thể vì tỉ lệ 16:9, 20:9 và màn hình ngắn có thể làm vị trí nút khác nhau.

### Dòng 292–315 — Markup HUD

- `#game` là canvas WebGL; `#hud` chứa máu, vé, số mạng, thông tin vũ khí và đạn.
- `#tickets` thể hiện điểm hai đội và thời gian; `#objectives` được tạo động; `#miniMap` là canvas 2D riêng.
- `#mobile` có joystick, gợi ý vuốt, nút tròn `data-action`, khay vũ khí và nút đổi FPS/TPP.
- Nút dùng `data-action` để tái sử dụng `handleKey()` cho input cảm ứng. Vì vậy thay đổi tên action ở HTML phải đi cùng logic bàn phím/điều khiển.

### Dòng 316–328 — Khởi tạo game, shader và trạng thái toàn cục

- IIFE (`(()=>{'use strict'; ... })()`) giữ các biến trong phạm vi riêng và tránh làm bẩn `window`.
- WebGL 2 được yêu cầu rõ ràng; nếu không có context, menu báo trình duyệt chưa sẵn sàng rồi dừng. Đây là graceful failure cơ bản nhưng không bao gồm fallback 2D.
- Shader đỉnh truyền vị trí, pháp tuyến, màu và khoảng cách camera; shader mảnh tính ánh sáng khuếch tán, ambience, AO giả lập, grain nhỏ và fog.
- `WORLD`, `rand`, `pick`, `clamp`, `dist`, `C` là tiện ích gameplay/toạ độ/màu.
- Trạng thái người chơi chứa vị trí X/Z (trong mã 2D được biểu diễn bằng `x/y`), máu, súng, đạn dự trữ, cứu thương, reload và bất tử ngắn sau sát thương.

### Dòng 329–340 — Compile shader, resize và input PC

- `shader()` biên dịch shader và ném lỗi log nếu compile thất bại; chương trình được link trước khi bắt đầu vòng lặp.
- `resize()` tính DPR, kích thước canvas và viewport. Trên pointer coarse DPR được giới hạn thấp hơn để hạn chế tải GPU.
- Các hàm vector/ma trận tự viết cung cấp `lookAt`, phối cảnh, phép nhân ma trận và model matrix.
- Input bàn phím ghi trạng thái phím xuống/lên; blur/tab ẩn reset phím và trạng thái bắn để tránh phím/nút bị kẹt.
- Đã sửa `mousemove` trên PC để thay đổi góc camera cả theo `movementX` lẫn `movementY` khi pointer lock; kéo chuột không khóa cũng cập nhật cả ngang/dọc.
- Lưu ý: pitch mới thay đổi camera. Quỹ đạo đạn vẫn mô phỏng chủ yếu trên mặt phẳng chiến trường, chưa phải đạn vật lý 3D có độ cao/ trọng lực đầy đủ.

### Dòng 341–345 — Lưới va chạm không gian

- `rebuildObstacleGrid()` đưa mỗi vật cản vào các cell 160 đơn vị.
- `eachNearbyObstacle()` chỉ thăm cell gần truy vấn nếu grid còn đồng bộ với danh sách obstacle; nếu không đồng bộ thì dùng vòng quét dự phòng.
- `blocked()` kiểm tra chồng lấn hình chữ nhật; `pointBlocked()` kiểm tra điểm nằm trong vật cản.
- `moveEntity()` chia chuyển động theo trục X rồi trục Y giúp trượt dọc cạnh tường thay vì kẹt vào một góc.
- Giới hạn: bounding box đơn giản, không có collider lồi/đường cong hoặc hình học độ cao. Khi thêm vật thể di động, phải rebuild/cập nhật grid hoặc đảm bảo count/owner có thay đổi.

### Dòng 346–356 — Lưới điều hướng và A*

- `NAV_CELL=90` chia bản đồ thành lưới walkable/unwalkable; `buildNavigationGrid()` lấy mẫu va chạm ở tâm từng cell.
- `navHeapPush/navHeapPop` quản lý frontier bằng min-heap.
- `findNavPath()` dùng g-cost, heuristic Euclid và 8 hướng; bước chéo không được đi chéo qua hai ô chặn. Giới hạn mở rộng là 1800 ô để tránh tìm kiếm không giới hạn.
- `steerBotAlongPath()` làm mới đường khi mục tiêu thay đổi hoặc hết bộ đếm, tiến waypoint rồi di chuyển; nếu không có đường thì fallback hướng trực tiếp.
- Đây là A* dạng lưới chứ không phải navmesh; lối đi hẹp hơn một cell, vật cản thay đổi sau khi khởi tạo và smoothing đường cần kiểm thử thêm.

### Dòng 357–417 — Dữ liệu bản đồ và gameplay setup

- `buildMap()` reset obstacle/decor/items và tạo A/B/C gần trục giao lộ trung tâm.
- Các nhóm nhà được khai báo tường minh với kiểu façade, kích thước và số tầng. Các cửa ngõ quanh nhà, hàng rào, bức tường thấp, cửa hàng và nhà thờ giữ các hành lang bắn/đi vòng.
- Props được đặt có chủ đích quanh quảng trường; các bông hoa/đá nhỏ tạo chi tiết nền nhưng tránh một phần lối chính và vùng chiếm điểm.
- Vật phẩm được tạo ngẫu nhiên cộng với vài điểm hướng dẫn cố định; spawn được reset về phe xanh.
- Tốt: layout có cấu trúc dễ chỉnh và objective line rõ. Rủi ro: tọa độ đặt tay có thể khiến một số đạo cụ che lối, nên mỗi lần di chuyển nhà phải chạy test vị trí/đường nav.

### Dòng 418–423 — Spawn, vũ khí, đạn và cứ điểm

- `spawnBots()` chọn phe và điểm spawn khác nhau tùy mode, kiểm tra va chạm/khoảng cách trước khi đặt bot.
- `WEAPONS` lưu thông số băng đạn, nhịp bắn, nạp, tầm, độ tản và sát thương của AK/Uzi/shotgun/sniper/pistol/knife.
- `shootPlayer()` giảm đạn, tạo projectile. Shotgun bắn chùm pellet. `blockedRay()` kiểm tra vật cản giữa hai điểm.
- `shootBot()` dùng phản ứng/độ kỹ năng và thời gian nghỉ burst; `killBot()` phát vật phẩm và trừ vé.
- `captureObjectives()` xử lý tranh chấp, chiếm điểm, thay đổi vé theo số mục tiêu giữ và kết thúc trận. Kết quả trận dùng vé/kết quả điểm để xác định bên thắng.

### Dòng 424–429 — Vòng cập nhật gameplay

- `update(dt, now)` giới hạn delta time, đếm thời gian trận, reload, tử trận, di chuyển người chơi, bot và projectile.
- Player/bot di chuyển bằng tọa độ mặt phẳng X/Z biểu diễn dưới `x/y`; `moveEntity()` áp dụng collision.
- Bot tìm địch gần nhất, chọn hướng áp sát/né/strafe và gọi A* khi không ở cự ly giao chiến gần.
- Projectile kiểm tra đường đi theo các bước nhỏ, vật cản và mục tiêu. Đây là nơi tiêu tốn CPU khi nhiều đạn/bot; cần giữ `steps` có giới hạn hợp lý và dùng broad-phase collider.
- Bất đồng còn lại: projectile va chạm và nhận diện người/bot theo mặt phẳng, không so độ cao mô hình. Vì vậy pitch camera PC/Android chưa làm đạn hoàn toàn có quỹ đạo 3D. Đừng quảng cáo đây là mô phỏng ballistic 3D cho đến khi sửa phần này.

### Dòng 430–440 — Camera, mô hình người và LOD

- `cameraFrame()` chuyển giữa FPS và TPP, tính eye/target/FOV theo aspect ratio, aim, crouch và jump.
- `buildSoldierLOD()` dựng một binh sĩ ít chi tiết trong một mesh để dùng cho bot xa; `initModels()` tạo người chơi, nhiều palette bot và LOD.
- LOD giảm draw calls cho bot >520 đơn vị và ẩn thanh máu nhỏ ở xa. Chuyển ngưỡng LOD cần profiling bởi khoảng cách camera và độ phân giải phụ thuộc cảnh/thiết bị.

### Dòng 441–551 — Dựng mesh tĩnh của thế giới

- `rebuildStaticWorld()` dùng `MeshBuilder` dựng nền, phố, vỉa hè, đá lát, façade và mái.
- `gableRoof()` tạo hai mặt mái dốc và các dải ngói đất nung; `frontWindow()`/`sideWindow()` tạo ô cửa, khung sáng, kính xanh và cửa chớp.
- Mỗi nhà có chân tường, viền góc, cửa gỗ, lanh-tô, ống khói; nhà hai tầng có ban công/lan can/hộp hoa; cửa hàng có mái che; nhà thờ có ô tháp chuông và mái chóp.
- Vạch tim đường kiểu xa lộ cuối cùng đã bỏ; mặt đường dùng dải đá lát lệch hàng, rãnh thoát nước và mảng vá.
- Cuối hàm, toàn bộ hình học tĩnh được upload thành `staticWorld`: ưu điểm là ít draw call, đổi lại rebuild toàn bản đồ tốn CPU/memory và yêu cầu giải phóng buffer mesh cũ.
- Hạn chế hình ảnh: shader dùng màu đỉnh, không có UV/texture atlas, normal map, roughness/metallic PBR hoặc hệ thống ánh sáng nhiều nguồn. Mái/ngói/cửa là hình học thủ tục stylized; không thể gọi photorealistic.

### Dòng 552–563 — Camera matrix và súng FPS

- `cameraMatrices()` ghép view/projection/model thành MVP.
- `firstPersonWeaponMatrix()` định vị súng gần camera, tính ảnh hưởng pitch, sway, recoil và reload dip.
- Mô hình súng được chia theo loại với các bộ phận receiver, nòng, đầu nòng, báng, băng đạn, scope/rail và cẳng tay/găng. Những hình học này là mô hình gameplay low-poly tạo từ `MeshBuilder`, không phải bản sao cơ khí chính xác.

### Dòng 564–623 — Renderer, mesh động và HUD

- `draw()` làm sạch buffer, vẽ cảnh tĩnh/props theo batch, mục tiêu, item, projectile, bot và súng FPS. Bot gần dùng model có chuyển động chi tiết; bot xa dùng LOD.
- `ringMesh()` cache lưới vòng chiếm điểm theo màu để tránh tạo mesh lặp.
- `rebuildDynamicModels()` tạo thanh máu, item nhặt và silhouette súng để đặt trên map.
- `syncWeaponRack()` cập nhật trạng thái vũ khí được chọn; `drawMinimap()` chỉ vẽ radar mỗi khoảng 180 ms thay vì mọi frame.
- `frame()` tính dt, cập nhật gameplay, vẽ, ước lượng FPS và giảm `renderScale` trên pointer coarse nếu FPS thấp hơn 29 trong một khoảng liên tục; hồi dần sau khi FPS cao hơn 53. Đây là điều chỉnh thích ứng đơn giản, không thay thế profiler.

### Dòng 624–629 — Input cảm ứng, khởi động trận và chọn mode

- Joystick lấy pointer capture, clamp trục và reset knob khi pointerup/cancel/lost capture.
- Vùng canvas bên phải dành cho vuốt camera; `pointerId` giữ gesture nhất quán với `pointercapture`, tránh trộn hai ngón vào một gesture.
- Nút BẮN giữ `touch.fire` cho đến pointerup/cancel/lost capture. Các nút `data-action` gọi cùng handler với bàn phím.
- Nút bắt đầu reset súng, đạn, vé, thời gian, vị trí, camera, trạng thái UI rồi chạy `buildMap()`, `spawnBots(19)` và render objective. Trên coarse pointer, game thử fullscreen/landscape nhưng luôn bắt lỗi vì trình duyệt có thể từ chối yêu cầu này.

### Dòng 630–705 — Model binh sĩ, chuyển động và props

- `buildSoldier()` tạo model chi tiết theo palette; `partM()` và `drawSoldier()` đặt các phần thân/chi theo chuyển động, yaw và phase.
- `addProps()` tạo trees/cypress/hedge/bench/planter/lamp/barrel/crate/car/market/well/cart/sign/flower/rocks; các collider của vật chắn được thêm vào obstacles. Không phải mọi cây/hoa nhỏ đều chặn đường, có chủ ý để giữ gameplay thông thoáng.
- Mô hình này không có skeleton/skin weights; animation là chuyển động hình học theo hàm JS chứ không phải animation clip.

### Dòng 706–754 — AI thích nghi

- `AIK`, `AI`, `TM`, `cellOf` và `cellPos` lưu hồ sơ chiến thuật cục bộ qua `localStorage` và đo vị trí, mục tiêu, vũ khí, thời gian đứng yên, chết và phong cách chơi.
- Lớp đầu phân loại camper/rusher/objective/balanced và phân bố goal cho bot.
- Lớp AI v3 có `TAC` gồm rush/flank/ambush/hold/crossfire, chọn tactic bằng score + exploration gần kiểu multi-armed bandit và cập nhật `AI.q`, `AI.n`, `AI.lvl` sau trận.
- `aiTick2()` dự đoán vận tốc người chơi và đo sát thương; attribution cho chiến thuật lấy bot đối địch gần nhất khi người chơi mất máu, không phải gắn trực tiếp mỗi projectile với nguồn sát thương chính xác. Số liệu thưởng do đó chỉ là heuristic.
- Còn hai lớp AI nối tiếp bằng wrapper và phép gán lại `aiApply`, `aiTick`, `aiLearn`. Hoạt động hiện tại có ý định rõ nhưng cấu trúc bảo trì chưa lý tưởng; refactor sang `BotDirector`, `PlayerTelemetry`, `TacticScorer` là việc nên làm riêng sau khi bản ổn định.
- `localStorage` chưa có schema/version migration nghiêm ngặt. Nên xác thực từng trường sau khi parse, giới hạn kích thước heatmap, hỗ trợ export/import JSON và nút reset hồ sơ.

## 3. Phân tích hiệu năng

### Các tối ưu hiện có

1. **Batching:** cảnh tĩnh và props thành một mesh mỗi nhóm thay vì một draw call cho mỗi viên gạch/nhà/ghế. Đây phù hợp với nguyên tắc WebGL nên giảm draw calls và có thể giảm kích thước back buffer trên thiết bị yếu (MDN: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
2. **Spatial grid:** truy vấn vật cản chỉ trong cell lân cận, giảm vòng quét toàn bộ danh sách khi bắn/di chuyển.
3. **A* có cache đường:** bot tái dùng waypoint trong một khoảng thời gian, không tìm đường toàn cục mọi frame.
4. **LOD:** bot xa có mesh nhẹ hơn, thanh máu xa bị bỏ.
5. **Adaptive resolution:** giảm DPR khi FPS thấp trên cảm ứng, tăng chậm khi FPS ổn định.
6. **Minimap throttle:** khoảng 180 ms mới vẽ lại, không chạy trên mọi frame.

### Nút thắt còn lại

- `MeshBuilder` lưu position/normal/color vào array JS rồi upload thành `Float32Array`; build cảnh rất nhiều hình học tại thời điểm bắt đầu trận có thể gây khựng một lần. Nên đo thời gian build map và tránh dựng lại static mesh khi chỉ respawn.
- `drawMesh()` bind buffer và set attribute mỗi lần vẽ. Trong tương lai có thể cache VAO/attribute layout để tránh lặp setup.
- Bot mỗi frame tìm đối thủ bằng vòng lặp qua các bot khác: độ phức tạp xấp xỉ O(N²). Với 19 bot còn chấp nhận được, nhưng khi tăng quy mô nên dùng spatial grid riêng cho thực thể.
- `blockedRay()` sample đường đạn bằng bước ~14 đơn vị; nó vẫn cần nhiều phép kiểm tra khi sniper bắn xa. Có thể dùng ray-vs-AABB theo lưới.
- `draw()` vẫn có các draw call riêng cho từng bot, item và projectile. Nếu tăng số lượng lớn, cần đo trước rồi batch particle/tracer và dùng instancing (nếu phù hợp).
- Không có telemetry GPU, không có GPU timer query, nên FPS trên HUD chỉ là FPS CPU-frame đo xấp xỉ.

## 4. Kiểm thử và kết quả

Các kiểm tra được thực hiện cho bản này:

- **JavaScript syntax (`node --check`):** đạt sau khi trích script từ `index.html`.
- **HTML parser:** 42 ID tĩnh, không có ID trùng lặp. `aiReport` được tạo động sau trận, vì vậy việc không có trong markup ban đầu là bình thường.
- **CSS parser (`tinycss2`):** 230 top-level rules, không phát hiện lỗi cú pháp trong stylesheet.
- **A* isolated barrier test:** đường đi tìm được vòng qua tường giả lập, không đi xuyên vùng bị chặn. Test là test logic cô lập, không thay thế kiểm thử mọi tuyến trong bản đồ thật.
- **Map-construction smoke test:** 68 obstacles, 159 props decor, 31 items/pickups và ba objectives A/B/C với cấu hình test hiện tại.
- **Static world mesh smoke test:** builder đi qua 8.134 thao tác hình học (6.068 box, 137 sphere, 1 cylinder, 74 tri, 1.854 quad) bằng `MockMeshBuilder`. Đây là đếm primitive builder, không phải số tam giác cuối cùng hay GPU draw call.
- **Props mesh smoke test:** 436 thao tác hình học (106 box, 186 sphere, 144 cylinder) bằng mock builder.
- **ZIP:** sẽ được xác minh bằng `ZipFile.testzip()` sau khi đóng gói.

**Không kiểm thử trực quan được:** trình duyệt Chromium bị chặn khi mở nội dung trong môi trường này (`ERR_BLOCKED_BY_ADMINISTRATOR`) và không tạo được phiên WebGL/EGL kiểm chứng. Chưa khẳng định rằng game render hoàn hảo hoặc đã đạt FPS mục tiêu trên điện thoại thật.

## 5. Danh sách vấn đề và mức ưu tiên

| Ưu tiên | Vấn đề | Tác động | Hướng khắc phục |
|---|---|---|---|
| P0 | Không có xác nhận render WebGL trên thiết bị thật | Không biết chắc shader, camera, HUD có khớp mọi máy | Mở ZIP bằng Chrome/Edge WebGL 2; thử landscape/portrait và ghi FPS |
| P1 | Đạn/va chạm vẫn phẳng theo mặt đất, không kiểm tra độ cao mục tiêu | Ngắm lên/xuống có thể không tương ứng với điểm trúng | Chuyển projectile sang vị trí 3D (x,y,z), kiểm tra capsule/AABB 3D và vật cản theo chiều cao |
| P1 | AI dùng wrappers nhiều lớp và attribution sát thương heuristic | Khó bảo trì, reward có thể gán sai tactic | Tách telemetry/decision/reward; gắn ID projectile và tactic tại lúc bắn |
| P1 | A* dùng lưới ô 90 đơn vị, smoothing hạn chế | Bot có thể lệch/không qua lối hẹp | Giảm ô ở khu vực chi tiết hoặc graph waypoint; string-pulling có kiểm tra va chạm |
| P1 | Collision phần lớn là AABB phẳng | Vật thể tròn/chiều cao không chính xác | Thêm collider capsule/circle và dữ liệu chiều cao cho vật thể |
| P2 | Không có texture/PBR và rig skeleton | Hình ảnh vẫn low-poly, animation chưa tự nhiên | Thêm glTF loader/texture atlas khi được cho phép; hoặc tiếp tục procedural mesh để giữ offline |
| P2 | `localStorage` chưa có schema migration | Profile cũ/hỏng có thể gây lỗi thống kê | Thêm `schemaVersion`, validation, import/export và recovery |
| P2 | Render loop không xử lý context loss | Sau khi GPU reset game có thể không phục hồi | Bắt `webglcontextlost/restored`, tái tạo buffer/model |
| P2 | Một số hàm lớn nén trên cùng dòng | Review/diff và tìm lỗi khó | Format code có kiểm soát hoặc tách JS module ở giai đoạn sau, nhưng cân nhắc yêu cầu chạy qua `file://` |

## 6. Lộ trình phát triển khuyến nghị

1. **Nghiệm thu trên máy thật:** PC mouse+keyboard, Android landscape, Android portrait; ghi độ phân giải, trình duyệt, FPS menu/trận và số bot.
2. **Tính đúng gameplay:** đạn 3D/độ cao, hitbox, trạng thái reset, mục tiêu/vé, spawn và revive.
3. **AI:** tách director khỏi main update; profiling O(N²); đo win-rate / damage / time-to-objective nhiều seed.
4. **Đồ họa:** texture atlas cho mặt tiền/mái đá, mô hình binh sĩ có skeleton nếu có asset tool phù hợp; không gọi hình học low-poly hiện tại là photorealistic.
5. **Bản đồ:** kiểm tra tất cả lối nav, không-spawn bên trong nhà, cân bằng đường vòng và tầm nhìn; tăng detail bằng props theo cụm có batch.
6. **Phát hành:** ZIP có đủ `assets`, README tiếng Việt, changelog, audit và bộ test; giữ bản gốc để rollback.

## 7. Nguồn tham khảo kỹ thuật

- MDN, WebGL best practices — batching draw calls, back-buffer resolution, bộ nhớ GPU: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Red Blob Games, A* implementation — graph, heuristic, frontier, path reconstruction: https://www.redblobgames.com/pathfinding/a-star/implementation.html
- MDN, CSS environment variables — `safe-area-inset-*` cho vùng an toàn trên thiết bị: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Environment_variables/Using

Các trang trên là tài liệu kỹ thuật tham khảo; chúng không chứng minh game đã được benchmark hoặc kiểm thử phần cứng.
