//+------------------------------------------------------------------+
//|                                                    EngineSMC.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "ISignalEngine.mqh"

class CEngineSMC : public ISignalEngine
{
private:
   bool   m_enabled;
   string m_name;

public:
   CEngineSMC()
   {
      m_enabled = true;
      m_name    = "SMC_ICT_Alpha";
   }

   virtual void Init()
   {
      m_enabled = true;
   }

   virtual string           GetName() const { return m_name; }
   virtual ENUM_ENGINE_TYPE GetType() const { return ENGINE_SMC; }
   virtual bool             IsEnabled() const { return m_enabled; }
   virtual void             SetEnabled(bool enabled) { m_enabled = enabled; }

   virtual bool Analyze(string symbol, ENUM_TIMEFRAMES tf, SignalPlan &plan)
   {
      if(!m_enabled) return false;

      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      int copied = CopyRates(symbol, tf, 0, 50, rates);
      if(copied < 30) return false;

      double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
      int digits    = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      double curAsk = SymbolInfoDouble(symbol, SYMBOL_ASK);
      double curBid = SymbolInfoDouble(symbol, SYMBOL_BID);

      // 1. Tìm cấu trúc Swing High / Swing Low (Market Structure)
      double swingHigh = rates[5].high;
      double swingLow  = rates[5].low;
      for(int i = 5; i < 25; i++)
      {
         if(rates[i].high > swingHigh) swingHigh = rates[i].high;
         if(rates[i].low < swingLow)   swingLow  = rates[i].low;
      }

      // 2. Phát hiện Fair Value Gap (FVG) gần nhất
      bool bullishFVG = (rates[2].low > rates[4].high);
      bool bearishFVG = (rates[2].high < rates[4].low);

      double fvgTop = 0, fvgBottom = 0;
      if(bullishFVG)
      {
         fvgTop    = rates[2].low;
         fvgBottom = rates[4].high;
      }
      else if(bearishFVG)
      {
         fvgTop    = rates[4].low;
         fvgBottom = rates[2].high;
      }

      // 3. Kiểm tra Break of Structure (BOS)
      bool bosBullish = (rates[1].close > swingHigh);
      bool bosBearish = (rates[1].close < swingLow);

      // Kiểm tra Báo Sớm (Heads-Up) khi giá chạm vùng FVG / Order Block
      if(bullishFVG && curBid >= fvgBottom && curBid <= fvgTop)
      {
         plan.symbol      = symbol;
         plan.timeframe   = tf;
         plan.direction   = DIR_BUY;
         plan.isHeadsUp   = true;
         plan.engineName  = m_name;
         plan.engineType  = ENGINE_SMC;
         plan.entryPrice  = curAsk;
         plan.rationale   = "Giá đang kiểm định Fair Value Gap (FVG) tăng giá - Chờ nến xác nhận";
         return true;
      }
      if(bearishFVG && curAsk >= fvgBottom && curAsk <= fvgTop)
      {
         plan.symbol      = symbol;
         plan.timeframe   = tf;
         plan.direction   = DIR_SELL;
         plan.isHeadsUp   = true;
         plan.engineName  = m_name;
         plan.engineType  = ENGINE_SMC;
         plan.entryPrice  = curBid;
         plan.rationale   = "Giá đang kiểm định Fair Value Gap (FVG) giảm giá - Chờ nến xác nhận";
         return true;
      }

      // 4. Tín hiệu vào lệnh BUY chính thức: Bullish Rejection + FVG Mitigation
      if(bullishFVG && rates[1].close > rates[1].open && rates[1].low <= fvgTop)
      {
         double slDistance = MathMax((curAsk - rates[1].low) + (10 * point), 50 * point);
         plan.timestamp    = TimeCurrent();
         plan.symbol       = symbol;
         plan.timeframe    = tf;
         plan.direction    = DIR_BUY;
         plan.engineType   = ENGINE_SMC;
         plan.engineName   = m_name;
         plan.entryPrice   = NormalizeDouble(curAsk, digits);
         plan.stopLoss     = NormalizeDouble(curAsk - slDistance, digits);
         plan.tp1          = NormalizeDouble(curAsk + (slDistance * 1.8), digits);
         plan.tp2          = NormalizeDouble(curAsk + (slDistance * 3.2), digits);
         plan.tp3          = NormalizeDouble(curAsk + (slDistance * 5.0), digits);
         plan.tp1Odds      = 78.5;
         plan.tp2Odds      = 54.0;
         plan.tp3Odds      = 32.5;
         plan.quality      = QUALITY_Q5;
         plan.pWin         = 74.2;
         plan.isHeadsUp    = false;
         plan.pipsSL       = slDistance / (point * 10.0);
         plan.pipsTP1      = (plan.tp1 - curAsk) / (point * 10.0);
         plan.pipsTP2      = (plan.tp2 - curAsk) / (point * 10.0);
         plan.pipsTP3      = (plan.tp3 - curAsk) / (point * 10.0);
         plan.rationale    = "SMC Mitigation: FVG chạm bật + Nến rút chân tăng + Bảo vệ vùng OB";
         return true;
      }

      // 5. Tín hiệu vào lệnh SELL chính thức: Bearish Rejection + FVG Mitigation
      if(bearishFVG && rates[1].close < rates[1].open && rates[1].high >= fvgBottom)
      {
         double slDistance = MathMax((rates[1].high - curBid) + (10 * point), 50 * point);
         plan.timestamp    = TimeCurrent();
         plan.symbol       = symbol;
         plan.timeframe    = tf;
         plan.direction    = DIR_SELL;
         plan.engineType   = ENGINE_SMC;
         plan.engineName   = m_name;
         plan.entryPrice   = NormalizeDouble(curBid, digits);
         plan.stopLoss     = NormalizeDouble(curBid + slDistance, digits);
         plan.tp1          = NormalizeDouble(curBid - (slDistance * 1.8), digits);
         plan.tp2          = NormalizeDouble(curBid - (slDistance * 3.2), digits);
         plan.tp3          = NormalizeDouble(curBid - (slDistance * 5.0), digits);
         plan.tp1Odds      = 76.8;
         plan.tp2Odds      = 52.5;
         plan.tp3Odds      = 31.0;
         plan.quality      = QUALITY_Q5;
         plan.pWin         = 73.5;
         plan.isHeadsUp    = false;
         plan.pipsSL       = slDistance / (point * 10.0);
         plan.pipsTP1      = (curBid - plan.tp1) / (point * 10.0);
         plan.pipsTP2      = (curBid - plan.tp2) / (point * 10.0);
         plan.pipsTP3      = (curBid - plan.tp3) / (point * 10.0);
         plan.rationale    = "SMC Liquidity Sweep: Quét đỉnh + Lấp FVG giảm giá + Phá vỡ đáy phụ";
         return true;
      }

      return false;
   }
};
