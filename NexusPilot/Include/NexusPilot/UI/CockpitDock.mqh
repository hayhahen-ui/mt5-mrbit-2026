//+------------------------------------------------------------------+
//|                                                 CockpitDock.mqh  |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"
#include "Theme.mqh"
#include "GuiRenderer.mqh"
#include "../Core/RiskManager.mqh"
#include "../Core/MarketContext.mqh"

class CCockpitDock
{
private:
   long   m_chartId;
   bool   m_isOpen;
   int    m_x, m_y, m_width, m_height;
   double m_scale;

public:
   CCockpitDock()
   {
      m_chartId = 0;
      m_isOpen  = false; // Mặc định thu gọn, bấm K để mở
      m_x       = 15;
      m_y       = 40;
      m_width   = 240;
      m_height  = 560;
      m_scale   = 1.0;
   }

   void Init(long chartId, double scale = 1.0)
   {
      m_chartId = chartId;
      m_scale   = scale;
      m_width   = CTheme::Scale(240, scale);
      m_height  = CTheme::Scale(560, scale);
   }

   bool IsOpen() const { return m_isOpen; }
   void Toggle()
   {
      m_isOpen = !m_isOpen;
      if(!m_isOpen)
      {
         Hide();
      }
   }

   void Hide()
   {
      // Xóa các object thuộc dock
      int total = ObjectsTotal(m_chartId, 0, -1);
      for(int i = total - 1; i >= 0; i--)
      {
         string name = ObjectName(m_chartId, i, 0, -1);
         if(StringFind(name, NP_PREFIX + "DOCK_") == 0)
         {
            ObjectDelete(m_chartId, name);
         }
      }
      ChartRedraw(m_chartId);
   }

