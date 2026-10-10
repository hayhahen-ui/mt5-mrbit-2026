import React, { useState } from 'react';
import { AccountState, MarketContextState, Asset } from '../types';
import { ShieldCheck, ShieldAlert, Clock, Calculator, Send, AlertTriangle, X } from 'lucide-react';

interface LeftDockProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountState;
  marketContext: MarketContextState;
  selectedAsset: Asset;
  onCloseAllPositions: () => void;
  onTestTelegram: () => void;
  onUpdateRiskPct: (pct: number) => void;
}

export const LeftDock: React.FC<LeftDockProps> = ({
  isOpen,
  onClose,
  account,
  marketContext,
  selectedAsset,
  onCloseAllPositions,
  onTestTelegram,
  onUpdateRiskPct
}) => {
  const [slPoints, setSlPoints] = useState<number>(85);

  if (!isOpen) return null;

  // Calculate suggested lot
  const riskAmount = account.equity * (account.riskPct / 100);
  const pointValue = selectedAsset.category === 'Crypto' ? 1.0 : (selectedAsset.category === 'Metals' ? 1.0 : 10.0);
  const calculatedLot = Math.max(0.01, Number(((riskAmount / (slPoints * pointValue))).toFixed(2)));

  const timerMin = Math.floor(marketContext.candleRemainingSec / 60);
  const timerSec = marketContext.candleRemainingSec % 60;

  return (
    <aside className="w-80 bg-[#111625] border-r border-[#1e2b48] h-[calc(100vh-57px)] overflow-y-auto p-4 flex flex-col gap-4 z-40 transition-all duration-300 shadow-2xl">
      {/* Dock Title */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2b48]">
        <div className="flex items-center gap-2">
          <span className="text-sky-400 font-bold text-sm">⚡ NEXUS DOCK</span>
          <span className="text-[10px] text-slate-400 font-mono">Phím K</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#17223b]"
        >
          <X size={16} />
        </button>
      </div>

      {/* 1. Account & Prop Firm Guard */}
      <div className="glass-panel p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>TÀI KHOẢN & VỐN</span>
          <span className="font-mono text-sky-400">1:{account.leverage}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#0b0f19] p-2 rounded border border-[#1e2b48]">
            <div className="text-[10px] text-slate-400">Balance</div>
            <div className="font-mono font-bold text-slate-200">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-[#0b0f19] p-2 rounded border border-[#1e2b48]">
            <div className="text-[10px] text-slate-400">Equity</div>
            <div className="font-mono font-bold text-emerald-400">${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Prop Firm Drawdown Meter */}
        <div className="bg-[#0b0f19] p-2.5 rounded border border-[#1e2b48] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              {account.isPropFirmLocked ? (
                <ShieldAlert size={14} className="text-rose-500" />
              ) : (
                <ShieldCheck size={14} className="text-emerald-400" />
              )}
              PROP FIRM GUARD
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              account.isPropFirmLocked ? 'bg-rose-950 text-rose-400' : 'bg-emerald-950 text-emerald-400'
            }`}>
              {account.isPropFirmLocked ? 'LOCKED' : 'SAFE'}
            </span>
          </div>

          <div className="w-full bg-[#17223b] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                account.dailyDrawdownPct > 3.0 ? 'bg-rose-500' : (account.dailyDrawdownPct > 2.0 ? 'bg-amber-500' : 'bg-emerald-400')
              }`}
              style={{ width: `${Math.min(100, (account.dailyDrawdownPct / account.maxDailyLossPct) * 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>DD hôm nay: {account.dailyDrawdownPct}%</span>
            <span>Giới hạn: {account.maxDailyLossPct}%</span>
          </div>
        </div>
      </div>

      {/* 2. Sessions & Candle Timer */}
      <div className="glass-panel p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={13} />
            PHIÊN GIAO DỊCH
          </span>
          <span className="text-[10px] font-mono text-sky-400">GMT+2</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className={`p-1.5 rounded text-center border ${
            marketContext.sessions.sydney ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold' : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400'
          }`}>
            SYDNEY {marketContext.sessions.sydney ? '●' : '○'}
          </div>
          <div className={`p-1.5 rounded text-center border ${
            marketContext.sessions.tokyo ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold' : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400'
          }`}>
            TOKYO {marketContext.sessions.tokyo ? '●' : '○'}
          </div>
          <div className={`p-1.5 rounded text-center border ${
            marketContext.sessions.london ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold' : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400'
          }`}>
            LONDON {marketContext.sessions.london ? '●' : '○'}
          </div>
          <div className={`p-1.5 rounded text-center border ${
            marketContext.sessions.newYork ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold' : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400'
          }`}>
            NEW YORK {marketContext.sessions.newYork ? '●' : '○'}
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#0b0f19] p-2 rounded border border-[#1e2b48] text-xs">
          <span className="text-slate-400">Đóng nến hiện tại:</span>
          <span className="font-mono font-bold text-sky-400 text-sm">
            {String(timerMin).padStart(2, '0')}:{String(timerSec).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 3. MTF Trend Matrix */}
      <div className="glass-panel p-3.5 space-y-2">
        <div className="text-xs text-slate-400">XU HƯỚNG ĐA KHUNG (MTF)</div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono font-bold">
          <div className="bg-[#0b0f19] p-1.5 rounded border border-[#1e2b48]">
            <div className="text-[10px] text-slate-400 font-normal">M15</div>
            <div className="text-emerald-400">▲ BULL</div>
          </div>
          <div className="bg-[#0b0f19] p-1.5 rounded border border-[#1e2b48]">
            <div className="text-[10px] text-slate-400 font-normal">H1</div>
            <div className="text-emerald-400">▲ BULL</div>
          </div>
          <div className="bg-[#0b0f19] p-1.5 rounded border border-[#1e2b48]">
            <div className="text-[10px] text-slate-400 font-normal">H4</div>
            <div className="text-emerald-400">▲ BULL</div>
          </div>
          <div className="bg-[#0b0f19] p-1.5 rounded border border-[#1e2b48]">
            <div className="text-[10px] text-slate-400 font-normal">D1</div>
            <div className="text-emerald-400">▲ BULL</div>
          </div>
        </div>
      </div>

      {/* 4. Risk & Lot Calculator (CALC) */}
      <div className="glass-panel p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Calculator size={13} />
            MÁY TÍNH LOT (CALC)
          </span>
          <span className="font-mono text-emerald-400 font-bold">{calculatedLot} Lot</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>Rủi ro vốn:</span>
            <span className="font-mono font-bold text-sky-400">{account.riskPct}% (${riskAmount.toFixed(0)})</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.5"
            value={account.riskPct}
            onChange={(e) => onUpdateRiskPct(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between text-xs bg-[#0b0f19] p-2 rounded border border-[#1e2b48]">
          <span className="text-slate-400">Khoảng SL (Pips):</span>
          <input
            type="number"
            value={slPoints}
            onChange={(e) => setSlPoints(Math.max(10, Number(e.target.value)))}
            className="w-16 bg-[#17223b] text-right font-mono text-slate-200 px-1.5 py-0.5 rounded border border-[#243356] text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* 5. Telegram Bot Tester */}
      <div className="glass-panel p-3.5 space-y-2.5">
        <div className="text-xs text-slate-400">CẢNH BÁO TELEGRAM</div>
        <button
          onClick={onTestTelegram}
          className="w-full py-2 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Send size={13} />
          BẤM TEST TELEGRAM
        </button>
      </div>

      {/* 6. Emergency Close All */}
      <div className="mt-auto pt-2">
        <button
          onClick={onCloseAllPositions}
          className="w-full py-2.5 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-rose-950"
        >
          <AlertTriangle size={15} />
          ĐÓNG TOÀN BỘ LỆNH (CLOSE ALL)
        </button>
      </div>
    </aside>
  );
};
