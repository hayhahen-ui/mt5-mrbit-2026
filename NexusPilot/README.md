# ✈️ NexusPilot Pro NextGen

> **Next-Gen Open Cockpit HUD & Intelligent 1-Click Trading Assistant for MetaTrader 5 (MT5)**  
> *Một dự án Kaizen kiến trúc toàn diện từ mô típ EAFree Pilot v2.30 — Tối ưu hóa hiệu năng, mã nguồn mở 100%, bảo vệ quỹ thi Prop Firm, không cần DLL.*

---

## 🌟 TỔNG QUAN DỰ ÁN & TRIẾT LÝ KAIZEN

Dự án **NexusPilot** được phát triển nhằm tái thiết kế và nâng cấp toàn diện mô hình "Cockpit giao dịch đa năng" của phiên bản cũ **EAFree Pilot**:

1. **Khắc phục triệt để rào cản độc quyền**: Loại bỏ hoàn toàn cơ chế khóa IB bắt buộc (Exness/Vantage). NexusPilot cho phép trader tự do sử dụng trên **mọi Broker**, tài khoản cá nhân cũng như các quỹ cấp vốn khắt khe như **FTMO, FundedNext, MFF, The5ers**.
2. **Nâng cấp từ Indicator sang Trợ lý Thực thi 1-Click**: Không chỉ dừng lại ở việc xem tín hiệu tĩnh rồi phải gõ lệnh tay, NexusPilot trang bị bảng thực thi 1-Click: tự động tính lot chuẩn theo % rủi ro, tự động chia nhỏ lệnh thành 3 vị thế tương ứng 3 mục tiêu **TP1 (50%), TP2 (30%), TP3 (20%)**, và tự động dời Stop Loss về hòa vốn (**Auto Break-Even**) khi TP1 đạt mục tiêu.
3. **An toàn tuyệt đối (Zero-DLL Dependency)**: Sử dụng thuần túy MQL5 native `WebRequest()` cho Telegram Bot và Web API, không yêu cầu cấp quyền `Allow DLL imports`, đảm bảo an toàn sandbox cho máy tính và tương thích 100% với môi trường VPS.
4. **Kiến trúc Engine cắm rút (Clean OOP)**: Cung cấp 3 Engine chiến lược minh bạch và chuẩn mực:
   - **SMC ICT Alpha**: Nhận diện Order Block (OB), Fair Value Gap (FVG), Phá vỡ cấu trúc (BOS/CHoCH) và Quét thanh khoản (Liquidity Sweep).
   - **Trend Ribbon Pro**: Bắt nhịp sóng hồi (Pullback) theo dải đường trung bình động EMA Ribbon (21/50/200) và độ biến động ATR.
   - **Mean Reversion Sweep**: Bắt đỉnh đáy đảo chiều với Bollinger Bands mở rộng và phân kỳ RSI.
