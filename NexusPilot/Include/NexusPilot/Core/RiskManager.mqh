//+------------------------------------------------------------------+
//|                                                  RiskManager.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class CRiskManager
{
private:
   double               m_riskPct;
   double               m_maxDailyLossPct;
   datetime             m_lastDayChecked;
   double               m_dailyStartEquity;
   bool                 m_isLockedToday;
   AccountRiskStats     m_stats;

public:
   CRiskManager()
   {
      m_riskPct         = 1.0;
      m_maxDailyLossPct = 4.0; // Chuẩn quỹ Prop Firm (FTMO, FundedNext)
      m_lastDayChecked  = 0;
      m_dailyStartEquity= 0.0;
      m_isLockedToday   = false;
      ZeroMemory(m_stats);
   }

   void Init(double riskPct, double maxDailyLossPct = 4.0)
   {
      m_riskPct         = (riskPct > 0.0) ? riskPct : 1.0;
      m_maxDailyLossPct = (maxDailyLossPct > 0.0) ? maxDailyLossPct : 4.0;
      UpdateDailyBaseline();
   }

   // Cập nhật mốc Equity đầu ngày (00:00 Server Time) để giám sát rủi ro
   void UpdateDailyBaseline()
   {
      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      datetime todayMidnight = StructToTime(dt) - (dt.hour * 3600 + dt.min * 60 + dt.sec);

      if(m_lastDayChecked != todayMidnight || m_dailyStartEquity <= 0.0)
      {
         m_lastDayChecked   = todayMidnight;
         m_dailyStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
         m_isLockedToday    = false;
      }
   }

   // Giám sát Drawdown trong ngày - Bảo vệ tài khoản Prop Firm / Live Real
   bool CheckPropFirmDrawdown()
   {
      UpdateDailyBaseline();
      
      double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      if(m_dailyStartEquity > 0.0)
      {
         double drawdownAmount = m_dailyStartEquity - currentEquity;
         double ddPct = (drawdownAmount / m_dailyStartEquity) * 100.0;

         if(ddPct >= m_maxDailyLossPct)
         {
            m_isLockedToday = true;
         }
      }
      return m_isLockedToday;
   }

   bool IsLockedToday() const { return m_isLockedToday; }

   // Tính Lot size tự động chuẩn xác đa tài sản (Forex, Vàng, Dầu, Crypto, Chỉ số)
   double CalculateLotSize(string symbol, double slPoints)
   {
      if(slPoints <= 0) return SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);

      double balance = AccountInfoDouble(ACCOUNT_BALANCE);
      double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
      double baseCapital = MathMin(balance, equity); // Bảo toàn vốn thận trọng

      double riskMoney = baseCapital * (m_riskPct / 100.0);

      double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      double tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double point     = SymbolInfoDouble(symbol, SYMBOL_POINT);

      if(tickValue <= 0 || tickSize <= 0 || point <= 0)
      {
         return SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      }

      double pointValue = tickValue * (point / tickSize);
      double moneyRiskPerLot = slPoints * pointValue;

      if(moneyRiskPerLot <= 0) return SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);

      double calculatedLot = riskMoney / moneyRiskPerLot;

      // Chuẩn hóa theo quy chuẩn Broker
      double minLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      double maxLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
      double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

      if(lotStep <= 0) lotStep = 0.01;

      calculatedLot = MathFloor(calculatedLot / lotStep) * lotStep;

      if(calculatedLot < minLot) calculatedLot = minLot;
      if(calculatedLot > maxLot) calculatedLot = maxLot;

      return NormalizeDouble(calculatedLot, 2);
   }

   // Cập nhật số liệu tài khoản tổng hợp
   void UpdateAccountMetrics()
   {
      m_stats.balance       = AccountInfoDouble(ACCOUNT_BALANCE);
      m_stats.equity        = AccountInfoDouble(ACCOUNT_EQUITY);
      m_stats.freeMargin    = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      m_stats.marginLevel   = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
      m_stats.leverage      = (int)AccountInfoInteger(ACCOUNT_LEVERAGE);
      m_stats.dailyStartingEquity = m_dailyStartEquity;

      if(m_dailyStartEquity > 0.0)
      {
         m_stats.dailyPnLPct = ((m_stats.equity - m_dailyStartEquity) / m_dailyStartEquity) * 100.0;
         double maxDDAmt = m_dailyStartEquity - m_stats.equity;
         m_stats.dailyMaxDDPct = (maxDDAmt > 0) ? (maxDDAmt / m_dailyStartEquity) * 100.0 : 0.0;
      }
      else
      {
         m_stats.dailyPnLPct   = 0.0;
         m_stats.dailyMaxDDPct = 0.0;
      }

      m_stats.isPropFirmGuardLocked = m_isLockedToday;
   }

   AccountRiskStats GetStats() const { return m_stats; }
   double GetRiskPct() const { return m_riskPct; }
   void SetRiskPct(double risk) { m_riskPct = (risk > 0) ? risk : 1.0; }
};
