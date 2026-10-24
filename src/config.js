// ====== CẤU HÌNH QUẢNG CÁO (Google AdSense — H5 Games Ads) ======
// 1) Đăng ký AdSense + bật "H5 Games Ads" cho tên miền chạy game (đúng tên miền của bạn; github.io thường không đủ điều kiện, nên dùng tên miền riêng).
// 2) Điền ID nhà xuất bản vào đây, dạng 'ca-pub-1234567890123456'.
// 3) Để testMode = true trong lúc thử (Google trả quảng cáo mẫu, KHÔNG tính tiền); đặt false khi chạy thật.
// Để trống publisherId => game dùng "quảng cáo mô phỏng" 5 giây để thử luồng nhận thưởng.
export const ADS = {
  publisherId: '',
  testMode: true,
  interstitialEveryMs: 180000, // tối thiểu giữa 2 quảng cáo xen kẽ (sau trận)
  rewardCooldownMs: 15000, // nghỉ tối thiểu giữa 2 lượt xem nhận thưởng
};
