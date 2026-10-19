//+------------------------------------------------------------------+
//|                                                   NexusPilot.mq5 |
//|                                  NexusPilot NextGen Architecture |
//|                       Copyright 2026, NexusPilot Open Trading AI |
//+------------------------------------------------------------------+
#property copyright   "NexusPilot Open Trading AI"
#property link        "https://github.com/nexuspilot"
#property version     NEXUSPILOT_VERSION
#property description "NexusPilot Pro: Cockpit Dashboard & Intelligent 1-Click Trading Assistant"
#property description "Architecture Kaizen: Clean OOP, Zero-DLL, Multi-Engine SMC/Trend/MeanRev, Prop-Firm Safe"

//+------------------------------------------------------------------+
//| Includes                                                         |
//+------------------------------------------------------------------+
#include "../Include/NexusPilot/Defines.mqh"
#include "../Include/NexusPilot/Core/RiskManager.mqh"
#include "../Include/NexusPilot/Core/TradeExecutor.mqh"
#include "../Include/NexusPilot/Core/MarketContext.mqh"
#include "../Include/NexusPilot/Core/NewsCalendar.mqh"
#include "../Include/NexusPilot/Engines/EngineManager.mqh"
#include "../Include/NexusPilot/Radar/MultiSymbolScanner.mqh"
#include "../Include/NexusPilot/Notification/TelegramNotifier.mqh"
#include "../Include/NexusPilot/UI/Theme.mqh"
#include "../Include/NexusPilot/UI/GuiRenderer.mqh"
#include "../Include/NexusPilot/UI/CockpitDock.mqh"
#include "../Include/NexusPilot/UI/CockpitTabs.mqh"
#include "../Include/NexusPilot/Reporting/HtmlReportExporter.mqh"

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
sinput group "=== [1. THIẾT LẬP CHUNG / GENERAL] ==="
input ENUM_APP_LANG       InpLang           = LANG_VI;       // Ngôn ngữ / Language
input string              InpSymbols        = "";            // Danh sách cặp (Phân cách dấu phẩy, trống = Mặc định)
input double              InpRiskPct        = 1.0;           // Rủi ro % mỗi lệnh (Dùng gợi ý Lot)
input double              InpMaxDailyLoss   = 4.0;           // Ngưỡng khóa lỗ an toàn trong ngày % (Prop Firm Guard)
input double              InpDashScale      = 1.1;           // Kích cỡ Cockpit (0.8 - 1.6)

sinput group "=== [2. THỰC THI LỆNH / 1-CLICK EXECUTION] ==="
input ENUM_EXECUTION_MODE InpExecMode       = EXEC_ONE_CLICK;// Chế độ thực thi (Manual Assist / 1-Click / Semi-Auto)
input ulong               InpMagicNumber    = 888666;        // Magic Number
input int                 InpDeviation      = 10;            // Slippage tối đa (Points)
input bool                InpSplitOrders    = true;          // Tự chia 3 lệnh TP1 (50%), TP2 (30%), TP3 (20%)
input bool                InpAutoBreakEven  = true;          // Tự động dời SL về Break-Even khi chạm TP1
input bool                InpAutoTrailing   = false;         // Trailing Stop động

sinput group "=== [3. CẢNH BÁO / ALERTS] ==="
input bool                InpAlertPopup     = true;          // Cửa sổ cảnh báo trong MT5
input bool                InpAlertPush      = false;         // Thông báo Push về MT5 Mobile
input bool                InpAlertSound     = true;          // Âm thanh cảnh báo

sinput group "=== [4. TELEGRAM (NATIVE - KHÔNG CẦN DLL)] ==="
input bool                InpTgEnable       = false;         // Bật gửi tín hiệu lên Telegram
input string              InpTgToken        = "";            // Bot Token (Lấy từ @BotFather)
input string              InpTgChatID       = "";            // ID Nhóm/Kênh (-100...)
input int                 InpTgTopicGold    = 0;             // Topic ID Vàng (0 = Chung)
input int                 InpTgTopicForex   = 0;             // Topic ID Forex (0 = Chung)
input int                 InpTgTopicCrypto  = 0;             // Topic ID Crypto (0 = Chung)
input int                 InpTgTzOffset     = 7;             // Múi giờ (+7 Việt Nam)
input string              InpTgTzLabel      = "VN";          // Nhãn múi giờ

//+------------------------------------------------------------------+
//| Global Subsystems Instances                                      |
//+------------------------------------------------------------------+
CRiskManager         g_riskMgr;
CTradeExecutor       g_executor;
CMarketContext       g_mktCtx;
CNewsCalendar        g_newsCal;
CEngineManager       g_engMgr;
CMultiSymbolScanner  g_radar;
CTelegramNotifier    g_telegram;
CCockpitDock         g_dock;
CCockpitTabs         g_hud;

