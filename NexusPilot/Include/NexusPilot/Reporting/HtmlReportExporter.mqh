//+------------------------------------------------------------------+
//|                                       HtmlReportExporter.mqh     |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"
#include "../Engines/EngineManager.mqh"

class CHtmlReportExporter
{
public:
   // FIX 19/10/2026 (audit): BỎ toàn bộ số liệu cứng giả mạo trước đây
   // (48 tín hiệu / WR 77.1% / +1,420 pips / PF 2.45 và 5 dòng log mẫu).
   // Báo cáo giờ render từ buffer tín hiệu THẬT của CEngineManager
   // (tối đa MAX_RECENT_SIGNALS tín hiệu gần nhất). Các chỉ số kết quả
   // (win rate / profit factor / pips thực) chưa được EA theo dõi nên hiển
   // thị "—" trung thực thay vì bịa số; kết quả paper chính thức xem ở
   // tab SỔ LỆNH của web app NexusPilot.
   static bool ExportReport(CEngineManager &engMgr, string fileName = "NexusPilot_Report.html")
   {
      int handle = FileOpen(fileName, FILE_WRITE|FILE_TXT|FILE_ANSI);
      if(handle == INVALID_HANDLE)
      {
         Print("[NexusPilot] Không thể tạo file báo cáo HTML: ", fileName);
         return false;
      }

      int n = engMgr.GetRecentSignalsCount();
      int buys = 0, sells = 0;
      for(int k = 0; k < n; k++)
      {
         SignalPlan p = engMgr.GetRecentSignal(k);
         if(p.direction == DIR_BUY) buys++;
         else if(p.direction == DIR_SELL) sells++;
      }

      string html = "<!DOCTYPE html>\n";
      html += "<html lang='vi'>\n<head>\n";
      html += "<meta charset='UTF-8'>\n";
      html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>\n";
      html += "<title>NexusPilot Pro - Performance & Audit Report</title>\n";
      html += "<style>\n";
      html += "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }\n";
      html += ".container { max-width: 1100px; margin: 0 auto; }\n";
      html += ".header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px; }\n";
      html += ".title { font-size: 24px; font-weight: 700; color: #38bdf8; }\n";
      html += ".grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 30px; }\n";
      html += ".card { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); }\n";
      html += ".card-title { font-size: 13px; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }\n";
      html += ".card-value { font-size: 28px; font-weight: 700; }\n";
      html += ".green { color: #10b981; }\n";
      html += ".red { color: #ef4444; }\n";
      html += ".cyan { color: #38bdf8; }\n";
      html += ".muted { color: #64748b; }\n";
      html += ".chart-box { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 30px; }\n";
      html += "table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }\n";
      html += "th { text-align: left; padding: 12px; background: #1e293b; color: #94a3b8; font-weight: 600; }\n";
      html += "td { padding: 12px; border-bottom: 1px solid #1e293b; }\n";
      html += ".badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }\n";
      html += ".badge-buy { background: rgba(16, 185, 129, 0.2); color: #10b981; }\n";
      html += ".badge-sell { background: rgba(239, 68, 68, 0.2); color: #ef4444; }\n";
      html += ".badge-flat { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }\n";
      html += ".footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 40px; }\n";
      html += "</style>\n</head>\n<body>\n";
      html += "<div class='container'>\n";
      html += "<div class='header'>\n";
      html += "  <div>\n";
      html += "    <div class='title'>✈️ NEXUSPILOT PRO DASHBOARD</div>\n";
      html += "    <div style='color: #94a3b8; font-size: 13px;'>Báo cáo tín hiệu từ dữ liệu thật của EA (không số liệu mẫu)</div>\n";
      html += "  </div>\n";
      html += "  <div style='text-align: right; font-size: 13px; color: #94a3b8;'>Xuất ngày: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "</div>\n";
      html += "</div>\n";

      // 4 thẻ chỉ số — chỉ số liệu thật, chưa có thì hiển thị "—"
      html += "<div class='grid'>\n";
      html += "  <div class='card'><div class='card-title'>Tín hiệu đã ghi (phiên này)</div><div class='card-value cyan'>" + IntegerToString(n) + "</div></div>\n";
      html += "  <div class='card'><div class='card-title'>BUY / SELL</div><div class='card-value cyan'>" + IntegerToString(buys) + " / " + IntegerToString(sells) + "</div></div>\n";
      html += "  <div class='card'><div class='card-title'>Tỉ lệ thắng (Win Rate)</div><div class='card-value muted'>—</div></div>\n";
      html += "  <div class='card'><div class='card-title'>Profit Factor</div><div class='card-value muted'>—</div></div>\n";
      html += "</div>\n";
      html += "<div style='color: #64748b; font-size: 12px; margin-bottom: 24px;'>EA chưa theo dõi kết quả TP/SL nên không hiển thị WR/PF bịa đặt — kết quả paper chính thức xem ở tab SỔ LỆNH của web app NexusPilot.</div>\n";

      // Bảng tín hiệu thật gần nhất
      html += "<div class='chart-box'>\n";
      html += "  <h3 style='margin-top: 0; color: #e2e8f0;'>Tín hiệu gần đây (từ Engine, tối đa " + IntegerToString(MAX_RECENT_SIGNALS) + ")</h3>\n";
      if(n == 0)
      {
         html += "  <div style='color: #94a3b8;'>Chưa có tín hiệu nào được ghi trong phiên này.</div>\n";
      }
      else
      {
         html += "  <table>\n";
         html += "    <thead>\n";
         html += "      <tr><th>Thời gian</th><th>Cặp</th><th>Chiều</th><th>Engine</th><th>Entry</th><th>SL</th><th>TP1</th></tr>\n";
         html += "    </thead>\n";
         html += "    <tbody>\n";
         for(int k = 0; k < n; k++)
         {
            SignalPlan p = engMgr.GetRecentSignal(k);
            string dirBadge = "<span class='badge badge-flat'>FLAT</span>";
            if(p.direction == DIR_BUY) dirBadge = "<span class='badge badge-buy'>BUY</span>";
            else if(p.direction == DIR_SELL) dirBadge = "<span class='badge badge-sell'>SELL</span>";
            int dg = 2;
            long tmpDg = SymbolInfoInteger(p.symbol, SYMBOL_DIGITS);
            if(tmpDg > 0) dg = (int)tmpDg;
            html += "      <tr><td>" + TimeToString(p.timestamp, TIME_DATE|TIME_MINUTES) + "</td><td>" + p.symbol + "</td><td>" + dirBadge + "</td><td>" + p.engineName + "</td><td>" + DoubleToString(p.entryPrice, dg) + "</td><td>" + DoubleToString(p.stopLoss, dg) + "</td><td>" + DoubleToString(p.tp1, dg) + "</td></tr>\n";
         }
         html += "    </tbody>\n";
         html += "  </table>\n";
      }
      html += "</div>\n";

      html += "<div class='footer'>Được khởi tạo bởi NexusPilot NextGen Architecture · Open Trading System</div>\n";
      html += "</div>\n</body>\n</html>";

      FileWriteString(handle, html);
      FileClose(handle);

      Print("[NexusPilot] Báo cáo HTML đã xuất thành công: MQL5/Files/", fileName);
      return true;
   }
};
