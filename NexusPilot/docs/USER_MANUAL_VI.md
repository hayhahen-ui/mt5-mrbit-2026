# 📖 HƯỚNG DẪN SỬ DỤNG NEXUSPILOT PRO v3.00 (NEXTGEN)

Chào mừng bạn đến với **NexusPilot Pro** – Hệ thống bảng điều khiển Cockpit thông minh và Trợ lý giao dịch 1-Click dành riêng cho nền tảng MetaTrader 5 (MT5).

---

## 1. HƯỚNG DẪN CÀI ĐẶT

### Bước 1: Sao chép file vào thư mục MT5
1. Mở MetaTrader 5: Chọn menu **File** → **Open Data Folder** (Mở thư mục dữ liệu).
2. Di chuyển vào thư mục: `MQL5`.
3. Sao chép các thành phần từ thư mục dự án `NexusPilot`:
   - Thư mục `Include/NexusPilot` vào `MQL5/Include/NexusPilot`
   - File `Experts/NexusPilot.mq5` vào `MQL5/Experts/` (Nếu bạn muốn giao dịch 1-Click)
   - File `Indicators/NexusPilot_HUD.mq5` vào `MQL5/Indicators/` (Nếu bạn chỉ muốn xem HUD biểu đồ)

### Bước 2: Cấu hình cho phép WebRequest (Telegram - Không cần DLL)
1. Trong MT5: Chọn **Tools** → **Options** → Thẻ **Expert Advisors**.
2. Tích chọn **Allow WebRequest for listed URL**.
3. Thêm đường dẫn: `https://api.telegram.org` vào danh sách.
4. Tích chọn **Allow Algo Trading** (Cho phép giao dịch tự động) nếu bạn dùng bản Expert Advisor.
5. **LƯU Ý**: NexusPilot **KHÔNG CẦN** tích "Allow DLL imports", đảm bảo máy tính và tài khoản an toàn 100%.

### Bước 3: Đưa NexusPilot lên biểu đồ
1. Mở cửa sổ **Navigator** (Ctrl + N), chuột phải vào mục **Expert Advisors** (hoặc Indicators) chọn **Refresh**.
2. Kéo `NexusPilot` thả vào một biểu đồ bất kỳ (ví dụ: `XAUUSD` khung `M15`).
3. Tùy chỉnh các tham số đầu vào trong tab **Inputs** rồi bấm **OK**.

---

## 2. CÁC THAM SỐ ĐẦU VÀO QUAN TRỌNG (TAB INPUTS)

| Tham số | Ý nghĩa & Khuyến nghị | Mặc định |
| :--- | :--- | :--- |
| `InpLang` | Ngôn ngữ hiển thị (`LANG_VI` hoặc `LANG_EN`). | `LANG_VI` |
| `InpSymbols` | Danh sách cặp theo dõi trên Radar, phân cách bằng dấu phẩy. Để trống sẽ tự nhận diện 8 cặp thanh khoản cao nhất (`XAUUSD,EURUSD,GBPUSD,USDJPY,AUDUSD,BTCUSD,US30,ETHUSD`). | Để trống |
| `InpRiskPct` | Mức rủi ro phần trăm vốn cho mỗi lệnh (dùng để tự động tính toán khối lượng Lot theo StopLoss). | `1.0%` |
| `InpMaxDailyLoss` | **Prop Firm Guard**: Khóa vào lệnh mới nếu mức sụt giảm trong ngày chạm ngưỡng này (Bảo vệ tài khoản thi quỹ FTMO/MFF). | `4.0%` |
| `InpDashScale` | Kích thước giao diện Cockpit (0.8x đến 1.6x). | `1.1` |
| `InpSplitOrders` | Tự động chia nhỏ khối lượng lệnh thành 3 lệnh tương ứng với TP1 (50%), TP2 (30%), TP3 (20%). | `true` |
| `InpAutoBreakEven` | Tự động dời Stop Loss về hòa vốn (Entry + phí) khi giá chạm mục tiêu TP1. | `true` |
| `InpTgEnable` | Bật gửi tín hiệu phân tích và thông báo lên Telegram Bot. | `false` |
| `InpTgToken` | Token của Bot Telegram (Nhận từ `@BotFather`). | Trống |
| `InpTgChatID` | ID của Nhóm/Kênh nhận tin (dạng `-100...`). | Trống |
| `InpTgTopicGold` | ID Topic cho Vàng (dành cho nhóm bật Telegram Forum Topics). | `0` (Chung) |

---

## 3. HƯỚNG DẪN SỬ DỤNG BẢNG ĐIỀU KHIỂN COCKPIT