datetime             g_lastScanTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("[NexusPilot] Khởi tạo hệ thống v", NEXUSPILOT_VERSION, " - Kiến trúc Kaizen MQL5...");

   // 1. Khởi tạo các Subsystems
   g_riskMgr.Init(InpRiskPct, InpMaxDailyLoss);
   g_executor.Init(InpMagicNumber, InpDeviation, InpSplitOrders, InpAutoBreakEven, InpAutoTrailing);
   g_mktCtx.Init(_Symbol, 2);
   g_newsCal.Init(30, 15, true);
   g_engMgr.Init();
   g_radar.Init(InpSymbols);
   g_telegram.Init(InpTgEnable, InpTgToken, InpTgChatID, InpTgTopicGold, InpTgTopicForex, InpTgTopicCrypto, InpTgTzOffset, InpTgTzLabel);

   // 2. Khởi tạo Giao diện Cockpit
   g_dock.Init(0, InpDashScale);
   g_hud.Init(0, InpDashScale);

   // 3. Khởi tạo Timer kiểm soát giao diện và quét đa cặp (300 ms throttled)
   EventSetMillisecondTimer(300);

   // Phân tích ban đầu
   g_engMgr.Analyze(_Symbol, _Period, g_riskMgr, g_newsCal, g_mktCtx);
   RedrawAll();

   Print("[NexusPilot] Hệ thống sẵn sàng! Bấm K mở Dock, bấm F/X/S/D/N/L/H chuyển Tab.");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   CGuiRenderer::DestroyAll(0);
   Print("[NexusPilot] Đã dọn dẹp sạch toàn bộ giao diện Cockpit. Tạm biệt!");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Quản lý các lệnh đang mở (Auto Break-Even khi chạm TP1)
   SignalPlan latest = g_engMgr.GetLatestSignal();
   if(latest.direction != DIR_FLAT)
   {
      g_executor.ManagePositions(_Symbol, latest.tp1, latest.entryPrice);
   }

   // Kiểm tra Drawdown Quỹ Prop Firm
   if(g_riskMgr.CheckPropFirmDrawdown())
   {
      // Nếu vượt ngưỡng lỗ ngày, cảnh báo
      static datetime lastWarn = 0;
      if(TimeCurrent() - lastWarn > 3600)
      {
         lastWarn = TimeCurrent();
         Print("[NexusPilot] ⚠️ CẢNH BÁO: Tài khoản đã chạm ngưỡng giới hạn Drawdown an toàn trong ngày! Khóa lệnh mới.");
      }
   }
}

//+------------------------------------------------------------------+
//| Timer function: Throttled UI & Multi-Symbol scanner              |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Quét cập nhật bối cảnh thị trường & nến
   g_mktCtx.Update();
   g_riskMgr.UpdateAccountMetrics();

   // Quét radar định kỳ mỗi 5 giây
   if(TimeCurrent() - g_lastScanTime >= 5)
   {
      g_lastScanTime = TimeCurrent();
      g_radar.ScanAll();
      g_engMgr.Analyze(_Symbol, _Period, g_riskMgr, g_newsCal, g_mktCtx);
   }

   RedrawAll();
}

