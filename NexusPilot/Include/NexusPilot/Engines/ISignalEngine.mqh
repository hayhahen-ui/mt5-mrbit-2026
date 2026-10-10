//+------------------------------------------------------------------+
//|                                                ISignalEngine.mqh |
//|                                  NexusPilot NextGen Architecture |
//|                                  Copyright 2026, NexusPilot Team |
//+------------------------------------------------------------------+
#property copyright "NexusPilot Open Architecture"
#property strict

#include "../Defines.mqh"

class ISignalEngine
{
public:
   virtual ~ISignalEngine() {}
   virtual void             Init() = 0;
   virtual bool             Analyze(string symbol, ENUM_TIMEFRAMES tf, SignalPlan &plan) = 0;
   virtual string           GetName() const = 0;
   virtual ENUM_ENGINE_TYPE GetType() const = 0;
   virtual bool             IsEnabled() const = 0;
   virtual void             SetEnabled(bool enabled) = 0;
};