   void Render(const AccountRiskStats &acc, const MarketContextState &ctx, double suggestedLot)
   {
      if(!m_isOpen) return;

      int w = m_width;
      int curY = m_y;

      // 1. Nền Dock
      CGuiRenderer::CreateBox(m_chartId, "DOCK_BG", m_x, curY, w, m_height, CTheme::BgMain(), CTheme::Border());
      
      // Header Dock
      CGuiRenderer::CreateBox(m_chartId, "DOCK_HDR", m_x, curY, w, 28, CTheme::BgHeader(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_TITLE", "⚡ NEXUS DOCK (Phím K)", m_x + 10, curY + 6, CTheme::Accent(), 9, CTheme::FontBold());
      CGuiRenderer::CreateButton(m_chartId, "DOCK_BTN_CLOSE", "✕", m_x + w - 26, curY + 4, 20, 20, CTheme::BgCard(), CTheme::TextMuted(), 9);
      curY += 34;

      // 2. KHỐI TÀI KHOẢN (ACCOUNT & PROP GUARD)
      CGuiRenderer::CreateBox(m_chartId, "DOCK_ACC_BG", m_x + 8, curY, w - 16, 75, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_ACC_LBL", "TÀI KHOẢN & RỦI RO", m_x + 14, curY + 5, CTheme::TextMuted(), 8);
      
      string balStr = "Balance: $" + DoubleToString(acc.balance, 2) + "  Eq: $" + DoubleToString(acc.equity, 2);
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_ACC_BAL", balStr, m_x + 14, curY + 22, CTheme::TextPrimary(), 8, CTheme::FontMono());

      string pnlStr = "PnL hôm nay: " + ((acc.dailyPnLPct >= 0) ? "+" : "") + DoubleToString(acc.dailyPnLPct, 2) + "%";
      color pnlClr = (acc.dailyPnLPct >= 0) ? CTheme::BuyGreen() : CTheme::SellRed();
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_ACC_PNL", pnlStr, m_x + 14, curY + 38, pnlClr, 8);

      string guardStr = acc.isPropFirmGuardLocked ? "🔒 PROP GUARD: LOCKED (Vượt DD)" : "🛡️ PROP GUARD: SAFE (An toàn)";
      color guardClr = acc.isPropFirmGuardLocked ? CTheme::SellRed() : CTheme::BuyGreen();
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_ACC_GUARD", guardStr, m_x + 14, curY + 54, guardClr, 8);
      curY += 83;

      // 3. KHỐI PHIÊN & NẾN (SESSIONS & CANDLE TIMER)
      CGuiRenderer::CreateBox(m_chartId, "DOCK_SES_BG", m_x + 8, curY, w - 16, 68, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_SES_LBL", "PHIÊN GIAO DỊCH & NẾN", m_x + 14, curY + 5, CTheme::TextMuted(), 8);

      // Session Badges
      string sydBadge = ctx.sessionSydney  ? "SYD: ON " : "syd: off ";
      string tkyBadge = ctx.sessionTokyo   ? "TKY: ON " : "tky: off ";
      string lonBadge = ctx.sessionLondon  ? "LON: ON " : "lon: off ";
      string nyBadge  = ctx.sessionNewYork ? "NY: ON"   : "ny: off";
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_SES_1", sydBadge + " | " + tkyBadge, m_x + 14, curY + 23, CTheme::TextPrimary(), 8, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_SES_2", lonBadge + " | " + nyBadge, m_x + 14, curY + 38, CTheme::TextPrimary(), 8, CTheme::FontMono());

      int remMin = ctx.candleRemainingSec / 60;
      int remSec = ctx.candleRemainingSec % 60;
      string timerStr = "Đóng nến: " + StringFormat("%02d:%02d", remMin, remSec);
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_SES_TIMER", timerStr, m_x + 14, curY + 52, CTheme::Accent(), 8);
      curY += 76;

      // 4. KHỐI XU HƯỚNG ĐA KHUNG (MTF TREND)
      CGuiRenderer::CreateBox(m_chartId, "DOCK_MTF_BG", m_x + 8, curY, w - 16, 60, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_MTF_LBL", "XU HƯỚNG ĐA KHUNG (MTF)", m_x + 14, curY + 5, CTheme::TextMuted(), 8);
      
      string mtfText = "M15: " + TrendIcon(ctx.trendM15) + "   H1: " + TrendIcon(ctx.trendH1) + "   H4: " + TrendIcon(ctx.trendH4) + "   D1: " + TrendIcon(ctx.trendD1);
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_MTF_VAL", mtfText, m_x + 14, curY + 25, CTheme::TextPrimary(), 9, CTheme::FontMono());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_MTF_SUB", "Spread: " + DoubleToString(ctx.currentSpread, 1) + " pips (TB: " + DoubleToString(ctx.averageSpread, 1) + ")", m_x + 14, curY + 42, CTheme::TextMuted(), 8);
      curY += 68;

      // 5. KHỐI MÁY TÍNH RỦI RO (CALC LOT)
      CGuiRenderer::CreateBox(m_chartId, "DOCK_CALC_BG", m_x + 8, curY, w - 16, 60, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_CALC_LBL", "MÁY TÍNH LOT (CALC)", m_x + 14, curY + 5, CTheme::TextMuted(), 8);
      string lotStr = "Lot đề xuất: " + DoubleToString(suggestedLot, 2) + " (Risk 1.0%)";
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_CALC_LOT", lotStr, m_x + 14, curY + 24, CTheme::BuyGreen(), 9, CTheme::FontBold());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_CALC_TIP", "Tự điều chỉnh theo StopLoss & Vốn", m_x + 14, curY + 42, CTheme::TextMuted(), 8);
      curY += 68;

      // 6. KHỐI CẢNH BÁO TELEGRAM (ALERTS)
      CGuiRenderer::CreateBox(m_chartId, "DOCK_ALT_BG", m_x + 8, curY, w - 16, 65, CTheme::BgCard(), CTheme::Border());
      CGuiRenderer::CreateLabel(m_chartId, "DOCK_ALT_LBL", "KÊNH CẢNH BÁO", m_x + 14, curY + 5, CTheme::TextMuted(), 8);
      CGuiRenderer::CreateButton(m_chartId, "DOCK_BTN_TEST_TG", "🔔 BẤM TEST TELEGRAM", m_x + 14, curY + 26, w - 28, 26, CTheme::Accent(), CTheme::TextPrimary(), 8);
      curY += 73;

      // 7. NÚT ĐÓNG LỆNH KHẨN CẤP (EMERGENCY CLOSE ALL)
      CGuiRenderer::CreateButton(m_chartId, "DOCK_BTN_CLOSE_ALL", "⚠️ ĐÓNG TOÀN BỘ LỆNH (CLOSE ALL)", m_x + 8, curY, w - 16, 30, CTheme::SellRed(), CTheme::TextPrimary(), 8);
   }

   string TrendIcon(int tr)
   {
      if(tr > 0) return "▲TĂNG";
      if(tr < 0) return "▼GIẢM";
      return "—NGANG";
   }
};