//+------------------------------------------------------------------+
//| Vẽ lại toàn bộ Cockpit HUD & Dock                                |
//+------------------------------------------------------------------+
void RedrawAll()
{
   SignalPlan sig = g_engMgr.GetLatestSignal();
   double slPts = (sig.pipsSL > 0) ? (sig.pipsSL * 10.0) : 500;
   double suggestedLot = g_riskMgr.CalculateLotSize(_Symbol, slPts);

   g_dock.Render(g_riskMgr.GetStats(), g_mktCtx.GetState(), suggestedLot);
   g_hud.Render(sig, g_mktCtx.GetState(), g_engMgr, g_radar, g_newsCal);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| ChartEvent handler: Buttons & Keyboard Shortcuts                 |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   // 1. XỬ LÝ CLICK NÚT BẤM (CHARTEVENT_OBJECT_CLICK)
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      // Đóng / Mở Dock
      if(sparam == NP_PREFIX + "DOCK_BTN_CLOSE")
      {
         g_dock.Toggle();
         RedrawAll();
         return;
      }

      // Đóng toàn bộ lệnh khẩn cấp (Emergency Close)
      if(sparam == NP_PREFIX + "DOCK_BTN_CLOSE_ALL")
      {
         if(MessageBox("Bạn có chắc chắn muốn ĐÓNG TOÀN BỘ lệnh đang mở không?", "NexusPilot Emergency Close", MB_YESNO|MB_ICONWARNING) == IDYES)
         {
            g_executor.CloseAllPositions();
         }
         return;
      }

      // Nút TEST Telegram
      if(sparam == NP_PREFIX + "DOCK_BTN_TEST_TG")
      {
         Print("[NexusPilot] Đang thực hiện kiểm tra kết nối Telegram Bot...");
         if(g_telegram.TestConnection())
         {
            Alert("NexusPilot: Kết nối Telegram thành công!");
         }
         else
         {
            Alert("NexusPilot: Gửi Telegram thất bại! Vui lòng xem tab Experts để biết chi tiết cấu hình.");
         }
         return;
      }

      // Thu gọn / Phóng to Cockpit
      if(sparam == NP_PREFIX + "HUD_BTN_MIN")
      {
         g_hud.ToggleMinimize();
         RedrawAll();
         return;
      }

      // Đóng Cockpit
      if(sparam == NP_PREFIX + "HUD_BTN_CLOSE")
      {
         g_hud.ToggleMinimize();
         RedrawAll();
         return;
      }

      // Chuyển Tabs (0-6)
      for(int i = 0; i < 7; i++)
      {
         if(sparam == NP_PREFIX + "HUD_TAB_BTN_" + IntegerToString(i))
         {
            g_hud.SetActiveTab((ENUM_COCKPIT_TAB)i);
            RedrawAll();
            return;
         }
      }

      // 1-CLICK BUY / SELL TRỰC TIẾP TRÊN FLIGHT CARD
      if(sparam == NP_PREFIX + "TAB_BTN_EXEC_BUY" || sparam == NP_PREFIX + "TAB_BTN_EXEC_SELL")
      {
         SignalPlan curSig = g_engMgr.GetLatestSignal();
         if(curSig.direction != DIR_FLAT)
         {
            double slPts = (curSig.pipsSL > 0) ? (curSig.pipsSL * 10.0) : 500;
            double lot = g_riskMgr.CalculateLotSize(_Symbol, slPts);
            
            Print("[NexusPilot] 1-Click Thực thi lệnh: ", (curSig.direction == DIR_BUY ? "BUY " : "SELL "), _Symbol, " | Lot: ", lot);
            if(g_executor.ExecuteSignal(curSig, lot))
            {
               if(InpTgEnable) g_telegram.SendSignal(curSig);
               Alert("NexusPilot: Lệnh đã được thực thi thành công!");
            }
            else
            {
               Alert("NexusPilot: Thực thi lệnh thất bại! Kiểm tra cài đặt cho phép giao dịch (AutoTrading).");
            }
         }
         return;
      }

      // Xuất báo cáo HTML
      if(sparam == NP_PREFIX + "TAB_BTN_EXPORT_HTML")
      {
         if(CHtmlReportExporter::ExportReport(g_engMgr))
         {
            Alert("NexusPilot: Đã xuất báo cáo thành công! Mở file tại: MQL5/Files/NexusPilot_Report.html");
         }
         return;
      }

      // Chuyển Chart từ Radar Cards
      for(int r = 0; r < 8; r++)
      {
         if(sparam == NP_PREFIX + "TAB_BTN_SWITCH_" + IntegerToString(r))
         {
            g_radar.SwitchChartToSymbol(r);
            return;
         }
      }

      // Bật/tắt Engines trên Tab SIG
      if(sparam == NP_PREFIX + "TAB_BTN_TOGGLE_SMC")
      {
         g_engMgr.SetEngineStatus(ENGINE_SMC, !g_engMgr.IsEngineEnabled(ENGINE_SMC));
         RedrawAll();
         return;
      }
      if(sparam == NP_PREFIX + "TAB_BTN_TOGGLE_TREND")
      {
         g_engMgr.SetEngineStatus(ENGINE_TREND, !g_engMgr.IsEngineEnabled(ENGINE_TREND));
         RedrawAll();
         return;
      }
      if(sparam == NP_PREFIX + "TAB_BTN_TOGGLE_MREV")
      {
         g_engMgr.SetEngineStatus(ENGINE_MEAN_REV, !g_engMgr.IsEngineEnabled(ENGINE_MEAN_REV));
         RedrawAll();
         return;
      }
   }

   // 2. XỬ LÝ PHÍM TẮT BÀN PHÍM (CHARTEVENT_KEYDOWN)
   if(id == CHARTEVENT_KEYDOWN)
   {
      int key = (int)lparam;
      switch(key)
      {
         case 'F': case 'f': g_hud.SetActiveTab(TAB_FLIGHT); RedrawAll(); break;
         case 'X': case 'x': g_hud.SetActiveTab(TAB_CTX);    RedrawAll(); break;
         case 'S': case 's': g_hud.SetActiveTab(TAB_SIG);    RedrawAll(); break;
         case 'D': case 'd': g_hud.SetActiveTab(TAB_RADAR);  RedrawAll(); break;
         case 'N': case 'n': g_hud.SetActiveTab(TAB_NEWS);   RedrawAll(); break;
         case 'L': case 'l': g_hud.SetActiveTab(TAB_LOG);    RedrawAll(); break;
         case 'H': case 'h': g_hud.SetActiveTab(TAB_HELP);   RedrawAll(); break;
         case 'K': case 'k': g_dock.Toggle();                RedrawAll(); break;
         case 'M': case 'm': g_hud.ToggleMinimize();         RedrawAll(); break;
         case 'R': case 'r': CHtmlReportExporter::ExportReport(g_engMgr); break;
         case 27:            // Phím Esc
            if(g_hud.GetActiveTab() != TAB_FLIGHT)
            {
               g_hud.SetActiveTab(TAB_FLIGHT);
               RedrawAll();
            }
            break;
      }
   }
}
//+------------------------------------------------------------------+