5. **Hiệu năng đồ họa mượt mà (Throttled UI Rendering)**: Áp dụng cơ chế cập nhật giao diện throttled (300ms) độc lập với luồng `OnTick()`, giúp biểu đồ luôn đạt tốc độ phản hồi 60 FPS mà không gây lag hay đơ nền tảng khi thị trường biến động mạnh.
6. **Báo cáo kiểm toán độc lập (HTML Standalone Dashboard)**: Xuất báo cáo hiệu suất chi tiết kèm biểu đồ SVG và nhật ký giao dịch chỉ bằng một cú nhấp chuột tại `MQL5/Files/NexusPilot_Report.html`.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```
e:\AI\EafreePilot\NexusPilot\
├── Experts\
│   └── NexusPilot.mq5                    # EA chính (Cockpit HUD + 1-Click & Semi-Auto Execution)
├── Indicators\
│   └── NexusPilot_HUD.mq5                # Bản Indicator thuần túy (Chỉ xem HUD, không yêu cầu AutoTrading)
├── Include\
│   └── NexusPilot\
│       ├── Defines.mqh                   # Định nghĩa hằng số, Enums, Structs tín hiệu và cấu hình
│       ├── Core\
│       │   ├── RiskManager.mqh           # Quản lý vốn đa tài sản, tính Lot chuẩn, Prop Firm Daily DD Guard
│       │   ├── TradeExecutor.mqh         # 1-Click Execution, chia 3 lệnh TP1/2/3, Auto BE, Close All
│       │   ├── MarketContext.mqh         # Phân tích MTF (M15-D1), 4 phiên giao dịch, CSM 8 đồng tiền
│       │   └── NewsCalendar.mqh          # Lịch kinh tế MQL5 native, phát hiện tin đỏ để kích hoạt News Window
│       ├── Engines\
│       │   ├── ISignalEngine.mqh         # Giao diện trừu tượng OOP chuẩn cho mọi Signal Engine
│       │   ├── EngineSMC.mqh             # Engine SMC/ICT (Order Block, FVG, BOS, Sweep)
│       │   ├── EngineTrendMomentum.mqh   # Engine Trend Ribbon (EMA 21/50/200 + Pullback)
│       │   ├── EngineMeanReversion.mqh   # Engine Mean Reversion (Bollinger + RSI Divergence)
│       │   └── EngineManager.mqh         # Quản phối đa Engine, tính điểm Q1-Q5, P(win) & Dòng bị chặn
│       ├── Radar\
│       │   └── MultiSymbolScanner.mqh    # Quét đa cặp thời gian thực, 1-Click click-to-switch chart
│       ├── Notification\
│       │   └── TelegramNotifier.mqh      # Gửi Telegram Native WebRequest (Hỗ trợ Forum Topics, nút Test TG)
│       ├── UI\
│       │   ├── Theme.mqh                 # Bảng màu Dark Cyber Glassmorphism & Tỉ lệ co giãn Scale
│       │   ├── GuiRenderer.mqh           # Engine vẽ Object tối ưu hiệu năng, dọn dẹp sạch khi Uninit
│       │   ├── CockpitDock.mqh           # Dock phụ trợ bên trái (Watch, Sessions, MTF, Calc, Prop Guard)
│       │   └── CockpitTabs.mqh           # 7 Tabs HUD chính (FLIGHT, CTX, SIG, RADAR, NEWS, LOG, HELP)
│       └── Reporting\
│           └── HtmlReportExporter.mqh    # Xuất báo cáo HTML Standalone có biểu đồ đường SVG
├── docs\
│   ├── ARCHITECTURE_AND_AUDIT.md        # Báo cáo Audit chi tiết dự án cũ & Kiến trúc Kaizen
│   └── USER_MANUAL_VI.md                 # Sách hướng dẫn sử dụng tiếng Việt chi tiết cho người dùng
└── README.md                             # Tài liệu tổng quan dự án
```

---

## ⚡ HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG NHANH

### 1. Cài đặt vào MetaTrader 5:
1. Mở MT5: Vào **File** → **Open Data Folder** → thư mục **MQL5**.
2. Sao chép thư mục `Include/NexusPilot` vào `MQL5/Include/NexusPilot`.
3. Sao chép file `NexusPilot.mq5` vào `MQL5/Experts/` (hoặc `NexusPilot_HUD.mq5` vào `MQL5/Indicators/`).
4. Khởi động lại MT5 hoặc chuột phải vào Navigator bấm **Refresh**.

### 2. Thiết lập cho phép WebRequest (Telegram Bot):
1. Trong MT5: Chọn **Tools** → **Options** → thẻ **Expert Advisors**.
2. Tích chọn **Allow WebRequest for listed URL** và thêm: `https://api.telegram.org`.
3. Tích chọn **Allow Algo Trading** (nếu dùng bản EA thực thi lệnh).

### 3. Phím tắt thao tác nhanh trên biểu đồ:
- **`F`**: Tab **FLIGHT** (Xem kế hoạch tín hiệu & Nút 1-Click BUY/SELL)
- **`X`**: Tab **CTX** (Bối cảnh thị trường MTF, 4 phiên, sức mạnh tiền tệ)
- **`S`**: Tab **SIG** (Bật/tắt các Engine & Xem dòng lý do "Bị chặn")
- **`D`**: Tab **RADAR** (Bảng quét đa cặp tiền & Chuyển biểu đồ nhanh)
- **`N`**: Tab **NEWS** (Lịch kinh tế MQL5 native & Cửa sổ tin tức đỏ)
- **`L`**: Tab **LOG** (Xem thống kê tín hiệu)
- **`H`**: Tab **HELP** (Xem hướng dẫn tra cứu)
- **`K`**: Ẩn / Hiện thanh **Dock công cụ bên trái**
- **`M`**: Thu gọn / Mở rộng Cockpit HUD
- **`R`**: Xuất báo cáo hiệu suất HTML ngay lập tức

---

## 📚 TÀI LIỆU THAM KHẢO CHI TIẾT
- 📄 [Báo cáo Audit & Kiến trúc Kaizen](file:///e:/AI/EafreePilot/NexusPilot/docs/ARCHITECTURE_AND_AUDIT.md)
- 📖 [Sách hướng dẫn sử dụng tiếng Việt chi tiết](file:///e:/AI/EafreePilot/NexusPilot/docs/USER_MANUAL_VI.md)
