//+------------------------------------------------------------------+
//|                                                TradeExecutor.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include "../Defines.mqh"

class CTradeExecutor
{
private:
   CTrade            m_trade;
   CPositionInfo     m_position;
   ulong             m_magicNumber;
   int               m_deviation;
   bool              m_splitOrders; // Chia 3 lệnh TP1, TP2, TP3
   bool              m_autoBreakEven;
   bool              m_autoTrailing;

public:
   CTradeExecutor()
   {
      m_magicNumber   = 888666;
      m_deviation     = 10;
      m_splitOrders   = true;
      m_autoBreakEven = true;
      m_autoTrailing  = false;
      m_trade.SetExpertMagicNumber(m_magicNumber);
      m_trade.SetDeviationInPoints(m_deviation);
      m_trade.SetTypeFilling(ORDER_FILLING_FOK);
   }

   void Init(ulong magic, int deviation, bool splitOrders, bool autoBE, bool autoTrail)
   {
      m_magicNumber   = magic;
      m_deviation     = deviation;
      m_splitOrders   = splitOrders;
      m_autoBreakEven = autoBE;
      m_autoTrailing  = autoTrail;
      m_trade.SetExpertMagicNumber(m_magicNumber);
      m_trade.SetDeviationInPoints(m_deviation);
   }

   // 1-Click Thực thi kế hoạch giao dịch từ Cockpit FLIGHT Card
   bool ExecuteSignal(const SignalPlan &plan, double totalLot)
   {
      if(plan.direction == DIR_FLAT) return false;
      if(totalLot <= 0.0) return false;

      string symbol = plan.symbol;
      ENUM_ORDER_TYPE orderType = (plan.direction == DIR_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      double price = (orderType == ORDER_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);

      // Định danh comment theo Engine
      string comment = "NP_" + plan.engineName;

      if(!m_splitOrders)
      {
         // Mở 1 lệnh đơn mục tiêu TP1
         return m_trade.PositionOpen(symbol, orderType, totalLot, price, plan.stopLoss, plan.tp1, comment);
      }

      // Chiến lược phân bổ 3-Tier thông minh (50% TP1, 30% TP2, 20% TP3)
      double minLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
      if(lotStep <= 0) lotStep = 0.01;

      double lot1 = MathFloor((totalLot * 0.50) / lotStep) * lotStep;
      double lot2 = MathFloor((totalLot * 0.30) / lotStep) * lotStep;
      double lot3 = totalLot - (lot1 + lot2);
      lot3 = MathFloor(lot3 / lotStep) * lotStep;

      // Nếu Lot tổng nhỏ, gộp lại thành 1 lệnh
      if(lot1 < minLot || lot2 < minLot)
      {
         return m_trade.PositionOpen(symbol, orderType, totalLot, price, plan.stopLoss, plan.tp1, comment + "_Single");
      }

      bool success = true;
      // Lệnh 1: TP1 (Chốt lời nhanh 50% khối lượng)
      success &= m_trade.PositionOpen(symbol, orderType, lot1, price, plan.stopLoss, plan.tp1, comment + "_TP1");

      // Lệnh 2: TP2 (Gồng lãi 30% theo xu hướng)
      if(plan.tp2 > 0)
         success &= m_trade.PositionOpen(symbol, orderType, lot2, price, plan.stopLoss, plan.tp2, comment + "_TP2");
      else
         success &= m_trade.PositionOpen(symbol, orderType, lot2, price, plan.stopLoss, plan.tp1, comment + "_TP2");

      // Lệnh 3: TP3 (Runner 20% ăn trọn sóng lớn)
      if(lot3 >= minLot)
      {
         if(plan.tp3 > 0)
            success &= m_trade.PositionOpen(symbol, orderType, lot3, price, plan.stopLoss, plan.tp3, comment + "_TP3");
         else
            success &= m_trade.PositionOpen(symbol, orderType, lot3, price, plan.stopLoss, plan.tp2, comment + "_TP3");
      }

      return success;
   }

   // Tự động dời SL về Break-Even khi giá chạm TP1
   void ManagePositions(string symbol, double tp1Price, double entryPrice)
   {
      if(!m_autoBreakEven && !m_autoTrailing) return;

      int total = PositionsTotal();
      for(int i = total - 1; i >= 0; i--)
      {
         if(m_position.SelectByIndex(i))
         {
            if(m_position.Symbol() == symbol && m_position.Magic() == m_magicNumber)
            {
               double openPrice = m_position.PriceOpen();
               double currentSL = m_position.StopLoss();
               ENUM_POSITION_TYPE posType = m_position.PositionType();
               double curPrice = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);

               // Auto Break-Even logic
               if(m_autoBreakEven)
               {
                  if(posType == POSITION_TYPE_BUY && curPrice >= tp1Price && currentSL < openPrice)
                  {
                     double newSL = openPrice + (5 * SymbolInfoDouble(symbol, SYMBOL_POINT));
                     m_trade.PositionModify(m_position.Ticket(), newSL, m_position.TakeProfit());
                  }
                  else if(posType == POSITION_TYPE_SELL && curPrice <= tp1Price && (currentSL > openPrice || currentSL == 0))
                  {
                     double newSL = openPrice - (5 * SymbolInfoDouble(symbol, SYMBOL_POINT));
                     m_trade.PositionModify(m_position.Ticket(), newSL, m_position.TakeProfit());
                  }
               }
            }
         }
      }
   }

   // Đóng toàn bộ lệnh khẩn cấp (Emergency Close)
   void CloseAllPositions(string symbol = "")
   {
      int total = PositionsTotal();
      for(int i = total - 1; i >= 0; i--)
      {
         if(m_position.SelectByIndex(i))
         {
            if(m_position.Magic() == m_magicNumber)
            {
               if(symbol == "" || m_position.Symbol() == symbol)
               {
                  m_trade.PositionClose(m_position.Ticket());
               }
            }
         }
      }
   }
};
