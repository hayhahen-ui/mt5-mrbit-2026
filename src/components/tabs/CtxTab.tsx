import React from 'react';
import { MarketContextState, Asset } from '../../types';
import { Activity, BarChart2, Compass, Layers } from 'lucide-react';

interface CtxTabProps {
  marketContext: MarketContextState;
  asset: Asset;
}

export const CtxTab: React.FC<CtxTabProps> = ({ marketContext, asset }) => {
  return (
    <div className="space-y-4">
      {/* 1. Currency Strength Meter (CSM) */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">BẢNG ĐO SỨC MẠNH TIỀN TỆ (CURRENCY STRENGTH METER)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Quét 28 cặp tiền tệ</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {marketContext.csm.map((item) => (
            <div key={item.currency} className="bg-[#0b0f19] p-3 rounded-xl border border-[#1e2b48] space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-slate-200">{item.currency}</span>
                <span className={`text-xs font-bold ${
                  item.score >= 65 ? 'text-emerald-400' : (item.score <= 35 ? 'text-rose-400' : 'text-slate-300')
                }`}>
                  {item.score}%
                </span>
              </div>
              <div className="w-full bg-[#17223b] h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    item.score >= 65 ? 'bg-emerald-400' : (item.score <= 35 ? 'bg-rose-500' : 'bg-sky-400')
                  }`}
                  style={{ width: `${item.score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Volatility & Market Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <BarChart2 size={15} className="text-sky-400" />
            <span>ĐỘ BIẾN ĐỘNG & THANH KHOẢN (VOLATILITY)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-[#0b0f19] p-2.5 rounded-lg border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">ATR (14 kỳ)</div>
              <div className="text-sm font-bold text-slate-100">{marketContext.atr} pips</div>
            </div>
            <div className="bg-[#0b0f19] p-2.5 rounded-lg border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">SPREAD THỰC TẾ</div>
              <div className="text-sm font-bold text-sky-400">{asset.spread} pips</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Compass size={15} className="text-sky-400" />
            <span>ĐỒNG THUẬN XU HƯỚNG ĐA KHUNG (CONFLUENCE)</span>
          </div>

          <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">M15 Trend:</span>
              <strong className="text-emerald-400">▲ BULLISH (Pullback)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">H1 Trend:</span>
              <strong className="text-emerald-400">▲ BULLISH (EMA 21 &gt; 50 &gt; 200)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">H4 Trend:</span>
              <strong className="text-emerald-400">▲ BULLISH (Demand Zone)</strong>
            </div>
            <div className="flex justify-between border-t border-[#1e2b48] pt-1">
              <span className="text-slate-300">Đánh giá chung:</span>
              <strong className="text-sky-400">HỘI TỤ ĐỒNG THUẬN CAO (Q5)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
