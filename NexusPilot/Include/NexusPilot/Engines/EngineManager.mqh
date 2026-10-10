//+------------------------------------------------------------------+
//|                                            EngineManager.mqh     |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"
#include "ISignalEngine.mqh"
#include "EngineSMC.mqh"
#include "EngineTrendMomentum.mqh"
#include "EngineMeanReversion.mqh"
#include "../Core/RiskManager.mqh"
#include "../Core/NewsCalendar.mqh"
#include "../Core/MarketContext.mqh"

class CEngineManager
{
private:
   CEngineSMC            m_smc;
   CEngineTrendMomentum  m_trend;
   CEngineMeanReversion  m_meanRev;
   SignalPlan            m_latestSignal;
   SignalPlan            m_recentSignals[MAX_RECENT_SIGNALS];
   int                   m_recentCount;
   string                m_blockedReason;
   bool                  m_isBlocked;

public:
   CEngineManager()
   {
      m_recentCount   = 0;
      m_blockedReason = "None";
      m_isBlocked     = false;
      m_latestSignal.Reset();
   }

   void Init()
   {
      m_smc.Init();
      m_trend.Init();
      m_meanRev.Init();
   }

   // Bật/tắt từng engine độc lập
   void SetEngineStatus(ENUM_ENGINE_TYPE type, bool enabled)
   {
      switch(type)
      {
         case ENGINE_SMC:      m_smc.SetEnabled(enabled); break;
         case ENGINE_TREND:    m_trend.SetEnabled(enabled); break;
         case ENGINE_MEAN_REV: m_meanRev.SetEnabled(enabled); break;
      }
   }

   bool IsEngineEnabled(ENUM_ENGINE_TYPE type) const
   {
      switch(type)
      {
         case ENGINE_SMC:      return m_smc.IsEnabled();
         case ENGINE_TREND:    return m_trend.IsEnabled();
         case ENGINE_MEAN_REV: return m_meanRev.IsEnabled();
      }
      return false;
   }

   // Tổng hợp phân tích đa Engine & Kiểm duyệt bộ lọc rủi ro
   bool Analyze(string symbol, ENUM_TIMEFRAMES tf, CRiskManager &riskMgr, CNewsCalendar &newsCal, CMarketContext &mktCtx)
   {
      m_isBlocked     = false;
      m_blockedReason = "Bình thường - Đang tìm kiếm cơ hội";

      // 1. Kiểm tra khóa bảo vệ Quỹ / Tài khoản
      if(riskMgr.IsLockedToday())
      {
         m_isBlocked     = true;
         m_blockedReason = "Tạm dừng: Chạm giới hạn Drawdown an toàn trong ngày (Prop Firm Guard)";
         return false;
      }

      // 2. Kiểm tra bộ lọc tin tức (News Window)
      if(newsCal.IsNewsWindowActive())
      {
         m_isBlocked     = true;
         m_blockedReason = "Tạm dừng: Cửa sổ tin tức đỏ đang hoạt động - " + newsCal.GetBlockedReason();
         return false;
      }

      // 3. Kiểm tra Spread thị trường
      MarketContextState ctxState = mktCtx.GetState();
      if(ctxState.currentSpread > ctxState.averageSpread * 2.5)
      {
         m_isBlocked     = true;
         m_blockedReason = "Tạm dừng: Spread đang giãn nở bất thường (" + DoubleToString(ctxState.currentSpread, 1) + " pips)";
         return false;
      }

      // 4. Lần lượt quét qua các Engine
      SignalPlan plan;
      plan.Reset();

      bool found = false;
      if(m_smc.IsEnabled() && m_smc.Analyze(symbol, tf, plan))
      {
         found = true;
      }
      else if(m_trend.IsEnabled() && m_trend.Analyze(symbol, tf, plan))
      {
         found = true;
      }
      else if(m_meanRev.IsEnabled() && m_meanRev.Analyze(symbol, tf, plan))
      {
         found = true;
      }

      if(found)
      {
         // Kiểm tra sự đồng thuận đa khung (MTF Confluence) để nâng hạng Q
         if(plan.direction == DIR_BUY && ctxState.trendH1 > 0 && ctxState.trendH4 > 0)
         {
            plan.quality = QUALITY_Q5;
            plan.pWin    = MathMin(plan.pWin + 6.0, 88.0);
         }
         else if(plan.direction == DIR_SELL && ctxState.trendH1 < 0 && ctxState.trendH4 < 0)
         {
            plan.quality = QUALITY_Q5;
            plan.pWin    = MathMin(plan.pWin + 6.0, 88.0);
         }

         // Gợi ý Lot size theo quản lý rủi ro
         double slPts = MathAbs(plan.entryPrice - plan.stopLoss) / SymbolInfoDouble(symbol, SYMBOL_POINT);
         plan.suggestedLot = riskMgr.CalculateLotSize(symbol, slPts);

         // Lưu tín hiệu mới nhất
         if(!plan.isHeadsUp && plan.direction != DIR_FLAT)
         {
            if(m_latestSignal.timestamp != plan.timestamp || m_latestSignal.entryPrice != plan.entryPrice)
            {
               m_latestSignal = plan;
               PushRecentSignal(plan);
            }
         }
         else
         {
            m_latestSignal = plan;
         }
         return true;
      }

      // Nếu không có tín hiệu: Báo nguyên nhân rõ ràng
      if(ctxState.trendM15 == 0 && ctxState.trendH1 == 0)
      {
         m_blockedReason = "Thị trường đi ngang (Sideway) - Biên độ hẹp chưa có cấu trúc rõ ràng";
      }
      else
      {
         m_blockedReason = "Không có điểm vào lệnh đạt chuẩn (Chờ Retest / FVG / Pullback)";
      }

      return false;
   }

   void PushRecentSignal(const SignalPlan &plan)
   {
      for(int i = MAX_RECENT_SIGNALS - 1; i > 0; i--)
      {
         m_recentSignals[i] = m_recentSignals[i - 1];
      }
      m_recentSignals[0] = plan;
      if(m_recentCount < MAX_RECENT_SIGNALS) m_recentCount++;
   }

   SignalPlan GetLatestSignal() const { return m_latestSignal; }
   bool IsBlocked() const { return m_isBlocked; }
   string GetBlockedReason() const { return m_blockedReason; }
   int GetRecentSignalsCount() const { return m_recentCount; }
   SignalPlan GetRecentSignal(int idx) const
   {
      if(idx >= 0 && idx < m_recentCount) return m_recentSignals[idx];
      SignalPlan empty; empty.Reset(); return empty;
   }
};
