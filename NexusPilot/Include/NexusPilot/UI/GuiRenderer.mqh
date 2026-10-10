//+------------------------------------------------------------------+
//|                                                  GuiRenderer.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"
#include "Theme.mqh"

class CGuiRenderer
{
public:
   // Vẽ hình chữ nhật nền
   static bool CreateBox(long chartId, string name, int x, int y, int width, int height, color bgColor, color borderColor = clrNONE, int corner = CORNER_LEFT_UPPER)
   {
      string objName = NP_PREFIX + name;
      if(ObjectFind(chartId, objName) < 0)
      {
         if(!ObjectCreate(chartId, objName, OBJ_RECTANGLE_LABEL, 0, 0, 0)) return false;
      }
      ObjectSetInteger(chartId, objName, OBJPROP_CORNER, corner);
      ObjectSetInteger(chartId, objName, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chartId, objName, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(chartId, objName, OBJPROP_XSIZE, width);
      ObjectSetInteger(chartId, objName, OBJPROP_YSIZE, height);
      ObjectSetInteger(chartId, objName, OBJPROP_BGCOLOR, bgColor);
      ObjectSetInteger(chartId, objName, OBJPROP_BORDER_COLOR, (borderColor == clrNONE) ? bgColor : borderColor);
      ObjectSetInteger(chartId, objName, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(chartId, objName, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, objName, OBJPROP_HIDDEN, true);
      ObjectSetInteger(chartId, objName, OBJPROP_ZORDER, 1);
      return true;
   }

   // Vẽ nhãn chữ text
   static bool CreateLabel(long chartId, string name, string text, int x, int y, color textColor, int fontSize = 9, string font = "Segoe UI", int corner = CORNER_LEFT_UPPER)
   {
      string objName = NP_PREFIX + name;
      if(ObjectFind(chartId, objName) < 0)
      {
         if(!ObjectCreate(chartId, objName, OBJ_LABEL, 0, 0, 0)) return false;
      }
      ObjectSetInteger(chartId, objName, OBJPROP_CORNER, corner);
      ObjectSetInteger(chartId, objName, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chartId, objName, OBJPROP_YDISTANCE, y);
      ObjectSetString(chartId, objName, OBJPROP_TEXT, text);
      ObjectSetInteger(chartId, objName, OBJPROP_COLOR, textColor);
      ObjectSetInteger(chartId, objName, OBJPROP_FONTSIZE, fontSize);
      ObjectSetString(chartId, objName, OBJPROP_FONT, font);
      ObjectSetInteger(chartId, objName, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, objName, OBJPROP_HIDDEN, true);
      ObjectSetInteger(chartId, objName, OBJPROP_ZORDER, 10);
      return true;
   }

   // Cập nhật text nhanh không gây vẽ lại toàn bộ
   static void UpdateLabel(long chartId, string name, string text, color clr = clrNONE)
   {
      string objName = NP_PREFIX + name;
      if(ObjectFind(chartId, objName) >= 0)
      {
         ObjectSetString(chartId, objName, OBJPROP_TEXT, text);
         if(clr != clrNONE)
         {
            ObjectSetInteger(chartId, objName, OBJPROP_COLOR, clr);
         }
      }
   }

   // Vẽ nút bấm tương tác
   static bool CreateButton(long chartId, string name, string text, int x, int y, int width, int height, color bgColor, color textColor, int fontSize = 9, int corner = CORNER_LEFT_UPPER)
   {
      string objName = NP_PREFIX + name;
      if(ObjectFind(chartId, objName) < 0)
      {
         if(!ObjectCreate(chartId, objName, OBJ_BUTTON, 0, 0, 0)) return false;
      }
      ObjectSetInteger(chartId, objName, OBJPROP_CORNER, corner);
      ObjectSetInteger(chartId, objName, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chartId, objName, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(chartId, objName, OBJPROP_XSIZE, width);
      ObjectSetInteger(chartId, objName, OBJPROP_YSIZE, height);
      ObjectSetString(chartId, objName, OBJPROP_TEXT, text);
      ObjectSetInteger(chartId, objName, OBJPROP_BGCOLOR, bgColor);
      ObjectSetInteger(chartId, objName, OBJPROP_COLOR, textColor);
      ObjectSetInteger(chartId, objName, OBJPROP_FONTSIZE, fontSize);
      ObjectSetString(chartId, objName, OBJPROP_FONT, CTheme::FontMain());
      ObjectSetInteger(chartId, objName, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, objName, OBJPROP_HIDDEN, true);
      ObjectSetInteger(chartId, objName, OBJPROP_ZORDER, 20);
      return true;
   }

   // Dọn dẹp sạch toàn bộ đối tượng thuộc NexusPilot khi tháo EA/Indicator
   static void DestroyAll(long chartId)
   {
      int total = ObjectsTotal(chartId, 0, -1);
      for(int i = total - 1; i >= 0; i--)
      {
         string name = ObjectName(chartId, i, 0, -1);
         if(StringFind(name, NP_PREFIX) == 0)
         {
            ObjectDelete(chartId, name);
         }
      }
      ChartRedraw(chartId);
   }
};
