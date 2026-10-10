import React, { useState, useEffect, useRef } from 'react';
import { CandlestickChart, RefreshCw } from 'lucide-react';
import { Asset, JournalEntry } from '../types';
import {
  Candle,
  fetchKrakenOHLC,
  hasNativeOHLC,
  pushQuote,
  getSynthCandles,
  candleSourceLabel,
} from '../lib/candles';

interface ChartPanelProps {
  assets: Asset[];
  journal: JournalEntry[];
  initialSymbol: string;
}

const VISIBLE = 120;
const W = 860;
const H = 420;
const PAD = { t: 12, r: 72, b: 24, l: 8 };

/**
 * Biểu đồ nến + marker lệnh (entry/SL/TP) từ sổ.
 * BTC/ETH: nến sàn Kraken thật · mã còn lại: nến tổng hợp từ giá realtime (ghi rõ).
 */
export const ChartPanel: React.FC<ChartPanelProps> = ({ assets, journal, initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const lastPushRef = useRef<{ symbol: string; price: number }>({ symbol: '', price: 0 });

  const symbols = assets.map((a) => a.symbol);

  // Nạp nến Kraken cho BTC/ETH
  useEffect(() => {
    if (!hasNativeOHLC(symbol)) return;
    let alive = true;
    setLoading(true);
    fetchKrakenOHLC(symbol, 15).then((cs) => {
      if (alive) {
        setCandles(cs);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [symbol, refreshTick]);

  // Gom nến tổng hợp từ giá realtime cho mã không có OHLC
  useEffect(() => {
    if (hasNativeOHLC(symbol)) return;
    const a = assets.find((x) => x.symbol === symbol);
    if (!a || a.price <= 0) return;
    const lp = lastPushRef.current;
    if (lp.symbol !== symbol || lp.price !== a.price) {
      pushQuote(symbol, a.price, Date.now());
      lastPushRef.current = { symbol, price: a.price };
      setCandles([...getSynthCandles(symbol)]);
    }
  }, [assets, symbol]);

  const visible = candles.slice(-VISIBLE);
  const trades = journal.filter((j) => j.symbol === symbol).slice(-8);

  // Khung giá: bao cả marker lệnh
  const markerPrices: number[] = [];
  trades.forEach((t) => {
    markerPrices.push(t.entryPrice, t.stopLoss, t.takeProfit);
  });
  const allLows = [...visible.map((c) => c.l), ...markerPrices];
  const allHighs = [...visible.map((c) => c.h), ...markerPrices];
  const lo = allLows.length ? Math.min(...allLows) : 0;
  const hi = allHighs.length ? Math.max(...allHighs) : 1;
  const pad = (hi - lo) * 0.08 || hi * 0.01 || 1;
  const minP = lo - pad;
  const maxP = hi + pad;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const yOf = (p: number) => PAD.t + (1 - (p - minP) / (maxP - minP)) * plotH;
  const n = Math.max(1, visible.length);
  const cw = plotW / n;
  const bw = Math.max(1.5, cw * 0.62);
  const xOf = (i: number) => PAD.l + i * cw + cw / 2;

  const last = visible[visible.length - 1];
  const first = visible[0];
  const chgPct = last && first && first.o > 0 ? (((last.c - first.o) / first.o) * 100).toFixed(2) : '0.00';
  const up = last ? last.c >= last.o : true;

  const priceTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minP + (maxP - minP) * f);
  const timeIdx = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1].filter(
    (v, i, a) => a.indexOf(v) === i && v < n
  );

  const fmtT = (t: number) =>
    new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
        {hasNativeOHLC(symbol) && (
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border bg-[#0b0f19] border-[#1e2b48] text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> Tải lại nến
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="glass-panel p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
          <span className="font-bold text-slate-100 text-sm">#{symbol}</span>
          {last && (
            <>
              <span className="text-slate-400">O <b className="text-slate-200">{last.o}</b></span>
              <span className="text-slate-400">H <b className="text-emerald-400">{last.h}</b></span>
              <span className="text-slate-400">L <b className="text-rose-400">{last.l}</b></span>
              <span className="text-slate-400">C <b className={up ? 'text-emerald-300' : 'text-rose-300'}>{last.c}</b></span>
              <span className={Number(chgPct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {Number(chgPct) >= 0 ? '+' : ''}{chgPct}%
              </span>
            </>
          )}
          <span className="ml-auto text-[10px] text-slate-500">{candleSourceLabel(symbol)} · nến 15m (Kraken) / 5m (tổng hợp)</span>
        </div>

        <div className="w-full bg-[#080c14] rounded-lg border border-[#1e2b48] overflow-hidden">
          {loading ? (
            <div className="h-[420px] flex items-center justify-center text-xs text-slate-500">
              Đang tải nến từ Kraken…
            </div>
          ) : visible.length === 0 ? (
            <div className="h-[420px] flex items-center justify-center text-xs text-slate-500 text-center px-6">
              Chưa có nến cho {symbol} — nến tổng hợp sẽ hình thành dần theo giá realtime (mỗi 5 phút 1 nến).
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
              {/* lưới ngang + nhãn giá */}
              {priceTicks.map((p, i) => (
                <g key={i}>
                  <line x1={PAD.l} y1={yOf(p)} x2={W - PAD.r} y2={yOf(p)} stroke="#141d33" strokeWidth="1" />
                  <text x={W - PAD.r + 6} y={yOf(p) + 4} fill="#64748b" fontSize="10" fontFamily="monospace">
                    {p.toLocaleString('en-US', { maximumFractionDigits: 5 })}
                  </text>
                </g>
              ))}
              {/* nhãn thời gian */}
              {timeIdx.map((i) => (
                <text
                  key={i}
                  x={xOf(i)}
                  y={H - 6}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {visible[i] ? fmtT(visible[i].t) : ''}
                </text>
              ))}

              {/* marker lệnh: entry / SL / TP */}
              {trades.map((t) => (
                <g key={t.id} opacity="0.85">
                  <line x1={PAD.l} y1={yOf(t.entryPrice)} x2={W - PAD.r} y2={yOf(t.entryPrice)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 3" />
                  <line x1={PAD.l} y1={yOf(t.stopLoss)} x2={W - PAD.r} y2={yOf(t.stopLoss)} stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1={PAD.l} y1={yOf(t.takeProfit)} x2={W - PAD.r} y2={yOf(t.takeProfit)} stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={W - PAD.r + 6} y={yOf(t.entryPrice) - 4} fill="#f59e0b" fontSize="9" fontFamily="monospace">
                    {t.direction} {t.entryPrice}
                  </text>
                </g>
              ))}

              {/* nến */}
              {visible.map((c, i) => {
                const isUp = c.c >= c.o;
                const col = isUp ? '#26a69a' : '#ef5350';
                const x = xOf(i);
                return (
                  <g key={c.t}>
                    <line x1={x} y1={yOf(c.h)} x2={x} y2={yOf(c.l)} stroke={col} strokeWidth="1" />
                    <rect
                      x={x - bw / 2}
                      y={yOf(Math.max(c.o, c.c))}
                      width={bw}
                      height={Math.max(1, Math.abs(yOf(c.o) - yOf(c.c)))}
                      fill={col}
                    />
                  </g>
                );
              })}

              {/* đường giá hiện tại */}
              {last && (
                <g>
                  <line x1={PAD.l} y1={yOf(last.c)} x2={W - PAD.r} y2={yOf(last.c)} stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 3" />
                  <rect x={W - PAD.r + 2} y={yOf(last.c) - 9} width={PAD.r - 8} height={18} rx={3} fill="#0c4a6e" />
                  <text x={W - PAD.r + 6} y={yOf(last.c) + 4} fill="#e0f2fe" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    {last.c}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1"><span className="w-6 h-0 border-t-2 border-dashed border-amber-500 inline-block" /> Entry</span>
          <span className="flex items-center gap-1"><span className="w-6 h-0 border-t-2 border-dotted border-red-500 inline-block" /> SL</span>
          <span className="flex items-center gap-1"><span className="w-6 h-0 border-t-2 border-dotted border-emerald-500 inline-block" /> TP</span>
          <span className="ml-auto">{visible.length} nến · marker từ {trades.length} lệnh gần nhất trong sổ</span>
        </div>
      </div>
    </div>
  );
};
