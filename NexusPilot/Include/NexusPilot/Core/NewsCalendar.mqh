//+------------------------------------------------------------------+
//|                                                 NewsCalendar.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class CNewsCalendar
{
private:
   int            m_preNewsMinutes;   // Số phút trước tin cần chặn vào lệnh
   int            m_postNewsMinutes;  // Số phút sau tin cần chặn vào lệnh
   bool           m_filterHighImpact;
   bool           m_filterMedImpact;
   NewsEventItem  m_events[];
   bool           m_isWindowActive;
   string         m_activeBlockedNews;

public:
   CNewsCalendar()
   {
      m_preNewsMinutes   = 30;
      m_postNewsMinutes  = 15;
      m_filterHighImpact = true;
      m_filterMedImpact  = false;
      m_isWindowActive   = false;
      m_activeBlockedNews= "";
      ArrayResize(m_events, 0);
   }

   void Init(int preMins = 30, int postMins = 15, bool highOnly = true)
   {
      m_preNewsMinutes   = preMins;
      m_postNewsMinutes  = postMins;
      m_filterHighImpact = true;
      m_filterMedImpact  = !highOnly;
      UpdateCalendar();
   }

   // Lấy danh sách tin tức từ MQL5 Calendar Native
   void UpdateCalendar()
   {
      m_isWindowActive    = false;
      m_activeBlockedNews = "";
      datetime curTime    = TimeCurrent();

      #ifdef __MQL5__
      MqlCalendarValue values[];
      datetime fromTime = curTime - (m_postNewsMinutes * 60);
      datetime toTime   = curTime + (24 * 3600); // 24h timeline

      // Truy vấn lịch sự kiện kinh tế MQL5
      ResetLastError();
      int count = CalendarValueHistory(values, fromTime, toTime);
      if(count > 0)
      {
         int validCount = 0;
         ArrayResize(m_events, MathMin(count, 30));

         for(int i = 0; i < count && validCount < 30; i++)
         {
            MqlCalendarEvent event;
            if(CalendarEventById(values[i].event_id, event))
            {
               int impact = (int)event.importance; // 1 = None, 2 = Low, 3 = Moderate, 4 = High
               if(impact >= (m_filterMedImpact ? 3 : 4))
               {
                  m_events[validCount].time       = values[i].time;
                  m_events[validCount].currency   = event.event_code;
                  m_events[validCount].importance = (impact >= 4) ? 3 : 2;
                  m_events[validCount].name       = event.name;
                  m_events[validCount].actual     = (double)values[i].actual_value;
                  m_events[validCount].forecast   = (double)values[i].forecast_value;
                  m_events[validCount].previous   = (double)values[i].prev_value;

                  // Kiểm tra xem có đang rơi vào vùng cửa sổ tin đỏ không
                  long diffSec = (long)(values[i].time - curTime);
                  if(diffSec >= (-m_postNewsMinutes * 60) && diffSec <= (m_preNewsMinutes * 60))
                  {
                     m_events[validCount].isWindowActive = true;
                     m_isWindowActive = true;
                     m_activeBlockedNews = event.name + " (" + (string)(diffSec / 60) + "m)";
                  }
                  else
                  {
                     m_events[validCount].isWindowActive = false;
                  }
                  validCount++;
               }
            }
         }
         ArrayResize(m_events, validCount);
         return;
      }
      #endif

      // Fallback nếu Broker không hỗ trợ MQL5 Calendar
      GenerateSimulatedSchedule(curTime);
   }

   // Tạo lịch dự phòng khi Broker không cấp dữ liệu MQL5 Calendar
   void GenerateSimulatedSchedule(datetime curTime)
   {
      ArrayResize(m_events, 3);
      m_events[0].time           = curTime + 1800;
      m_events[0].currency       = "USD";
      m_events[0].importance     = 3; // High
      m_events[0].name           = "US CPI Inflation m/m";
      m_events[0].isWindowActive = false;

      m_events[1].time           = curTime + 7200;
      m_events[1].currency       = "EUR";
      m_events[1].importance     = 2; // Med
      m_events[1].name           = "ECB Economic Bulletin";
      m_events[1].isWindowActive = false;

      m_events[2].time           = curTime + 14400;
      m_events[2].currency       = "USD";
      m_events[2].importance     = 3; // High
      m_events[2].name           = "FOMC Member Speech";
      m_events[2].isWindowActive = false;
   }

   bool IsNewsWindowActive() const { return m_isWindowActive; }
   string GetBlockedReason() const { return m_activeBlockedNews; }
   int GetEventsCount() const { return ArraySize(m_events); }
   bool GetEvent(int index, NewsEventItem &outEvent) const
   {
      if(index < 0 || index >= ArraySize(m_events)) return false;
      outEvent = m_events[index];
      return true;
   }
};
