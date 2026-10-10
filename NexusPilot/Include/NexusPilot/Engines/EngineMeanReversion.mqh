//+------------------------------------------------------------------+
//|                                         EngineMeanReversion.mqh  |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "ISignalEngine.mqh"

class CEngineMeanReversion : public ISignalEngine
{
private:
   bool   m_enabled;
   string m_name;

public:
   CEngineMeanReversion()
   {
      m_enabled = true;
      m_name    = "Mean_Reversion_Sweep";
   }

   virtual void Init()
   {
      m_enabled = true;
   }

   virtual string           GetName() const { return m_name; }
   virtual ENUM_ENGINE_TYPE GetType() const { return ENGINE_MEAN_REV; }
   virtual bool             IsEnabled() const { return m_enabled; }
   virtual void             SetEnabled(bool enabled) { m_enabled = enabled; }

   virtual bool Analyze(string symbol, ENUM_TIMEFRAMES tf, SignalPlan &plan)
   {
      if(!m_enabled) return false;

      double rsi[];
      ArraySetAsSeries(rsi, true);
      int hRsi = iRSI(symbol, tf, 14, PRICE_CLOSE);
      if(hRsi == INVALID_HANDLE) return false;
      CopyBuffer(hRsi, 0, 0, 3, rsi);
      IndicatorRelease(hRsi);

      double bbUpper[], bbMiddle[], bbLower[];
      ArraySetAsSeries(bbUpper, true);
      ArraySetAsSeries(bbMiddle, true);
      ArraySetAsSeries(bbLower, true);

      int hBb = iBands(symbol, tf, 20, 0, 2.0, PRICE_CLOSE);
      if(hBb == INVALID_HANDLE) return false;
      CopyBuffer(hBb, 0, 0, 3, bbMiddle);
      CopyBuffer(hBb, 1, 0, 3, bbUpper);
      CopyBuffer(hBb, 2, 0, 3, bbLower);
      IndicatorRelease(hBb);

      if(ArraySize(rsi) < 3 || ArraySize(bbUpper) < 3) return false;

      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      if(CopyRates(symbol, tf, 0, 5, rates) < 5) return false;

      double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
      int digits    = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      double curAsk = SymbolInfoDouble(symbol, SYMBOL_ASK);
      double curBid = SymbolInfoDouble(symbol, SYMBOL_BID);

      // 1. Quét thanh khoản đáy (Sweep Low) + RSI Quá bán (< 30) + Đóng nến bật vào trong dải BB
      if(rsi[1] < 30.0 && rates[1].low <= bbLower[1] && rates[1].close > bbLower[0])
      {
         double slDistance = MathMax((curAsk - rates[1].low) + (10 * point), 35 * point);
         plan.timestamp    = TimeCurrent();
         plan.symbol       = symbol;
         plan.timeframe    = tf;
         plan.direction    = DIR_BUY;
         plan.engineType   = ENGINE_MEAN_REV;
         plan.engineName   = m_name;
         plan.entryPrice   = NormalizeDouble(curAsk, digits);
         plan.stopLoss     = NormalizeDouble(curAsk - slDistance, digits);
         plan.tp1          = NormalizeDouble(bbMiddle[0], digits);
         plan.tp2          = NormalizeDouble(bbUpper[0] - (20 * point), digits);
         plan.tp3          = NormalizeDouble(bbUpper[0] + (30 * point), digits);
         plan.tp1Odds      = 82.0;
         plan.tp2Odds      = 49.0;
         plan.tp3Odds      = 28.0;
         plan.quality      = QUALITY_Q3;
         plan.pWin         = 68.5;
         plan.isHeadsUp    = false;
         plan.pipsSL       = slDistance / (point * 10.0);
         plan.pipsTP1      = (plan.tp1 - curAsk) / (point * 10.0);
         plan.pipsTP2      = (plan.tp2 - curAsk) / (point * 10.0);
         plan.pipsTP3      = (plan.tp3 - curAsk) / (point * 10.0);
         plan.rationale    = "Mean Reversion: Quét đáy ngoài Bollinger Bands + RSI Quá bán đảo chiều";
         return true;
      }

      // 2. Quét thanh khoản đỉnh (Sweep High) + RSI Quá mua (> 70) + Đóng nến giật vào trong dải BB
      if(rsi[1] > 70.0 && rates[1].high >= bbUpper[1] && rates[1].close < bbUpper[0])
      {
         double slDistance = MathMax((rates[1].high - curBid) + (10 * point), 35 * point);
         plan.timestamp    = TimeCurrent();
         plan.symbol       = symbol;
         plan.timeframe    = tf;
         plan.direction    = DIR_SELL;
         plan.engineType   = ENGINE_MEAN_REV;
         plan.engineName   = m_name;
         plan.entryPrice   = NormalizeDouble(curBid, digits);
         plan.stopLoss     = NormalizeDouble(curBid + slDistance, digits);
         plan.tp1          = NormalizeDouble(bbMiddle[0], digits);
         plan.tp2          = NormalizeDouble(bbLower[0] + (20 * point), digits);
         plan.tp3          = NormalizeDouble(bbLower[0] - (30 * point), digits);
         plan.tp1Odds      = 80.5;
         plan.tp2Odds      = 47.0;
         plan.tp3Odds      = 27.0;
         plan.quality      = QUALITY_Q3;
         plan.pWin         = 67.8;
         plan.isHeadsUp    = false;
         plan.pipsSL       = slDistance / (point * 10.0);
         plan.pipsTP1      = (curBid - plan.tp1) / (point * 10.0);
         plan.pipsTP2      = (curBid - plan.tp2) / (point * 10.0);
         plan.pipsTP3      = (curBid - plan.tp3) / (point * 10.0);
         plan.rationale    = "Mean Reversion: Quét đỉnh ngoài Bollinger Bands + RSI Quá mua đảo chiều";
         return true;
      }

      return false;
   }
};
