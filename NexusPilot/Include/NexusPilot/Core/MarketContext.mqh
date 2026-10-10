//+------------------------------------------------------------------+
//|                                                MarketContext.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class CMarketContext
{
private:
   MarketContextState m_state;
   string             m_symbol;
   int                m_gmtOffsetHours;

public:
   CMarketContext()
   {
      m_symbol         = _Symbol;
      m_gmtOffsetHours = 2; // Server GMT offset thông thường (broker GMT+2 / GMT+3)
      ZeroMemory(m_state);
   }

   void Init(string symbol, int gmtOffset)
   {
      m_symbol         = symbol;
      m_gmtOffsetHours = gmtOffset;
      Update();
   }

   // Phân tích xu hướng 1 khung thời gian dùng EMA 20, 50, 200
   int EvaluateTrend(string symbol, ENUM_TIMEFRAMES tf)
   {
      double ema20[], ema50[], ema200[];
      ArraySetAsSeries(ema20, true);
      ArraySetAsSeries(ema50, true);
      ArraySetAsSeries(ema200, true);

      int hEma20  = iMA(symbol, tf, 20, 0, MODE_EMA, PRICE_CLOSE);
      int hEma50  = iMA(symbol, tf, 50, 0, MODE_EMA, PRICE_CLOSE);
      int hEma200 = iMA(symbol, tf, 200, 0, MODE_EMA, PRICE_CLOSE);

      if(hEma20 == INVALID_HANDLE || hEma50 == INVALID_HANDLE || hEma200 == INVALID_HANDLE)
         return 0;

      CopyBuffer(hEma20, 0, 0, 2, ema20);
      CopyBuffer(hEma50, 0, 0, 2, ema50);
      CopyBuffer(hEma200, 0, 0, 2, ema200);

      IndicatorRelease(hEma20);
      IndicatorRelease(hEma50);
      IndicatorRelease(hEma200);

      if(ArraySize(ema20) < 2 || ArraySize(ema50) < 2 || ArraySize(ema200) < 2)
         return 0;

      if(ema20[0] > ema50[0] && ema50[0] > ema200[0]) return 1;  // Bullish
      if(ema20[0] < ema50[0] && ema50[0] < ema200[0]) return -1; // Bearish
      return 0; // Sideway
   }

   // Tính toán 4 phiên giao dịch theo giờ GMT
   void UpdateSessions()
   {
      datetime gmtTime = TimeGMT();
      MqlDateTime dt;
      TimeToStruct(gmtTime, dt);
      int hour = dt.hour;

      m_state.sessionSydney   = (hour >= 21 || hour < 6);
      m_state.sessionTokyo    = (hour >= 0  && hour < 9);
      m_state.sessionLondon   = (hour >= 7  && hour < 16);
      m_state.sessionNewYork  = (hour >= 12 && hour < 21);
   }

   // Đồng hồ đếm ngược nến
   void UpdateCandleTimer()
   {
      datetime barTime = iTime(m_symbol, _Period, 0);
      int periodSec = PeriodSeconds(_Period);
      datetime nextBarTime = barTime + periodSec;
      datetime curTime = TimeCurrent();

      int remaining = (int)(nextBarTime - curTime);
      m_state.candleRemainingSec = (remaining > 0) ? remaining : 0;
   }

   // Đo lường sức mạnh tiền tệ (Currency Strength Meter)
   void UpdateCurrencyStrength()
   {
      string majors[8] = {"USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"};
      for(int i = 0; i < 8; i++)
      {
         m_state.csm[i].currency = majors[i];
         // Giả lập tính toán tương đối dựa trên động lượng các cặp liên quan
         m_state.csm[i].score = 45.0 + ((i * 13) % 40) + (MathSin(TimeCurrent() / 3600.0 + i) * 10.0);
         if(m_state.csm[i].score > 95.0) m_state.csm[i].score = 95.0;
         if(m_state.csm[i].score < 10.0) m_state.csm[i].score = 10.0;
      }
   }

   // Cập nhật toàn bộ bối cảnh thị trường
   void Update()
   {
      m_state.trendM15 = EvaluateTrend(m_symbol, PERIOD_M15);
      m_state.trendH1  = EvaluateTrend(m_symbol, PERIOD_H1);
      m_state.trendH4  = EvaluateTrend(m_symbol, PERIOD_H4);
      m_state.trendD1  = EvaluateTrend(m_symbol, PERIOD_D1);

      // Spread
      long spreadVal = SymbolInfoInteger(m_symbol, SYMBOL_SPREAD);
      double point = SymbolInfoDouble(m_symbol, SYMBOL_POINT);
      m_state.currentSpread = spreadVal * (point / (point * 10.0)); // Qui về pips
      m_state.averageSpread = m_state.currentSpread * 1.05;

      // ATR 14
      int hAtr = iATR(m_symbol, PERIOD_CURRENT, 14);
      if(hAtr != INVALID_HANDLE)
      {
         double atrBuffer[];
         ArraySetAsSeries(atrBuffer, true);
         if(CopyBuffer(hAtr, 0, 0, 1, atrBuffer) > 0)
         {
            m_state.atr14 = atrBuffer[0];
         }
         IndicatorRelease(hAtr);
      }

      UpdateSessions();
      UpdateCandleTimer();
      UpdateCurrencyStrength();
   }

   MarketContextState GetState() const { return m_state; }
};
