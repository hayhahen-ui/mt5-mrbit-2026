//+------------------------------------------------------------------+
//|                                         MultiSymbolScanner.mqh   |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class CMultiSymbolScanner
{
private:
   string        m_symbolsList[];
   RadarCardItem m_cards[];
   int           m_count;

public:
   CMultiSymbolScanner()
   {
      m_count = 0;
      ArrayResize(m_symbolsList, 0);
      ArrayResize(m_cards, 0);
   }

   void Init(string symbolsConfig)
   {
      ArrayResize(m_symbolsList, 0);
      ArrayResize(m_cards, 0);
      m_count = 0;

      if(symbolsConfig == "")
      {
         // Danh mục tiêu chuẩn thị trường
         string defaults[] = {"XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "BTCUSD", "US30", "ETHUSD"};
         int sz = ArraySize(defaults);
         ArrayResize(m_symbolsList, sz);
         ArrayResize(m_cards, sz);
         for(int i = 0; i < sz; i++)
         {
            m_symbolsList[i] = defaults[i];
         }
         m_count = sz;
      }
      else
      {
         // Parse chuỗi phân cách bởi dấu phẩy
         string temp[];
         int total = StringSplit(symbolsConfig, ',', temp);
         if(total > 0)
         {
            total = MathMin(total, MAX_RADAR_SYMBOLS);
            ArrayResize(m_symbolsList, total);
            ArrayResize(m_cards, total);
            for(int i = 0; i < total; i++)
            {
               StringTrimLeft(temp[i]);
               StringTrimRight(temp[i]);
               m_symbolsList[i] = temp[i];
            }
            m_count = total;
         }
      }

      ScanAll();
   }

   // Quét cập nhật dữ liệu Radar đa cặp
   void ScanAll()
   {
      for(int i = 0; i < m_count; i++)
      {
         string sym = m_symbolsList[i];
         // Bóc tách symbol nếu có kèm khung thời gian (vd: XAUUSD:M15)
         int colonPos = StringFind(sym, ":");
         string cleanSym = sym;
         if(colonPos > 0)
         {
            cleanSym = StringSubstr(sym, 0, colonPos);
         }

         // Chọn symbol vào MarketWatch nếu chưa có
         if(!SymbolInfoInteger(cleanSym, SYMBOL_SELECT))
         {
            SymbolSelect(cleanSym, true);
         }

         m_cards[i].symbol = cleanSym;
         m_cards[i].bid    = SymbolInfoDouble(cleanSym, SYMBOL_BID);
         m_cards[i].ask    = SymbolInfoDouble(cleanSym, SYMBOL_ASK);

         long spreadPts = SymbolInfoInteger(cleanSym, SYMBOL_SPREAD);
         double pt      = SymbolInfoDouble(cleanSym, SYMBOL_POINT);
         m_cards[i].spreadPips = (pt > 0) ? (spreadPts * pt / (pt * 10.0)) : 0.0;

         // Tính biến động 24h % (so với giá mở cửa nến D1)
         MqlRates d1Rates[];
         ArraySetAsSeries(d1Rates, true);
         if(CopyRates(cleanSym, PERIOD_D1, 0, 1, d1Rates) > 0 && d1Rates[0].open > 0)
         {
            m_cards[i].change24hPct = ((m_cards[i].bid - d1Rates[0].open) / d1Rates[0].open) * 100.0;
         }
         else
         {
            m_cards[i].change24hPct = 0.0;
         }

         // Đánh giá Trend sơ bộ trên H1
         double ema20[], ema50[];
         ArraySetAsSeries(ema20, true);
         ArraySetAsSeries(ema50, true);
         int h20 = iMA(cleanSym, PERIOD_H1, 20, 0, MODE_EMA, PRICE_CLOSE);
         int h50 = iMA(cleanSym, PERIOD_H1, 50, 0, MODE_EMA, PRICE_CLOSE);
         if(h20 != INVALID_HANDLE && h50 != INVALID_HANDLE)
         {
            CopyBuffer(h20, 0, 0, 1, ema20);
            CopyBuffer(h50, 0, 0, 1, ema50);
            IndicatorRelease(h20);
            IndicatorRelease(h50);

            if(ArraySize(ema20) > 0 && ArraySize(ema50) > 0)
            {
               m_cards[i].trendBias = (ema20[0] > ema50[0]) ? 1 : -1;
            }
         }

         // Trạng thái Signal giả lập trên radar
         if(i == 0) // Cặp đầu tiên (vd XAUUSD)
         {
            m_cards[i].signalDir    = DIR_BUY;
            m_cards[i].signalEngine = "SMC_ICT";
            m_cards[i].quality      = QUALITY_Q5;
            m_cards[i].pWin         = 74.2;
            m_cards[i].hasAlert     = true;
         }
         else
         {
            m_cards[i].signalDir    = DIR_FLAT;
            m_cards[i].signalEngine = "Scanning";
            m_cards[i].quality      = QUALITY_Q3;
            m_cards[i].pWin         = 50.0;
            m_cards[i].hasAlert     = false;
         }
      }
   }

   // 1-Click chuyển chart sang cặp được bấm
   bool SwitchChartToSymbol(int index)
   {
      if(index < 0 || index >= m_count) return false;
      string targetSym = m_cards[index].symbol;
      return ChartSetSymbolPeriod(0, targetSym, _Period);
   }

   int GetCount() const { return m_count; }
   RadarCardItem GetCard(int index) const
   {
      if(index >= 0 && index < m_count) return m_cards[index];
      RadarCardItem empty; ZeroMemory(empty); return empty;
   }
};
