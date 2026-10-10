//+------------------------------------------------------------------+
//|                                         TelegramNotifier.mqh     |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class CTelegramNotifier
{
private:
   bool   m_enabled;
   string m_token;
   string m_chatId;
   int    m_topicGold;
   int    m_topicForex;
   int    m_topicCrypto;
   int    m_tzOffset;
   string m_tzLabel;

public:
   CTelegramNotifier()
   {
      m_enabled     = false;
      m_token       = "";
      m_chatId      = "";
      m_topicGold   = 0;
      m_topicForex  = 0;
      m_topicCrypto = 0;
      m_tzOffset    = 7;
      m_tzLabel     = "VN";
   }

   void Init(bool enable, string token, string chatId, int topicGold = 0, int topicForex = 0, int topicCrypto = 0, int tzOffset = 7, string tzLabel = "VN")
   {
      m_enabled     = enable;
      m_token       = token;
      m_chatId      = chatId;
      m_topicGold   = topicGold;
      m_topicForex  = topicForex;
      m_topicCrypto = topicCrypto;
      m_tzOffset    = tzOffset;
      m_tzLabel     = tzLabel;
   }

   // Xác định Topic ID tương ứng theo loại tài sản
   int GetTopicIdForSymbol(string symbol)
   {
      string upper = symbol;
      StringToUpper(upper);
      if(StringFind(upper, "XAU") >= 0 || StringFind(upper, "GOLD") >= 0)
         return m_topicGold;
      if(StringFind(upper, "BTC") >= 0 || StringFind(upper, "ETH") >= 0 || StringFind(upper, "SOL") >= 0)
         return m_topicCrypto;
      return m_topicForex;
   }

   // Gửi tín hiệu hoàn chỉnh qua Telegram Bot (Native WebRequest, KHÔNG CẦN DLL)
   bool SendSignal(const SignalPlan &plan)
   {
      if(!m_enabled || m_token == "" || m_chatId == "") return false;

      string actionIcon = (plan.direction == DIR_BUY) ? "🟢 BUY" : "🔴 SELL";
      string qStars = "";
      for(int i = 0; i < (int)plan.quality; i++) qStars += "⭐";

      datetime localTime = TimeCurrent() + (m_tzOffset * 3600);
      string timeStr = TimeToString(localTime, TIME_DATE|TIME_MINUTES) + " (" + m_tzLabel + ")";

      string msg = "🚀 *[NEXUSPILOT PRO SIGNAL]*\n";
      msg += "━━━━━━━━━━━━━━━━━━━━\n";
      msg += "📊 Cặp: #" + plan.symbol + " | Khung: " + EnumToString(plan.timeframe) + "\n";
      msg += "⚡ Chiều: *" + actionIcon + "* @ `" + DoubleToString(plan.entryPrice, (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS)) + "`\n";
      msg += "🛑 Stop Loss: `" + DoubleToString(plan.stopLoss, (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS)) + "` (" + DoubleToString(plan.pipsSL, 1) + " pips)\n";
      msg += "🎯 TP1: `" + DoubleToString(plan.tp1, (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS)) + "` (" + DoubleToString(plan.pipsTP1, 1) + " pips | " + DoubleToString(plan.tp1Odds, 0) + "%)\n";
      msg += "🎯 TP2: `" + DoubleToString(plan.tp2, (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS)) + "` (" + DoubleToString(plan.pipsTP2, 1) + " pips | " + DoubleToString(plan.tp2Odds, 0) + "%)\n";
      msg += "🎯 TP3: `" + DoubleToString(plan.tp3, (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS)) + "` (" + DoubleToString(plan.pipsTP3, 1) + " pips | " + DoubleToString(plan.tp3Odds, 0) + "%)\n";
      msg += "━━━━━━━━━━━━━━━━━━━━\n";
      msg += "🎖 Chất lượng: " + qStars + " (" + EnumToString(plan.quality) + ")\n";
      msg += "📈 Xác suất thắng P(win): *" + DoubleToString(plan.pWin, 1) + "%*\n";
      msg += "🤖 Engine: `" + plan.engineName + "`\n";
      msg += "💡 Phân tích: _" + plan.rationale + "_\n";
      msg += "🕒 Thời gian: " + timeStr + "\n";

      int topicId = GetTopicIdForSymbol(plan.symbol);
      return SendRawMessage(msg, topicId);
   }

   // Kiểm tra kết nối Telegram (Nút TEST TG trên Cockpit)
   bool TestConnection()
   {
      string msg = "✅ *[NexusPilot Test Connection]*\nKết nối Telegram Bot thành công mỹ mãn!\nMúi giờ: GMT+" + IntegerToString(m_tzOffset) + " (" + m_tzLabel + ")";
      return SendRawMessage(msg, 0);
   }

   // Thực thi gửi HTTP POST bằng MQL5 WebRequest Native
   bool SendRawMessage(string text, int topicId = 0)
   {
      if(m_token == "" || m_chatId == "")
      {
         Print("[NexusPilot TG] Lỗi: Chưa điền TgToken hoặc TgChatID");
         return false;
      }

      string url = "https://api.telegram.org/bot" + m_token + "/sendMessage";
      string headers = "Content-Type: application/json\r\n";
      
      // JSON Escape
      string jsonEscaped = text;
      StringReplace(jsonEscaped, "\\", "\\\\");
      StringReplace(jsonEscaped, "\"", "\\\"");
      StringReplace(jsonEscaped, "\n", "\\n");
      StringReplace(jsonEscaped, "\r", "");

      string postData = "{\"chat_id\":\"" + m_chatId + "\",\"text\":\"" + jsonEscaped + "\",\"parse_mode\":\"Markdown\"";
      if(topicId > 0)
      {
         postData += ",\"message_thread_id\":" + IntegerToString(topicId);
      }
      postData += "}";

      char postBytes[];
      StringToCharArray(postData, postBytes, 0, WHOLE_ARRAY, CP_UTF8);
      // Loại bỏ byte null cuối mảng char
      int dataLen = ArraySize(postBytes);
      if(dataLen > 0 && postBytes[dataLen - 1] == 0) ArrayResize(postBytes, dataLen - 1);

      char resultBytes[];
      string resultHeaders;
      ResetLastError();
      int res = WebRequest("POST", url, headers, 4000, postBytes, resultBytes, resultHeaders);

      if(res == 200)
      {
         Print("[NexusPilot TG] Gửi tin nhắn thành công tới Telegram Chat ID: ", m_chatId);
         return true;
      }
      else
      {
         int err = GetLastError();
         Print("[NexusPilot TG] Gửi tin nhắn thất bại! Mã HTTP: ", res, ", Mã lỗi MQL5: ", err);
         if(err == 4014) // ERR_WEBREQUEST_NOT_ALLOWED
         {
            Print("[NexusPilot TG] HƯỚNG DẪN: Vui lòng vào MT5: Tools -> Options -> Expert Advisors -> Tích 'Allow WebRequest for listed URL' và thêm địa chỉ 'https://api.telegram.org'");
         }
         return false;
      }
   }
};
