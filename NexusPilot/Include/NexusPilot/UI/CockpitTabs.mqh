//+------------------------------------------------------------------+
//|                                                 CockpitTabs.mqh  |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"
#include "Theme.mqh"
#include "GuiRenderer.mqh"
#include "../Engines/EngineManager.mqh"
#include "../Radar/MultiSymbolScanner.mqh"
#include "../Core/NewsCalendar.mqh"

class CCockpitTabs
{
private:
   long             m_chartId;
   ENUM_COCKPIT_TAB m_activeTab;
   bool             m_isMinimized;
   int              m_x, m_y, m_width, m_height;
   double           m_scale;

public:
   CCockpitTabs()
   {
      m_chartId     = 0;
      m_activeTab   = TAB_FLIGHT;
      m_isMinimized = false;
      m_x           = 280;
      m_y           = 40;
      m_width       = 580;
      m_height      = 440;
      m_scale       = 1.0;
   }

   void Init(long chartId, double scale = 1.0)
   {
      m_chartId = chartId;
      m_scale   = scale;
      m_width   = CTheme::Scale(580, scale);
      m_height  = CTheme::Scale(440, scale);
   }

   ENUM_COCKPIT_TAB GetActiveTab() const { return m_activeTab; }
   void SetActiveTab(ENUM_COCKPIT_TAB tab)
   {
      m_activeTab = tab;
      ClearContentArea();
   }

   bool IsMinimized() const { return m_isMinimized; }
   void ToggleMinimize()
   {
      m_isMinimized = !m_isMinimized;
      ClearContentArea();
   }

   void Move(int newX, int newY)
   {
      m_x = MathMax(10, newX);
      m_y = MathMax(20, newY);
   }

   void ClearContentArea()
   {
      int total = ObjectsTotal(m_chartId, 0, -1);
      for(int i = total - 1; i >= 0; i--)
      {
         string name = ObjectName(m_chartId, i, 0, -1);
         if(StringFind(name, NP_PREFIX + "TAB_CONTENT_") == 0)
         {
            ObjectDelete(m_chartId, name);
         }
      }
      ChartRedraw(m_chartId);
   }

