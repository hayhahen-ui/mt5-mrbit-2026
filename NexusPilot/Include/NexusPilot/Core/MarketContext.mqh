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

   // Hậu tố symbol của broker (vd: "" | ".pro" | "m") — suy từ _Symbol hiện tại
   // (giả định tên gốc dài 6 ký tự như EURUSD, XAUUSD).
   string BrokerSuffix()
   {
      if(StringLen(_Symbol) <= 6) return "";
      return StringSubstr(_Symbol, 6);
   }

   // % thay đổi giá đóng cửa D1 (nến 1 so với nến 2); EMPTY_VALUE nếu không lấy được.
   double DailyChangePct(string sym)
   {
      double c1 = iClose(sym, PERIOD_D1, 1);
      double c2 = iClose(sym, PERIOD_D1, 2);
      if(c1 <= 0.0 || c2 <= 0.0) return EMPTY_VALUE;
      return (c1 - c2) / c2 * 100.0;
   }

   // Thứ hạng quy ước đặt cặp tiền (base đứng trước): EUR>GBP>AUD>NZD>USD>CAD>CHF>JPY
   int CurrencyRank(string cur)
   {
      if(cur == "EUR") return 0;
      if(cur == "GBP") return 1;
      if(cur == "AUD") return 2;
      if(cur == "NZD") return 3;
      if(cur == "USD") return 4;
      if(cur == "CAD") return 5;
      if(cur == "CHF") return 6;
      return 7; // JPY
   }

   // Đo lường sức mạnh tiền tệ (Currency Strength Meter) từ GIÁ THẬT.
   // FIX 19/10/2026 (audit): bỏ công thức giả lập cũ (sin theo giờ) — thay bằng
   // trung bình % thay đổi D1 của 7 cặp chéo liên quan (dấu + khi là base, - khi là quote),
   // chuẩn hóa về thang 0-100. Tính tối đa 1 lần/phút để nhẹ CPU.
   void UpdateCurrencyStrength()
   {
      static datetime lastCalc = 0;
      datetime now = TimeCurrent();
      if(now - lastCalc < 60) return;
      lastCalc = now;

      string majors[8] = {"USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"};
      string suffix = BrokerSuffix();
      for(int i = 0; i < 8; i++)
      {
         m_state.csm[i].currency = majors[i];
         double sum = 0.0;
         int cnt = 0;
         for(int j = 0; j < 8; j++)
         {
            if(j == i) continue;
            string a = majors[i], b = majors[j];
            bool iIsBase = (CurrencyRank(a) < CurrencyRank(b));
            string base  = (iIsBase ? a : b);
            string quote = (iIsBase ? b : a);
            string pair = base + quote + suffix;
            MqlTick tk;
            if(!SymbolInfoTick(pair, tk))
            {
               pair = base + quote; // thử lại không hậu tố
               if(!SymbolInfoTick(pair, tk)) continue;
            }
            double chg = DailyChangePct(pair);
            if(chg == EMPTY_VALUE) continue;
            sum += (iIsBase ? chg : -chg);
            cnt++;
         }
         double score = 50.0;
         if(cnt > 0) score = 50.0 + (sum / cnt) * 10.0; // mỗi 0.1% ~ 1 điểm
         if(score > 95.0) score = 95.0;
         if(score < 5.0) score = 5.0;
         m_state.csm[i].score = score;
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
      // FIX 19/10/2026 (audit): averageSpread phải là trung bình trượt thật (EMA chậm),
      // không được gán = currentSpread * 1.05 — nếu không điều kiện lọc giãn spread
      // (currentSpread > averageSpread * 2.5 trong EngineManager) không bao giờ kích hoạt.
      if(m_state.averageSpread <= 0.0)
         m_state.averageSpread = m_state.currentSpread;
      else
         m_state.averageSpread = m_state.averageSpread * 0.98 + m_state.currentSpread * 0.02;

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
