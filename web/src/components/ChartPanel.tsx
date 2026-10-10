import React, { useState } from 'react';
import { CandlestickChart, ExternalLink, Calendar, AlertTriangle } from 'lucide-react';
import { Asset, JournalEntry, NewsEvent } from '../types';
import { currenciesForSymbol, ffMarketUrl, newsForSymbol } from '../lib/symbolNews';

interface ChartPanelProps {
  assets: Asset[];
  journal: JournalEntry[];
  initialSymbol: string;
  news?: NewsEvent[];
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
export const ChartPanel: React.FC<ChartPanelProps> = ({ assets, initialSymbol, news = [] }) => {
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

      {/* Lịch kinh tế riêng cho mã — không pha loãng bởi tin chung */}
      <SymbolNewsPanel symbol={symbol} news={news} />
    </div>
  );
};

const IMPACT_STYLE: Record<string, string> = {
  HIGH: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
  MED: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-600/40',
};

const SymbolNewsPanel: React.FC<{ symbol: string; news: NewsEvent[] }> = ({ symbol, news }) => {
  const curs = currenciesForSymbol(symbol);
  const items = newsForSymbol(news, symbol, 25);
  const ffUrl = ffMarketUrl(symbol);
  const highs = items.filter((e) => e.impact === 'HIGH').length;
  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-amber-400" />
          <span className="font-bold text-sm text-slate-100">LỊCH KINH TẾ — #{symbol}</span>
          <span className="text-[10px] font-mono text-slate-500">
            chỉ tin {curs.join(' + ')} · {items.length} tin ({highs} HIGH)
          </span>
        </div>
        {ffUrl && (
          <a href={ffUrl} target="_blank" rel="noreferrer"
             className="px-3 py-1.5 rounded-lg text-[11px] font-bold border bg-[#0b0f19] border-[#1e2b48] text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <ExternalLink size={12} /> Xem trên ForexFactory
          </a>
        )}
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-slate-500">Chưa có tin {curs.join('/')} trong lịch đã tải.</div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {items.map((e) => (
            <div key={e.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px] ${e.inWindow && e.impact === 'HIGH' ? 'bg-rose-950/40 border-rose-800' : 'bg-[#0b0f19] border-[#1e2b48]'}`}>
              {e.inWindow && e.impact === 'HIGH' && <AlertTriangle size={12} className="text-rose-400 shrink-0" />}
              <span className="font-mono text-slate-400 whitespace-nowrap w-24">{e.time}</span>
              <span className="font-mono font-bold text-sky-300 w-10">{e.currency}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${IMPACT_STYLE[e.impact]}`}>{e.impact}</span>
              <span className="text-slate-200 flex-1 min-w-0 truncate">{e.title}</span>
              {(e.forecast || e.previous) && (
                <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap hidden md:inline">
                  F:{e.forecast || '—'} P:{e.previous || '—'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-slate-500 font-mono">
        Nguồn: ForexFactory calendar qua /api/ff-calendar · Lọc đúng tiền tệ của #{symbol} để không bị pha loãng bởi tin chung.
      </div>
    </div>
  );
};