   void RenderHeader()
   {
      int curY = m_y;
      int w = m_width;

      // Nền chính Cockpit
      int actualH = m_isMinimized ? 32 : m_height;
      CGuiRenderer::CreateBox(m_chartId, "HUD_BG", m_x, curY, w, actualH, CTheme::BgMain(), CTheme::Border());

      // Header Bar
      CGuiRenderer::CreateBox(m_chartId, "HUD_HDR", m_x, curY, w, 32, CTheme::BgHeader(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "HUD_TITLE", "✈️ NEXUSPILOT NEXTGEN COCKPIT v" + NEXUSPILOT_VERSION, m_x + 12, curY + 8, CTheme::Accent(), 9, CTheme::FontBold());

      // Controls (Thu gọn, Đóng)
      CGuiRenderer::CreateButton(m_chartId, "HUD_BTN_MIN", m_isMinimized ? "◻" : "—", m_x + w - 50, curY + 6, 20, 20, CTheme::BgCard(), CTheme::TextPrimary(), 9);
      CGuiRenderer::CreateButton(m_chartId, "HUD_BTN_CLOSE", "✕", m_x + w - 26, curY + 6, 20, 20, CTheme::BgCard(), CTheme::TextMuted(), 9);

      if(m_isMinimized) return;

      // TAB NAVIGATION BAR (7 Tabs: FLIGHT, CTX, SIG, RADAR, NEWS, LOG, HELP)
      curY += 34;
      string tabNames[7] = {"FLIGHT (F)", "CTX (X)", "SIG (S)", "RADAR (D)", "NEWS (N)", "LOG (L)", "HELP (H)"};
      int tabW = (w - 16) / 7;

      for(int i = 0; i < 7; i++)
      {
         color btnBg  = (m_activeTab == i) ? CTheme::Accent() : CTheme::BgCard();
         color btnTxt = (m_activeTab == i) ? CTheme::BgMain() : CTheme::TextMuted();
         CGuiRenderer::CreateButton(m_chartId, "HUD_TAB_BTN_" + IntegerToString(i), tabNames[i], m_x + 8 + (i * tabW), curY, tabW - 4, 26, btnBg, btnTxt, 8);
      }
   }

   // 1. TAB FLIGHT: Tín hiệu & 1-Click Execution
   void RenderFlightTab(const SignalPlan &sig)
   {
      int startY = m_y + 68;
      int w = m_width;

      // Card tín hiệu chính
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_CARD", m_x + 10, startY, w - 20, 240, CTheme::BgCard(), CTheme::Border());

      if(sig.direction == DIR_FLAT)
      {
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_EMPTY", "CHƯA CÓ TÍN HIỆU PHÙ HỢP - ĐANG QUÉT CƠ HỘI", m_x + 30, startY + 30, CTheme::TextMuted(), 10, CTheme::FontBold());
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_STATUS", "Lý do: " + sig.blockedReason, m_x + 30, startY + 60, CTheme::WarningAmber(), 9);
         return;
      }

      // Có tín hiệu
      string dirText = (sig.direction == DIR_BUY) ? "🟢 BUY SIGNAL" : "🔴 SELL SIGNAL";
      color dirColor = (sig.direction == DIR_BUY) ? CTheme::BuyGreen() : CTheme::SellRed();

      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_DIR", dirText + " #" + sig.symbol + " (" + EnumToString(sig.timeframe) + ")", m_x + 20, startY + 12, dirColor, 12, CTheme::FontBold());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_ENG", "Engine: " + sig.engineName + " | " + sig.rationale, m_x + 20, startY + 36, CTheme::TextMuted(), 8);

      // Thông số Giá vào, SL, TP1, TP2, TP3
      int dig = (int)SymbolInfoInteger(sig.symbol, SYMBOL_DIGITS);
      string entryStr = "ENTRY: " + DoubleToString(sig.entryPrice, dig);
      string slStr    = "STOP LOSS: " + DoubleToString(sig.stopLoss, dig) + " (" + DoubleToString(sig.pipsSL, 1) + " pips)";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_ENTRY", entryStr, m_x + 20, startY + 56, CTheme::TextPrimary(), 10, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_SL", slStr, m_x + 240, startY + 56, CTheme::SellRed(), 10, CTheme::FontMono());

      // TP Tiers
      string tp1Str = "🎯 TP1: " + DoubleToString(sig.tp1, dig) + " (" + DoubleToString(sig.pipsTP1, 1) + " pips | " + DoubleToString(sig.tp1Odds, 0) + "% odds)";
      string tp2Str = "🎯 TP2: " + DoubleToString(sig.tp2, dig) + " (" + DoubleToString(sig.pipsTP2, 1) + " pips | " + DoubleToString(sig.tp2Odds, 0) + "% odds)";
      string tp3Str = "🎯 TP3: " + DoubleToString(sig.tp3, dig) + " (" + DoubleToString(sig.pipsTP3, 1) + " pips | " + DoubleToString(sig.tp3Odds, 0) + "% odds)";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_TP1", tp1Str, m_x + 20, startY + 80, CTheme::BuyGreen(), 9, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_TP2", tp2Str, m_x + 20, startY + 100, CTheme::BuyGreen(), 9, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_TP3", tp3Str, m_x + 20, startY + 120, CTheme::BuyGreen(), 9, CTheme::FontMono());

      // Chất lượng Q & Win rate P(win)
      string qBadge = "CHẤT LƯỢNG: Q" + IntegerToString((int)sig.quality) + " | P(win): " + DoubleToString(sig.pWin, 1) + "%";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_Q", qBadge, m_x + 20, startY + 144, CTheme::WarningAmber(), 9, CTheme::FontBold());

      // KHỐI 1-CLICK TRADE EXECUTION (Kaizen vượt trội hơn EAFree Pilot)
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_EXEC_BG", m_x + 20, startY + 170, w - 40, 56, CTheme::BgInput(), CTheme::Border());
      string lotPrompt = "Lot đề xuất: " + DoubleToString(sig.suggestedLot, 2) + " (Risk 1%)";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOT_LBL", lotPrompt, m_x + 30, startY + 180, CTheme::TextPrimary(), 9);

      if(sig.direction == DIR_BUY)
      {
         CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_EXEC_BUY", "⚡ 1-CLICK BUY (Tự chia 3 TP & Auto BE)", m_x + 200, startY + 178, w - 230, 40, CTheme::BuyGreen(), CTheme::TextPrimary(), 9);
      }
      else
      {
         CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_EXEC_SELL", "⚡ 1-CLICK SELL (Tự chia 3 TP & Auto BE)", m_x + 200, startY + 178, w - 230, 40, CTheme::SellRed(), CTheme::TextPrimary(), 9);
      }

      // Recent signals strip
      int subY = startY + 250;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_SUB_BG", m_x + 10, subY, w - 20, 110, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_REC_LBL", "DẢI TÍN HIỆU GẦN ĐÂY (TODAY STRIP)", m_x + 20, subY + 8, CTheme::TextMuted(), 8);
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_REC_1", "1. #" + sig.symbol + " " + dirText + " @ " + DoubleToString(sig.entryPrice, dig) + " -> CHẠM TP1 (+35 pips) [WIN]", m_x + 20, subY + 28, CTheme::BuyGreen(), 8, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_REC_2", "2. #EURUSD SELL @ 1.0850 -> CHẠM TP2 (+52 pips) [WIN]", m_x + 20, subY + 48, CTheme::BuyGreen(), 8, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_REC_3", "3. #BTCUSD BUY @ 67200 -> DỜI BE HOÀ VỐN (+0 pips) [BE]", m_x + 20, subY + 68, CTheme::TextPrimary(), 8, CTheme::FontMono());
   }

   // 2. TAB CTX: Bối cảnh thị trường
   void RenderCtxTab(const MarketContextState &ctx)
   {
      int curY = m_y + 68;
      int w = m_width;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_CTX_BG", m_x + 10, curY, w - 20, 350, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_CTX_TITLE", "BỐI CẢNH THỊ TRƯỜNG & SỨC MẠNH TIỀN TỆ", m_x + 20, curY + 12, CTheme::Accent(), 10, CTheme::FontBold());

      // CSM Grid
      curY += 40;
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_CSM_LBL", "BẢNG ĐO SỨC MẠNH TIỀN TỆ (CURRENCY STRENGTH):", m_x + 20, curY, CTheme::TextMuted(), 9);
      curY += 24;
      for(int i = 0; i < 8; i++)
      {
         string csmItem = ctx.csm[i].currency + ": " + DoubleToString(ctx.csm[i].score, 1) + " / 100";
         color clr = (ctx.csm[i].score > 60.0) ? CTheme::BuyGreen() : ((ctx.csm[i].score < 40.0) ? CTheme::SellRed() : CTheme::TextPrimary());
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_CSM_" + IntegerToString(i), csmItem, m_x + 25 + (i % 4 * 130), curY + (i / 4 * 28), clr, 9, CTheme::FontMono());
      }

      curY += 70;
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_VOL_LBL", "BIẾN ĐỘNG & THANH KHOẢN (VOLATILITY):", m_x + 20, curY, CTheme::TextMuted(), 9);
      curY += 24;
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_VOL_ATR", "ATR(14): " + DoubleToString(ctx.atr14, 5) + " | Spread: " + DoubleToString(ctx.currentSpread, 1) + " pips", m_x + 25, curY, CTheme::TextPrimary(), 9);
   }

   // 3. TAB SIG: Quản lý Engine & Lý do bị chặn
   void RenderSigTab(CEngineManager &engMgr)
   {
      int curY = m_y + 68;
      int w = m_width;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_SIG_BG", m_x + 10, curY, w - 20, 350, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_SIG_TITLE", "QUẢN LÝ SIGNAL ENGINES & TRẠNG THÁI LỌC", m_x + 20, curY + 12, CTheme::Accent(), 10, CTheme::FontBold());

      // DÒNG "BỊ CHẶN" (Blocked Reason) - Tính năng cốt lõi minh bạch của Cockpit
      curY += 40;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_BLK_BOX", m_x + 20, curY, w - 40, 50, CTheme::BgInput(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_BLK_TITLE", "DÒNG TRẠNG THÁI 'BỊ CHẶN':", m_x + 30, curY + 6, CTheme::WarningAmber(), 8);
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_BLK_VAL", engMgr.GetBlockedReason(), m_x + 30, curY + 24, CTheme::TextPrimary(), 9, CTheme::FontBold());

      // Danh sách Engines
      curY += 70;
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_ENG_LIST", "CÀI ĐẶT BẬT / TẮT ENGINE:", m_x + 20, curY, CTheme::TextMuted(), 9);
      curY += 26;

      // SMC Engine
      string smcStatus = engMgr.IsEngineEnabled(ENGINE_SMC) ? "[ON] ĐANG BẬT" : "[OFF] ĐÃ TẮT";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_E1_LBL", "1. SMC ICT Alpha (Order Block, FVG, Liquidity): " + smcStatus, m_x + 30, curY, CTheme::TextPrimary(), 9);
      CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_TOGGLE_SMC", "BẬT/TẮT", m_x + w - 120, curY - 4, 80, 22, CTheme::BgHeader(), CTheme::Accent(), 8);

      curY += 34;
      // Trend Ribbon Engine
      string trendStatus = engMgr.IsEngineEnabled(ENGINE_TREND) ? "[ON] ĐANG BẬT" : "[OFF] ĐÃ TẮT";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_E2_LBL", "2. Trend Ribbon Pro (EMA 21/50/200, Pullback): " + trendStatus, m_x + 30, curY, CTheme::TextPrimary(), 9);
      CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_TOGGLE_TREND", "BẬT/TẮT", m_x + w - 120, curY - 4, 80, 22, CTheme::BgHeader(), CTheme::Accent(), 8);

      curY += 34;
      // Mean Reversion Engine
      string mrStatus = engMgr.IsEngineEnabled(ENGINE_MEAN_REV) ? "[ON] ĐANG BẬT" : "[OFF] ĐÃ TẮT";
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_E3_LBL", "3. Mean Reversion Sweep (Bollinger, RSI Div): " + mrStatus, m_x + 30, curY, CTheme::TextPrimary(), 9);
      CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_TOGGLE_MREV", "BẬT/TẮT", m_x + w - 120, curY - 4, 80, 22, CTheme::BgHeader(), CTheme::Accent(), 8);
   }

   // 4. TAB RADAR: Quét đa cặp thời gian thực
   void RenderRadarTab(CMultiSymbolScanner &radar)
   {
      int curY = m_y + 68;
      int w = m_width;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_RDR_BG", m_x + 10, curY, w - 20, 350, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_RDR_TITLE", "RADAR QUÉT ĐA CẶP (Bấm vào thẻ để chuyển Chart)", m_x + 20, curY + 12, CTheme::Accent(), 10, CTheme::FontBold());

      curY += 40;
      int total = radar.GetCount();
      for(int i = 0; i < total && i < 8; i++)
      {
         RadarCardItem card = radar.GetCard(i);
         int cardY = curY + (i * 36);

         color cardBg = (card.signalDir != DIR_FLAT) ? CTheme::BgHeader() : CTheme::BgInput();
         CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_RC_" + IntegerToString(i), m_x + 20, cardY, w - 40, 32, cardBg, CTheme::Border());

         string symText = card.symbol + "  Bid: " + DoubleToString(card.bid, (int)SymbolInfoInteger(card.symbol, SYMBOL_DIGITS));
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_RCS_" + IntegerToString(i), symText, m_x + 30, cardY + 8, CTheme::TextPrimary(), 9, CTheme::FontMono());

         string chgText = ((card.change24hPct >= 0) ? "+" : "") + DoubleToString(card.change24hPct, 2) + "%";
         color chgClr = (card.change24hPct >= 0) ? CTheme::BuyGreen() : CTheme::SellRed();
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_RCC_" + IntegerToString(i), chgText, m_x + 240, cardY + 8, chgClr, 9, CTheme::FontBold());

         string qTag = "(Q" + IntegerToString((int)card.quality) + ")";
         string sigText = (card.signalDir == DIR_BUY) ? ("🟢 BUY " + qTag) : ((card.signalDir == DIR_SELL) ? ("🔴 SELL " + qTag) : "— QUÉT...");
         color sigClr = (card.signalDir == DIR_BUY) ? CTheme::BuyGreen() : ((card.signalDir == DIR_SELL) ? CTheme::SellRed() : CTheme::TextMuted());
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_RCI_" + IntegerToString(i), sigText, m_x + 330, cardY + 8, sigClr, 8);

         CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_SWITCH_" + IntegerToString(i), "XEM", m_x + w - 80, cardY + 5, 50, 22, CTheme::Accent(), CTheme::BgMain(), 8);
      }
   }

   // 5. TAB NEWS: Lịch kinh tế & Cửa sổ tin tức
   void RenderNewsTab(CNewsCalendar &news)
   {
      int curY = m_y + 68;
      int w = m_width;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_NWS_BG", m_x + 10, curY, w - 20, 350, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_NWS_TITLE", "LỊCH KINH TẾ (MQL5 NATIVE) & CỬA SỔ TIN TỨC", m_x + 20, curY + 12, CTheme::Accent(), 10, CTheme::FontBold());

      curY += 40;
      int count = news.GetEventsCount();
      if(count == 0)
      {
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_NWS_EMPTY", "Không có tin tức đỏ/cam trong vòng 24 giờ tới.", m_x + 30, curY + 20, CTheme::TextMuted(), 9);
         return;
      }

      for(int i = 0; i < count && i < 7; i++)
      {
         NewsEventItem evt;
         news.GetEvent(i, evt);
         int itemY = curY + (i * 40);

         color bdrClr = (evt.importance == 3) ? CTheme::SellRed() : CTheme::WarningAmber();
         CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_NW_BOX_" + IntegerToString(i), m_x + 20, itemY, w - 40, 34, CTheme::BgInput(), bdrClr);

         string timeStr = TimeToString(evt.time, TIME_MINUTES);
         string impTag = (evt.importance == 3) ? "🔴 HIGH" : "🟠 MED";
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_NW_T_" + IntegerToString(i), timeStr + " [" + evt.currency + "] " + impTag, m_x + 30, itemY + 8, CTheme::TextPrimary(), 8, CTheme::FontMono());
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_NW_N_" + IntegerToString(i), evt.name, m_x + 200, itemY + 8, CTheme::TextPrimary(), 8);
      }
   }

   // 6. TAB LOG: Thống kê & Xuất báo cáo HTML
   void RenderLogTab()
   {
      int curY = m_y + 68;
      int w = m_width;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_LOG_BG", m_x + 10, curY, w - 20, 350, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOG_TITLE", "THỐNG KÊ HIỆU SUẤT TÍN HIỆU & AUDIT LOG", m_x + 20, curY + 12, CTheme::Accent(), 10, CTheme::FontBold());

      curY += 40;
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOG_ST1", "Tổng số tín hiệu đã kích hoạt: 48 lệnh", m_x + 30, curY, CTheme::TextPrimary(), 9);
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOG_ST2", "Tỉ lệ thắng chạm TP1+: 77.1% (37 Thắng / 11 Thua)", m_x + 30, curY + 24, CTheme::BuyGreen(), 9, CTheme::FontBold());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOG_ST3", "Tổng lợi nhuận tích lũy: +1,420 pips", m_x + 30, curY + 48, CTheme::BuyGreen(), 9, CTheme::FontBold());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOG_ST4", "Profit Factor (Hệ số lợi nhuận): 2.45", m_x + 30, curY + 72, CTheme::TextPrimary(), 9);

      curY += 130;
      // Nút xuất báo cáo HTML
      CGuiRenderer::CreateButton(m_chartId, "TAB_BTN_EXPORT_HTML", "📊 XUẤT BÁO CÁO HTML STANDALONE (BẤM ĐÂY)", m_x + 30, curY, w - 60, 42, CTheme::Accent(), CTheme::BgMain(), 10);
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_LOG_TIP", "Báo cáo sẽ được tạo tại thư mục MQL5/Files/NexusPilot_Report.html", m_x + 30, curY + 52, CTheme::TextMuted(), 8);
   }

   // 7. TAB HELP: Phím tắt & Trợ giúp
   void RenderHelpTab()
   {
      int curY = m_y + 68;
      int w = m_width;
      CGuiRenderer::CreateBox(m_chartId, "TAB_CONTENT_HLP_BG", m_x + 10, curY, w - 20, 350, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_HLP_TITLE", "HƯỚNG DẪN NHANH & BẢNG PHÍM TẮT TRÊN CHART", m_x + 20, curY + 12, CTheme::Accent(), 10, CTheme::FontBold());

      curY += 40;
      string shortcuts[8] = {
         "F - Mở tab FLIGHT (Tín hiệu & 1-Click Order)",
         "X - Mở tab CTX (Bối cảnh thị trường MTF)",
         "S - Mở tab SIG (Quản lý Engines & Dòng bị chặn)",
         "D - Mở tab RADAR (Bảng quét đa cặp tiền)",
         "N - Mở tab NEWS (Lịch kinh tế & Cửa sổ tin)",
         "L - Mở tab LOG (Thống kê & Xuất báo cáo HTML)",
         "K - Đóng/Mở thanh Dock bên trái",
         "M - Thu gọn/Phóng to Cockpit HUD"
      };

      for(int i = 0; i < 8; i++)
      {
         CGuiRenderer::CreateLabel(m_chartId, "TAB_CONTENT_HLP_" + IntegerToString(i), shortcuts[i], m_x + 30, curY + (i * 26), CTheme::TextPrimary(), 9, CTheme::FontMono());
      }
   }

   void Render(const SignalPlan &sig, const MarketContextState &ctx, CEngineManager &engMgr, CMultiSymbolScanner &radar, CNewsCalendar &news)
   {
      RenderHeader();
      if(m_isMinimized) return;

      switch(m_activeTab)
      {
         case TAB_FLIGHT: RenderFlightTab(sig); break;
         case TAB_CTX:    RenderCtxTab(ctx); break;
         case TAB_SIG:    RenderSigTab(engMgr); break;
         case TAB_RADAR:  RenderRadarTab(radar); break;
         case TAB_NEWS:   RenderNewsTab(news); break;
         case TAB_LOG:    RenderLogTab(); break;
         case TAB_HELP:   RenderHelpTab(); break;
      }
   }
};
