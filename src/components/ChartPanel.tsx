import React, { useState } from 'react';
import { CandlestickChart, ExternalLink } from 'lucide-react';
import { Asset, JournalEntry } from '../types';

interface ChartPanelProps {
  assets: Asset[];
  journal: JournalEntry[];
  initialSymbol: string;
}

/** Map mã nội bộ → symbol TradingView */
const TV_SYMBOLS: Record<string, string> = {
  XAUUSD: 'OANDA:XAUUSD',
  EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  USDJPY: 'FX:USDJPY',
  AUDUSD: 'FX:AUDUSD',
  BTCUSD: 'BITSTAMP:BTCUSD',
  ETHUSD: 'BITSTAMP:ETHUSD',
  US30: 'DJ:DJI',
};

/**
 * Biểu đồ TradingView nhúng trực tiếp (Advanced Chart) — dữ liệu realtime từ TradingView.
 * Marker Entry/SL/TP của từng lệnh xem trong tab SỔ LỆNH.
 */
export const ChartPanel: React.FC<ChartPanelProps> = ({ assets, initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const symbols = assets.map((a) => a.symbol);

  const tvSymbol = TV_SYMBOLS[symbol] || symbol;
  const src =
    'https://www.tradingview.com/widgetembed/?' +
    `symbol=${encodeURIComponent(tvSymbol)}` +
    '&interval=15&theme=dark&style=1&locale=vi' +
    '&hide_side_toolbar=0&allow_symbol_change=0&withdateranges=1&show_popup_button=1';

  return (
    <div className="space-y-4">
      {/* Chọn mã */}
      <div className="glass-panel p-4 flex flex-wrap items-center gap-2">
        <CandlestickChart size={16} className="text-sky-400" />
        <span className="text-xs font-bold text-slate-300 mr-1">BIỂU ĐỒ</span>
        {symbols.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
              symbol === s
                ? 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400 hover:text-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
        <a
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border bg-[#0b0f19] border-[#1e2b48] text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
        >
          <ExternalLink size={12} /> Mở trên TradingView
        </a>
      </div>

      {/* Chart TradingView */}
      <div className="glass-panel p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
          <span className="font-bold text-slate-100 text-sm">#{symbol}</span>
          <span className="text-[10px] text-slate-500">
            Dữ liệu realtime: TradingView ({tvSymbol}) · nến 15m
          </span>
        </div>
        <div className="w-full bg-[#080c14] rounded-lg border border-[#1e2b48] overflow-hidden">
          <iframe
            key={tvSymbol}
            title={`TradingView chart ${symbol}`}
            src={src}
            style={{ width: '100%', height: 600, border: 0 }}
            allowFullScreen
          />
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Marker Entry/SL/TP của từng lệnh xem trong tab SỔ LỆNH · Nếu chart không tải, kiểm tra mạng có mở được tradingview.com không.
        </div>
      </div>
    </div>
  );
};
