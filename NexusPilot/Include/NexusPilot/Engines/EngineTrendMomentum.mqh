//+------------------------------------------------------------------+
//|                                        EngineTrendMomentum.mqh   |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "ISignalEngine.mqh"

class CEngineTrendMomentum : public ISignalEngine
{
private:
   bool   m_enabled;
   string m_name;

public:
   CEngineTrendMomentum()
   {
      m_enabled = true;
      m_name    = "Trend_Ribbon_Pro";
   }

   virtual void Init()
   {
      m_enabled = true;
   }

   virtual string           GetName() const { return m_name; }
   virtual ENUM_ENGINE_TYPE GetType() const { return ENGINE_TREND; }
   virtual bool             IsEnabled() const { return m_enabled; }
   virtual void             SetEnabled(bool enabled) { m_enabled = enabled; }

   virtual bool Analyze(string symbol, ENUM_TIMEFRAMES tf, SignalPlan &plan)
   {
      if(!m_enabled) return false;

      double ema21[], ema50[], ema200[];
      ArraySetAsSeries(ema21, true);
      ArraySetAsSeries(ema50, true);
      ArraySetAsSeries(ema200, true);

      int h21  = iMA(symbol, tf, 21, 0, MODE_EMA, PRICE_CLOSE);
      int h50  = iMA(symbol, tf, 50, 0, MODE_EMA, PRICE_CLOSE);
      int h200 = iMA(symbol, tf, 200, 0, MODE_EMA, PRICE_CLOSE);

      if(h21 == INVALID_HANDLE || h50 == INVALID_HANDLE || h200 == INVALID_HANDLE)
         return false;

      CopyBuffer(h21, 0, 0, 3, ema21);
      CopyBuffer(h50, 0, 0, 3, ema50);
      CopyBuffer(h200, 0, 0, 3, ema200);

      IndicatorRelease(h21);
      IndicatorRelease(h50);
      IndicatorRelease(h200);

      if(ArraySize(ema21) < 3 || ArraySize(ema50) < 3 || ArraySize(ema200) < 3)
         return false;

      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      if(CopyRates(symbol, tf, 0, 5, rates) < 5) return false;

      double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
      int digits    = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      double curAsk = SymbolInfoDouble(symbol, SYMBOL_ASK);
      double curBid = SymbolInfoDouble(symbol, SYMBOL_BID);

      // 1. Kiểm tra xu hướng tăng mạnh: EMA 21 > EMA 50 > EMA 200
      bool isStrongUp = (ema21[0] > ema50[0] && ema50[0] > ema200[0]);
      // Pullback về dải EMA 21 - EMA 50 và đóng nến xanh bật tăng
      if(isStrongUp && rates[1].low <= ema21[1] && rates[1].close > ema21[0] && rates[1].close > rates[1].open)
      {
         double slDistance = MathMax(curAsk - ema50[0] + (15 * point), 40 * point);
         plan.timestamp    = TimeCurrent();
         plan.symbol       = symbol;
         plan.timeframe    = tf;
         plan.direction    = DIR_BUY;
         plan.engineType   = ENGINE_TREND;
         plan.engineName   = m_name;
         plan.entryPrice   = NormalizeDouble(curAsk, digits);
         plan.stopLoss     = NormalizeDouble(curAsk - slDistance, digits);
         plan.tp1          = NormalizeDouble(curAsk + (slDistance * 1.5), digits);
         plan.tp2          = NormalizeDouble(curAsk + (slDistance * 2.5), digits);
         plan.tp3          = NormalizeDouble(curAsk + (slDistance * 4.0), digits);
         plan.tp1Odds      = 81.0;
         plan.tp2Odds      = 58.0;
         plan.tp3Odds      = 35.0;
         plan.quality      = QUALITY_Q4;
         plan.pWin         = 71.5;
         plan.isHeadsUp    = false;
         plan.pipsSL       = slDistance / (point * 10.0);
         plan.pipsTP1      = (plan.tp1 - curAsk) / (point * 10.0);
         plan.pipsTP2      = (plan.tp2 - curAsk) / (point * 10.0);
         plan.pipsTP3      = (plan.tp3 - curAsk) / (point * 10.0);
         plan.rationale    = "Trend Pullback: Giá hồi về dải EMA Ribbon rồi bứt phá theo trend tăng";
         return true;
      }

      // 2. Kiểm tra xu hướng giảm mạnh: EMA 21 < EMA 50 < EMA 200
      bool isStrongDown = (ema21[0] < ema50[0] && ema50[0] < ema200[0]);
      if(isStrongDown && rates[1].high >= ema21[1] && rates[1].close < ema21[0] && rates[1].close < rates[1].open)
      {
         double slDistance = MathMax(ema50[0] - curBid + (15 * point), 40 * point);
         plan.timestamp    = TimeCurrent();
         plan.symbol       = symbol;
         plan.timeframe    = tf;
         plan.direction    = DIR_SELL;
         plan.engineType   = ENGINE_TREND;
         plan.engineName   = m_name;
         plan.entryPrice   = NormalizeDouble(curBid, digits);
         plan.stopLoss     = NormalizeDouble(curBid + slDistance, digits);
         plan.tp1          = NormalizeDouble(curBid - (slDistance * 1.5), digits);
         plan.tp2          = NormalizeDouble(curBid - (slDistance * 2.5), digits);
         plan.tp3          = NormalizeDouble(curBid - (slDistance * 4.0), digits);
         plan.tp1Odds      = 79.5;
         plan.tp2Odds      = 56.0;
         plan.tp3Odds      = 34.0;
         plan.quality      = QUALITY_Q4;
         plan.pWin         = 70.8;
         plan.isHeadsUp    = false;
         plan.pipsSL       = slDistance / (point * 10.0);
         plan.pipsTP1      = (curBid - plan.tp1) / (point * 10.0);
         plan.pipsTP2      = (curBid - plan.tp2) / (point * 10.0);
         plan.pipsTP3      = (curBid - plan.tp3) / (point * 10.0);
         plan.rationale    = "Trend Pullback: Giá kiểm định dải kháng cự động EMA Ribbon và tiếp diễn giảm";
         return true;
      }

      return false;
   }
};
