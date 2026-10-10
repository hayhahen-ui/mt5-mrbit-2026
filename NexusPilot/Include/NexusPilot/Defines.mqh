//+------------------------------------------------------------------+
//|                                                      Defines.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property link      "https://github.com/nexuspilot"
#property strict

#define NEXUSPILOT_VERSION "3.00-NextGen"
#define NP_PREFIX          "NP_"
#define MAX_RADAR_SYMBOLS  20
#define MAX_RECENT_SIGNALS 10
#define TELEGRAM_MAX_LEN   4096

//+------------------------------------------------------------------+
//| Enumerations                                                     |
//+------------------------------------------------------------------+
enum ENUM_APP_LANG
{
   LANG_EN = 0, // English
   LANG_VI = 1  // Tiếng Việt
};

enum ENUM_COCKPIT_TAB
{
   TAB_FLIGHT = 0, // FLIGHT (F) - Tín hiệu & Kế hoạch vào lệnh
   TAB_CTX    = 1, // CTX (X) - Bối cảnh thị trường MTF & Phiên
   TAB_SIG    = 2, // SIG (S) - Quản lý Engines & Lý do chặn
   TAB_RADAR  = 3, // RADAR (D) - Quét đa cặp thời gian thực
   TAB_NEWS   = 4, // NEWS (N) - Lịch kinh tế & Cửa sổ tin tức
   TAB_LOG    = 5, // LOG (L) - Thống kê tín hiệu & Xuất báo cáo HTML
   TAB_HELP   = 6  // HELP (H) - Hướng dẫn & Phím tắt
};

enum ENUM_SIGNAL_DIR
{
   DIR_FLAT = 0,
   DIR_BUY  = 1,
   DIR_SELL = -1
};

enum ENUM_SIGNAL_QUALITY
{
   QUALITY_Q1 = 1, // Basic (Confluence thấp)
   QUALITY_Q2 = 2, // Fair
   QUALITY_Q3 = 3, // Good (Đủ điều kiện tiêu chuẩn)
   QUALITY_Q4 = 4, // High Confluence (Đa khung + Khối lượng)
   QUALITY_Q5 = 5  // Prime / Best Grade (Hội tụ toàn diện)
};

enum ENUM_ENGINE_TYPE
{
   ENGINE_SMC      = 0, // Smart Money Concepts (BOS, FVG, OB, Sweep)
   ENGINE_TREND    = 1, // Trend Momentum & Volatility Breakout
   ENGINE_MEAN_REV = 2  // Mean Reversion & Liquidity Sweep
};

enum ENUM_EXECUTION_MODE
{
   EXEC_MANUAL_ASSIST = 0, // Cockpit HUD trợ lý (Vào lệnh tay)
   EXEC_ONE_CLICK     = 1, // 1-Click Execution trực tiếp trên Cockpit
   EXEC_SEMI_AUTO     = 2  // Tự động phân chia 3 lệnh TP1/2/3 & Move BE
};

//+------------------------------------------------------------------+
//| Structures                                                       |
//+------------------------------------------------------------------+
struct SignalPlan
{
   datetime            timestamp;
   string              symbol;
   ENUM_TIMEFRAMES     timeframe;
   ENUM_SIGNAL_DIR     direction;
   ENUM_ENGINE_TYPE    engineType;
   string              engineName;
   double              entryPrice;
   double              stopLoss;
   double              tp1;
   double              tp2;
   double              tp3;
   double              tp1Odds;      // Xác suất chạm TP1 (0-100%)
   double              tp2Odds;      // Xác suất chạm TP2 (0-100%)
   double              tp3Odds;      // Xác suất chạm TP3 (0-100%)
   ENUM_SIGNAL_QUALITY quality;      // Q1 - Q5
   double              pWin;         // Ước tính win rate (%)
   bool                isHeadsUp;    // Báo sớm (giá vào vùng quan tâm AOI)
   double              pipsSL;
   double              pipsTP1;
   double              pipsTP2;
   double              pipsTP3;
   double              suggestedLot;
   string              rationale;
   bool                isBlocked;    // Có đang bị chặn không
   string              blockedReason;// Lý do không vào lệnh
   
   void Reset()
   {
      timestamp     = 0;
      symbol        = "";
      timeframe     = PERIOD_CURRENT;
      direction     = DIR_FLAT;
      engineType    = ENGINE_SMC;
      engineName    = "None";
      entryPrice    = 0.0;
      stopLoss      = 0.0;
      tp1           = 0.0;
      tp2           = 0.0;
      tp3           = 0.0;
      tp1Odds       = 0.0;
      tp2Odds       = 0.0;
      tp3Odds       = 0.0;
      quality       = QUALITY_Q1;
      pWin          = 0.0;
      isHeadsUp     = false;
      pipsSL        = 0.0;
      pipsTP1       = 0.0;
      pipsTP2       = 0.0;
      pipsTP3       = 0.0;
      suggestedLot  = 0.01;
      rationale     = "";
      isBlocked     = false;
      blockedReason = "None";
   }
};

struct CurrencyStrength
{
   string currency;
   double score; // 0 - 100
};

struct MarketContextState
{
   int    trendM15;          // 1 = Bull, -1 = Bear, 0 = Sideway
   int    trendH1;
   int    trendH4;
   int    trendD1;
   double currentSpread;
   double averageSpread;
   double atr14;
   int    candleRemainingSec;
   bool   sessionSydney;
   bool   sessionTokyo;
   bool   sessionLondon;
   bool   sessionNewYork;
   CurrencyStrength csm[8];  // USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD
   bool   isNewsBlocked;
   string upcomingNewsTitle;
   int    minutesToNews;
};

struct RadarCardItem
{
   string          symbol;
   double          bid;
   double          ask;
   double          change24hPct;
   double          spreadPips;
   int             trendBias;    // 1 Bull, -1 Bear, 0 Flat
   ENUM_SIGNAL_DIR signalDir;
   string          signalEngine;
   ENUM_SIGNAL_QUALITY quality;
   double          pWin;
   bool            hasAlert;
};

struct NewsEventItem
{
   datetime time;
   string   currency;
   int      importance; // 1 = Low, 2 = Medium, 3 = High
   string   name;
   double   actual;
   double   forecast;
   double   previous;
   bool     isWindowActive;
};

struct AccountRiskStats
{
   double balance;
   double equity;
   double freeMargin;
   double marginLevel;
   int    leverage;
   double dailyStartingEquity;
   double dailyPnLPct;
   double dailyMaxDDPct;
   bool   isPropFirmGuardLocked;
};

struct SignalAuditLog
{
   datetime        time;
   string          symbol;
   ENUM_SIGNAL_DIR dir;
   string          engine;
   double          entry;
   double          sl;
   double          tp;
   ENUM_SIGNAL_QUALITY quality;
   bool            isWin;
   double          pipsResult;
   double          profitAmount;
};
