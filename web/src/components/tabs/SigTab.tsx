import React, { useState } from 'react';
import { Sliders, Check, Shield, AlertCircle, Sparkles } from 'lucide-react';

export const SigTab: React.FC = () => {
  const [smcEnabled, setSmcEnabled] = useState(true);
  const [trendEnabled, setTrendEnabled] = useState(true);
  const [mrevEnabled, setMrevEnabled] = useState(true);

  return (
    <div className="space-y-4">
      {/* 1. DÒNG "BỊ CHẶN" (BLOCKED REASONS BANNER) */}
      <div className="glass-panel p-5 border-l-4 border-l-amber-500 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
          <AlertCircle size={15} />
          <span>DÒNG CHẨN ĐOÁN LÝ DO "BỊ CHẶN" (TRANSPARENT DIAGNOSTICS)</span>
        </div>
        <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-xs font-mono">
          <div className="text-slate-200 font-semibold">
            ✓ Trạng thái hiện tại: <span className="text-emerald-400">BÌNH THƯỜNG - TÍN HIỆU SMC HỢP LỆ VỪA KÍCH HOẠT</span>
          </div>
          <div className="text-slate-400 text-[11px] mt-1">
            Không có lệnh bị chặn: Bộ lọc Tin tức an toàn, Spread trong ngưỡng 1.4 pips, Tài khoản không vi phạm Drawdown.
          </div>
        </div>
      </div>

      {/* 2. ENGINE TOGGLES */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">QUẢN LÝ CÁC SIGNAL ENGINES THUẬT TOÁN</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Clean Architecture · Multi-Engine</span>
        </div>

        <div className="space-y-3">
          {/* Engine 1: SMC */}
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 text-sm">1. SMC ICT Alpha</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  SMART MONEY
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Phát hiện Order Block (OB), Fair Value Gap (FVG), Phá vỡ cấu trúc đỉnh đáy (BOS/CHoCH) và Liquidity Sweep.
              </div>
            </div>
            <button
              onClick={() => setSmcEnabled(!smcEnabled)}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors font-mono ${
                smcEnabled ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-[#17223b] text-slate-400 hover:text-white'
              }`}
            >
              {smcEnabled ? 'ĐANG BẬT [ON]' : 'ĐÃ TẮT [OFF]'}
            </button>
          </div>

          {/* Engine 2: Trend Ribbon */}
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 text-sm">2. Trend Ribbon Pro</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  MOMENTUM
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Theo dõi dải đường trung bình động EMA 21, 50, 200 kết hợp bộ lọc biến động ATR để bắt nhịp sóng hồi Pullback.
              </div>
            </div>
            <button
              onClick={() => setTrendEnabled(!trendEnabled)}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors font-mono ${
                trendEnabled ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-[#17223b] text-slate-400 hover:text-white'
              }`}
            >
              {trendEnabled ? 'ĐANG BẬT [ON]' : 'ĐÃ TẮT [OFF]'}
            </button>
          </div>

          {/* Engine 3: Mean Reversion */}
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 text-sm">3. Mean Reversion Sweep</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                  REVERSAL
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Bắt tín hiệu quét đỉnh/đáy phiên Á ngoài dải Bollinger Bands kết hợp phân kỳ RSI 14 cực đoan.
              </div>
            </div>
            <button
              onClick={() => setMrevEnabled(!mrevEnabled)}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors font-mono ${
                mrevEnabled ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-[#17223b] text-slate-400 hover:text-white'
              }`}
            >
              {mrevEnabled ? 'ĐANG BẬT [ON]' : 'ĐÃ TẮT [OFF]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
