import React, { useState } from 'react';
import { AccountState, MarketContextState, Asset } from '../types';
import { ShieldCheck, ShieldAlert, Clock, Calculator, Send, AlertTriangle, X, Wallet } from 'lucide-react';
import { evalSessions } from '../lib/sessions';
import { CAPITAL_PRESETS, fmtUsd } from '../lib/account';

interface LeftDockProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountState;
  startBalance: number;
  onStartBalanceChange: (v: number) => void;
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
  startBalance,
  onStartBalanceChange,
  marketContext,
  selectedAsset,
  onCloseAllPositions,
  onTestTelegram,
  onUpdateRiskPct
}) => {
  const [slPoints, setSlPoints] = useState<number>(85);
  const [customCapital, setCustomCapital] = useState<string>('');

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

        {/* Vốn ảo — chọn số vốn ban đầu */}
        <div className="bg-[#0b0f19] p-2.5 rounded border border-[#1e2b48] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Wallet size={13} className="text-amber-400" />
              VỐN ẢO (PAPER)
            </span>
            <span className="text-[10px] font-mono text-slate-400">đang: {fmtUsd(startBalance)}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {CAPITAL_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => onStartBalanceChange(p)}
                className={`py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                  startBalance === p
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-[#17223b] border-[#243356] text-slate-400 hover:text-slate-200'
                }`}
              >
                {p >= 1000 ? `$${p / 1000}K` : `$${p}`}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              placeholder="Số vốn khác ($)"
              value={customCapital}
              onChange={(e) => setCustomCapital(e.target.value)}
              className="flex-1 min-w-0 bg-[#17223b] border border-[#243356] rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            <button
              onClick={() => {
                const v = Number(customCapital);
                if (v > 0) {
                  onStartBalanceChange(v);
                  setCustomCapital('');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-bold hover:bg-amber-500/30"
            >
              ĐẶT
            </button>
          </div>
          <div className="text-[10px] text-slate-500">
            Balance = vốn ảo + P&L đã thực hiện từ sổ · Equity = Balance + P&L thả nổi
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

      {/* 2. Sessions & Candle Timer — trạng thái thật theo múi giờ sàn */}
      <div className="glass-panel p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={13} />
            PHIÊN GIAO DỊCH
          </span>
          <span className="text-[10px] font-mono text-sky-400">giờ sàn thật</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {evalSessions(new Date()).map((s) => (
            <div
              key={s.id}
              className={`p-1.5 rounded text-center border ${
                s.isOpen
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold'
                  : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400'
              }`}
              title={`${s.label} ${s.time} — ${s.nextLabel} ${Math.floor(s.minsToNext / 60)}h${String(Math.floor(s.minsToNext % 60)).padStart(2, '0')}p`}
            >
              {s.label.toUpperCase()} {s.isOpen ? '●' : '○'}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between bg-[#0b0f19] p-2 rounded border border-[#1e2b48] text-xs">
          <span className="text-slate-400">Đóng nến hiện tại:</span>
          <span className="font-mono font-bold text-sky-400 text-sm">
            {String(timerMin).padStart(2, '0')}:{String(timerSec).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 3. MTF Trend Matrix — dữ liệu thật từ engine */}
      <div className="glass-panel p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>XU HƯỚNG ĐA KHUNG (MTF)</span>
          <span className="text-[10px] font-mono text-sky-400">#{selectedAsset.symbol}</span>
        </div>
        {(() => {
          const sig = selectedAsset.signalDir;
          const m15 = sig === 'BUY' ? 'BULL' : sig === 'SELL' ? 'BEAR' : 'FLAT';
          const h1 = selectedAsset.trendH1;
          const h4 = selectedAsset.change24h > 0.3 ? 'BULL' : selectedAsset.change24h < -0.3 ? 'BEAR' : 'FLAT';
          const d1 = selectedAsset.change24h > 0 ? 'BULL' : selectedAsset.change24h < 0 ? 'BEAR' : 'FLAT';
          const cell = (tf: string, t: string) => {
            const cls = t === 'BULL' ? 'text-emerald-400' : t === 'BEAR' ? 'text-rose-400' : 'text-slate-500';
            const arrow = t === 'BULL' ? '▲' : t === 'BEAR' ? '▼' : '●';
            return (
              <div className="bg-[#0b0f19] p-1.5 rounded border border-[#1e2b48]">
                <div className="text-[10px] text-slate-400 font-normal">{tf}</div>
                <div className={cls}>{arrow} {t}</div>
              </div>
            );
          };
          return (
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono font-bold">
              {cell('M15', m15)}
              {cell('H1', h1)}
              {cell('H4', h4)}
              {cell('D1', d1)}
            </div>
          );
        })()}
        <div className="text-[10px] text-slate-500">M15/H1 từ engine · H4/D1 từ biến động 24h thật</div>
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