### 7 Tab chức năng chính:
- **`FLIGHT` (Phím tắt: F)**:
  - Hiển thị tín hiệu mới nhất: Hướng (BUY/SELL), Giá vào lệnh (Entry), Stop Loss, 3 mức TP1/TP2/TP3 kèm tỷ lệ xác suất chạm mục tiêu.
  - Hạng chất lượng tín hiệu: từ **Q1 đến Q5** (Q5 là mức hội tụ cao nhất, kết hợp đa khung thời gian và khối lượng).
  - Tỉ lệ thắng ước tính **P(win)** từ dữ liệu lịch sử.
  - **Nút 1-Click BUY / SELL**: Bấm một chạm để vào lệnh ngay lập tức với khối lượng Lot chuẩn xác đã được tính toán sẵn theo rủi ro của bạn.
- **`CTX` (Phím tắt: X - Market Context)**:
  - Bối cảnh thị trường: Xu hướng đa khung (M15, H1, H4, D1).
  - Đồng hồ 4 phiên giao dịch (Sydney, Tokyo, London, New York).
  - Bảng đo sức mạnh tiền tệ (Currency Strength Meter) cho 8 đồng tiền chính.
- **`SIG` (Phím tắt: S - Signal Engines)**:
  - Bật / tắt độc lập 3 Engine: **SMC ICT Alpha**, **Trend Ribbon Pro**, và **Mean Reversion**.
  - **Dòng "BỊ CHẶN"**: Giải thích cụ thể lý do tại sao hệ thống chưa kích hoạt lệnh (vd: Thị trường đang sideway, đang có tin tức đỏ sắp công bố, hoặc tài khoản đã chạm ngưỡng an toàn).
- **`RADAR` (Phím tắt: D - Multi-Asset Scanner)**:
  - Danh sách toàn bộ các cặp tiền/tài sản đang theo dõi.
  - Hiển thị giá trực tiếp, mức thay đổi 24h %, spread, và trạng thái tín hiệu.
  - **Chuyển biểu đồ tức thì**: Bấm nút **"XEM"** trên bất kỳ thẻ nào để đổi chart MT5 sang cặp đó.
- **`NEWS` (Phím tắt: N - Economic Calendar)**:
  - Lịch kinh tế native của MT5 trong vòng 24 giờ.
  - Phân loại mức độ ảnh hưởng (Đỏ = High, Cam = Med).
  - Tự động kích hoạt cơ chế né tin (News Filter window) trước 30 phút và sau 15 phút tin ra.
- **`LOG` (Phím tắt: L - Statistics & Audit)**:
  - Thống kê tỷ lệ thắng, hệ số lợi nhuận Profit Factor, tổng pips.
  - Nút **"XUẤT BÁO CÁO HTML STANDALONE"**: Tạo báo cáo đồ họa chuyên nghiệp lưu tại `MQL5/Files/NexusPilot_Report.html`.
- **`HELP` (Phím tắt: H)**:
  - Bảng hướng dẫn tra cứu nhanh phím tắt và thao tác.

---

### Thanh Dock bên trái (Phím tắt: K):
- Bấm phím **`K`** để ẩn/hiện thanh công cụ bên trái:
  - **Tài khoản & Quản lý rủi ro**: Số dư, vốn, PnL trong ngày, trạng thái Prop Firm Guard.
  - **Phiên & Nến**: Đồng hồ đếm ngược từng giây đóng nến hiện tại.
  - **Máy tính Lot (Calc)**: Tính sẵn khối lượng Lot đề xuất theo quy tắc quản trị vốn.
  - **Kênh cảnh báo**: Nút **"TEST TELEGRAM"** giúp bạn kiểm tra đường truyền bot tức thì.
  - **Nút khẩn cấp**: **"ĐÓNG TOÀN BỘ LỆNH (CLOSE ALL)"** khi thị trường có biến động xấu đột ngột.

---

## 4. BẢNG TỔNG HỢP PHÍM TẮT (KEYBOARD SHORTCUTS)

| Phím tắt | Tác vụ |
| :---: | :--- |
| **`F`** | Mở tab FLIGHT (Tín hiệu & Nút 1-Click Order) |
| **`X`** | Mở tab CTX (Bối cảnh thị trường MTF & Sức mạnh tiền tệ) |
| **`S`** | Mở tab SIG (Quản lý Engines & Kiểm tra dòng bị chặn) |
| **`D`** | Mở tab RADAR (Bảng quét đa cặp tiền) |
| **`N`** | Mở tab NEWS (Lịch kinh tế & Cửa sổ tin tức) |
| **`L`** | Mở tab LOG (Thống kê hiệu suất) |
| **`H`** | Mở tab HELP (Trợ giúp nhanh) |
| **`K`** | Ẩn / Hiện thanh Dock bên trái |
| **`M`** | Thu gọn (Minimize) hoặc Mở rộng Cockpit HUD |
| **`R`** | Xuất báo cáo HTML ngay lập tức |
| **`Esc`**| Quay về tab chính FLIGHT |
