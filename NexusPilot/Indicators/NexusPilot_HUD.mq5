//+------------------------------------------------------------------+
//|                                               NexusPilot_HUD.mq5 |
//|                                  NexusPilot NextGen Architecture |
//|                       Copyright 2026, NexusPilot Open Trading AI |
//+------------------------------------------------------------------+
#property copyright   "NexusPilot Open Trading AI"
#property link        "https://github.com/nexuspilot"
#property version     NEXUSPILOT_VERSION
#property description "NexusPilot Pro HUD: Pure Indicator Version for Visual Cockpit & Multi-Symbol Radar"
#property indicator_chart_window
#property indicator_plots 0

//+------------------------------------------------------------------+
//| Includes                                                         |
//+------------------------------------------------------------------+
#include "../Include/NexusPilot/Defines.mqh"
#include "../Include/NexusPilot/Core/RiskManager.mqh"
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
input ENUM_APP_LANG InpLang         = LANG_VI;
input string        InpSymbols      = "";
input double        InpRiskPct      = 1.0;
input double        InpDashScale    = 1.1;

sinput group "=== [2. CẢNH BÁO / ALERTS] ==="
input bool          InpAlertPopup   = true;
input bool          InpAlertPush    = false;
input bool          InpAlertSound   = true;

sinput group "=== [3. TELEGRAM (NATIVE - ZERO DLL)] ==="
input bool          InpTgEnable     = false;
input string        InpTgToken      = "";
input string        InpTgChatID     = "";
input int           InpTgTopicGold  = 0;
input int           InpTgTopicForex = 0;
input int           InpTgTopicCrypto= 0;
input int           InpTgTzOffset   = 7;
input string        InpTgTzLabel    = "VN";

//+------------------------------------------------------------------+
//| Global Instances                                                 |
//+------------------------------------------------------------------+
CRiskManager         g_riskMgr;
CMarketContext       g_mktCtx;
CNewsCalendar        g_newsCal;
CEngineManager       g_engMgr;
CMultiSymbolScanner  g_radar;
CTelegramNotifier    g_telegram;
CCockpitDock         g_dock;
CCockpitTabs         g_hud;

datetime             g_lastScanTime = 0;

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("[NexusPilot HUD] Khởi tạo Indicator Cockpit v", NEXUSPILOT_VERSION);

   g_riskMgr.Init(InpRiskPct, 4.0);
   g_mktCtx.Init(_Symbol, 2);
   g_newsCal.Init(30, 15, true);
   g_engMgr.Init();
   g_radar.Init(InpSymbols);
   g_telegram.Init(InpTgEnable, InpTgToken, InpTgChatID, InpTgTopicGold, InpTgTopicForex, InpTgTopicCrypto, InpTgTzOffset, InpTgTzLabel);

   g_dock.Init(0, InpDashScale);
   g_hud.Init(0, InpDashScale);

   EventSetMillisecondTimer(350);

   g_engMgr.Analyze(_Symbol, _Period, g_riskMgr, g_newsCal, g_mktCtx);
   RedrawAll();

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   CGuiRenderer::DestroyAll(0);
}

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   return rates_total;
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   g_mktCtx.Update();
   g_riskMgr.UpdateAccountMetrics();

   if(TimeCurrent() - g_lastScanTime >= 5)
   {
      g_lastScanTime = TimeCurrent();
      g_radar.ScanAll();
      g_engMgr.Analyze(_Symbol, _Period, g_riskMgr, g_newsCal, g_mktCtx);
   }

   RedrawAll();
}

//+------------------------------------------------------------------+
//| Redraw GUI                                                       |
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
//| ChartEvent function                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == NP_PREFIX + "DOCK_BTN_CLOSE")
      {
         g_dock.Toggle();
         RedrawAll();
         return;
      }
      if(sparam == NP_PREFIX + "DOCK_BTN_TEST_TG")
      {
         if(g_telegram.TestConnection()) Alert("NexusPilot HUD: Kết nối Telegram thành công!");
         else Alert("NexusPilot HUD: Thất bại! Xem tab Experts.");
         return;
      }
      if(sparam == NP_PREFIX + "HUD_BTN_MIN" || sparam == NP_PREFIX + "HUD_BTN_CLOSE")
      {
         g_hud.ToggleMinimize();
         RedrawAll();
         return;
      }
      for(int i = 0; i < 7; i++)
      {
         if(sparam == NP_PREFIX + "HUD_TAB_BTN_" + IntegerToString(i))
         {
            g_hud.SetActiveTab((ENUM_COCKPIT_TAB)i);
            RedrawAll();
            return;
         }
      }
      if(sparam == NP_PREFIX + "TAB_BTN_EXPORT_HTML")
      {
         if(CHtmlReportExporter::ExportReport()) Alert("NexusPilot HUD: Đã xuất báo cáo HTML tại MQL5/Files/NexusPilot_Report.html");
         return;
      }
      for(int r = 0; r < 8; r++)
      {
         if(sparam == NP_PREFIX + "TAB_BTN_SWITCH_" + IntegerToString(r))
         {
            g_radar.SwitchChartToSymbol(r);
            return;
         }
      }
   }
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
         case 'R': case 'r': CHtmlReportExporter::ExportReport(); break;
      }
   }
}
//+------------------------------------------------------------------+
