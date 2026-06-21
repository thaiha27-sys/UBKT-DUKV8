# HƯỚNG DẪN TRIỂN KHAI BACKEND
## HỆ THỐNG KTGS – UBKT Đảng ủy Chi cục Hải quan Khu vực VIII

---

## BƯỚC 1 — Tạo Google Spreadsheet

1. Mở **[Google Sheets](https://sheets.google.com)** → Tạo bảng tính mới
2. Đặt tên: `KTGS_HQKV8_2026`
3. Copy **Spreadsheet ID** từ URL (phần giữa `/d/` và `/edit`):
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID_Ở_ĐÂY]/edit
   ```

---

## BƯỚC 2 — Tạo Google Apps Script

1. Trong Spreadsheet → menu **Tiện ích mở rộng** → **Apps Script**
2. Xóa code mẫu, dán toàn bộ nội dung file `Code.gs`
3. Thay `PASTE_YOUR_SPREADSHEET_ID_HERE` bằng ID vừa copy ở Bước 1
4. Nhấn **💾 Lưu** (Ctrl+S), đặt tên project: `KTGS-Backend`

---

## BƯỚC 3 — Khởi tạo cấu trúc Sheets

1. Trong Apps Script, chọn hàm **`setupSpreadsheet`** ở dropdown trên
2. Nhấn **▶ Chạy**
3. Cấp quyền khi được hỏi (lần đầu tiên):
   - Chọn tài khoản Google
   - Click "Nâng cao" → "Chuyển đến KTGS-Backend"
   - Click "Cho phép"
4. Kiểm tra Spreadsheet → đã tạo **10 sheet** với tiêu đề đỏ

---

## BƯỚC 4 — Deploy Web App

1. Trong Apps Script → **Triển khai** → **Triển khai mới**
2. Chọn loại: **Ứng dụng web**
3. Cấu hình:
   - Mô tả: `KTGS API v1.0`
   - Thực thi với tư cách: **Tôi** (thaiha27@gmail.com)
   - Ai có thể truy cập: **Mọi người**
4. Nhấn **Triển khai**
5. Copy **URL Web App** (dạng: `https://script.google.com/macros/s/xxxx.../exec`)

---

## BƯỚC 5 — Kết nối Frontend

Mở file `assets/js/api.js`, thay dòng:
```javascript
const WEB_APP_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```
Bằng URL vừa copy:
```javascript
const WEB_APP_URL = 'https://script.google.com/macros/s/xxxx.../exec';
```

---

## BƯỚC 6 — Upload lên GitHub & Test

1. Upload toàn bộ file lên GitHub repository
2. Mở `https://thaiha27-sys.github.io/UBKT-DUKV8/`
3. Mở DevTools (F12) → Console
4. Chạy lệnh test:
   ```javascript
   API.testConnection().then(r => console.log(r));
   ```
5. Nếu thấy `{ ok: true, mode: 'live' }` → **Kết nối thành công** ✅

---

## CẤU TRÚC 10 SHEETS

| Sheet | Mục đích | Cột chính |
|---|---|---|
| CHUONG_TRINH | Chương trình KTGS | id, tenCuoc, loaiHinh, trangThai, phanTram |
| HO_SO | Hồ sơ điện tử | id, soHoSo, chuongTrinhId, trangThai |
| TAI_LIEU | Tài liệu trong hồ sơ | id, hosoId, loaiTL, coFile, driveLink |
| KET_LUAN | Kết luận KTGS | id, soVanBan, hosoId, tomTat |
| NHIEM_VU | Nhiệm vụ sau kết luận | id, ketluanId, deadline, trangThai |
| CHI_BO | Tiến độ 13 Chi bộ | id, ten, ktDone, gsDone |
| THU_VIEN | Thư viện nghiệp vụ | id, tenTL, loai, driveLink |
| NGUOI_DUNG | Phân quyền người dùng | id, email, vaiTro |
| NHAT_KY | Lịch sử thao tác | id, thoiGian, hanhDong |
| CAU_HINH | Cài đặt hệ thống | key, value |

---

## 3 TRIGGER TỰ ĐỘNG

| Trigger | Lịch chạy | Chức năng |
|---|---|---|
| `dailyOverdueSync` | Mỗi ngày 08:00 | Tự cập nhật trạng thái quá hạn |
| `dailyAlertEngine` | Mỗi ngày 07:00 | Gửi email cảnh báo đến hạn |
| `weeklyReport` | Thứ Hai 07:00 | Gửi báo cáo tổng hợp tuần |

> Email gửi đến: `thaiha27@gmail.com` (cấu hình trong sheet CAU_HINH)

---

## LỖI THƯỜNG GẶP

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `CORS error` | Web App chưa cho phép "Mọi người" | Kiểm tra lại Bước 4 |
| `Không tìm thấy sheet` | Chưa chạy `setupSpreadsheet` | Thực hiện lại Bước 3 |
| `Authorization required` | Chưa cấp quyền | Chạy lại hàm bất kỳ để trigger hỏi quyền |
| `Script timeout` | Dữ liệu quá nhiều | Thêm tham số `limit=50` vào API call |

---

*Tài liệu nội bộ – UBKT Đảng ủy Chi cục Hải quan Khu vực VIII*
