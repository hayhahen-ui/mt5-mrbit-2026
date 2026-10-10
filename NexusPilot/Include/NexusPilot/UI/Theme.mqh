//+------------------------------------------------------------------+
//|                                                        Theme.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class CTheme
{
public:
   // Bảng màu Dark Cyber HUD / Glassmorphism
   static color BgMain()         { return C'17,20,29';   } // Nền Cockpit chính
   static color BgHeader()       { return C'25,30,44';   } // Nền thanh tiêu đề
   static color BgCard()         { return C'30,36,53';   } // Nền khối card
   static color BgInput()        { return C'21,25,37';   } // Nền ô input
   static color Border()         { return C'45,55,78';   } // Viền khối
   static color Accent()         { return C'14,165,233'; } // Xanh Cyan năng động
   static color BuyGreen()       { return C'16,185,129'; } // Xanh lá Mua / Lãi
   static color SellRed()        { return C'239,68,68';  } // Đỏ Bán / Lỗ
   static color WarningAmber()   { return C'245,158,11'; } // Vàng Cảnh báo
   static color TextPrimary()    { return C'248,250,252';} // Chữ trắng sáng
   static color TextMuted()      { return C'148,163,184';} // Chữ xám phụ
   static color TextDimmed()     { return C'100,116,139';} // Chữ chìm

   // Phông chữ tiêu chuẩn
   static string FontMain()      { return "Segoe UI";    }
   static string FontMono()      { return "Consolas";    }
   static string FontBold()      { return "Segoe UI Bold";}

   // Kích thước chuẩn hóa theo tỉ lệ Scale (0.8 - 1.6)
   static int Scale(int baseSize, double scaleRatio)
   {
      double r = (scaleRatio < 0.8) ? 0.8 : ((scaleRatio > 1.6) ? 1.6 : scaleRatio);
      return (int)MathRound(baseSize * r);
   }
};
