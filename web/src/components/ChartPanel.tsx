import React, { useState, useEffect, useRef } from 'react';
import { CandlestickChart, RefreshCw } from 'lucide-react';
import { Asset, JournalEntry } from '../types';
import {
  Candle,
  QuotePoint,
  fetchKrakenOHLC,
  hasNativeOHLC,
  pushQuotePoint,
  getQuoteHistory,
  candleSourceLabel,
} from '../lib/candles';

interface ChartPanelProps {
  assets: Asset[];
  journal: JournalEntry[];
  initialSymbol: string;
}

const VISIBLE_CANDLES = 120;
const MAX_POINTS = 300;
const W = 860;
const H = 420;
const PAD = { t: 12, r: 72, b: 24, l: 8 };

/**
 * Biểu đồ giá + marker lệnh (Entry/SL/TP) từ sổ.
 * - BTC/ETH: nến thật từ sàn Kraken.
 * - Mã còn lại: ĐƯỜNG GIÁ vẽ từ quote realtime mỗi lần poll (trung thực — không giả nến).
 */
export const ChartPanel: React.FC<ChartPanelProps> = ({ assets, journal, initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [points, setPoints] = useState<QuotePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const lastPushRef = useRef<{ symbol: string; price: number; t: number }>({ symbol: '', price: 0, t: 0 });

  const symbols = assets.map((a) => a.symbol);
  const isCandleMode = hasNativeOHLC(symbol);

  // Nến Kraken cho BTC/ETH
  useEffect(() => {
    if (!isCandleMode) return;
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
  }, [symbol, refreshTick, isCandleMode]);

  // Đường giá từ quote realtime cho mã không có OHLC
  useEffect(() => {
    if (isCandleMode) return;
    const a = assets.find((x) => x.symbol === symbol);
    if (!a || a.price <= 0) return;
    const nowTs = Date.now();
    const lp = lastPushRef.current;
    const priceChanged = lp.symbol !== symbol || lp.price !== a.price;
    const timePassed = nowTs - lp.t > 30000;
    if (priceChanged || timePassed) {
      pushQuotePoint(symbol, a.price, nowTs);
      lastPushRef.current = { symbol, price: a.price, t: nowTs };
      setPoints([...getQuoteHistory(symbol)]);
    }
  }, [assets, symbol, isCandleMode]);

  const trades = journal.filter((j) => j.symbol === symbol).slice(-8);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  // ---- Chuẩn bị dữ liệu vẽ ----
  let minP = 0;
  let maxP = 1;
  let linePts: { x: number; y: number; t: number; price: number }[] = [];
  let candleData: Candle[] = [];
  let lastPrice = 0;
  let chgPct = '0.00';
  let up = true;
  let ohlc: { o: number; h: number; l: number; c: number } | null = null;

  if (isCandleMode) {
    candleData = candles.slice(-VISIBLE_CANDLES);
    const markerPrices: number[] = [];
    trades.forEach((t) => markerPrices.push(t.entryPrice, t.stopLoss, t.takeProfit));
    const lows = [...candleData.map((c) => c.l), ...markerPrices];
    const highs = [...candleData.map((c) => c.h), ...markerPrices];
    const lo = lows.length ? Math.min(...lows) : 0;
    const hi = highs.length ? Math.max(...highs) : 1;
    const pad = (hi - lo) * 0.08 || hi * 0.01 || 1;
    minP = lo - pad;
    maxP = hi + pad;
    const last = candleData[candleData.length - 1];
    const first = candleData[0];
    if (last) {
      lastPrice = last.c;
      ohlc = { o: last.o, h: last.h, l: last.l, c: last.c };
      up = last.c >= last.o;
      if (first && first.o > 0) chgPct = (((last.c - first.o) / first.o) * 100).toFixed(2);
    }
  } else {
    const pts = points.slice(-MAX_POINTS);
    if (pts.length > 0) {
      const prices = pts.map((p) => p.price);
      const lo = Math.min(...prices);
      const hi = Math.max(...prices);
      const pad = (hi - lo) * 0.15 || hi * 0.005 || 1;
      minP = lo - pad;
      maxP = hi + pad;
      const n = pts.length;
      linePts = pts.map((p, i) => ({
        x: PAD.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
        y: 0, // tính sau
        t: p.t,
        price: p.price,
      }));
      lastPrice = pts[pts.length - 1].price;
      const firstP = pts[0].price;
      up = lastPrice >= firstP;
      if (firstP > 0) chgPct = (((lastPrice - firstP) / firstP) * 100).toFixed(2);
    }
  }

  const yOf = (p: number) => PAD.t + (1 - (p - minP) / (maxP - minP)) * plotH;
  linePts = linePts.map((pt) => ({ ...pt, y: yOf(pt.price) }));

  const priceTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minP + (maxP - minP) * f);
  const fmtT = (t: number) =>
    new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const timeLabels = (() => {
    if (isCandleMode) {
      const n = candleData.length;
      return [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]
        .filter((v, i, a) => a.indexOf(v) === i && v < n)
        .map((i) => ({ x: 0, idx: i, t: candleData[i]?.t ?? 0, isCandle: true }));
    }
    const n = linePts.length;
    if (n === 0) return [];
    const idxs = [0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
    return idxs.map((i) => ({ x: linePts[i].x, idx: i, t: linePts[i].t, isCandle: false }));
  })();

  const hasData = isCandleMode ? candleData.length > 0 : linePts.length > 0;
  const polyPoints = linePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

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
        {isCandleMode && (
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
          {isCandleMode && ohlc ? (
            <>
              <span className="text-slate-400">O <b className="text-slate-200">{ohlc.o}</b></span>
              <span className="text-slate-400">H <b className="text-emerald-400">{ohlc.h}</b></span>
              <span className="text-slate-400">L <b className="text-rose-400">{ohlc.l}</b></span>
              <span className="text-slate-400">C <b className={up ? 'text-emerald-300' : 'text-rose-300'}>{ohlc.c}</b></span>
            </>
          ) : (
            hasData && (
              <span className="text-slate-400">Giá <b className={up ? 'text-emerald-300' : 'text-rose-300'}>{lastPrice}</b></span>
            )
          )}
          {hasData && (
            <span className={Number(chgPct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {Number(chgPct) >= 0 ? '+' : ''}{chgPct}%
            </span>
          )}
          <span className="ml-auto text-[10px] text-slate-500">{candleSourceLabel(symbol)}</span>
        </div>

        <div className="w-full bg-[#080c14] rounded-lg border border-[#1e2b48] overflow-hidden">
          {loading ? (
            <div className="h-[420px] flex items-center justify-center text-xs text-slate-500">
              Đang tải nến từ Kraken…
            </div>
          ) : !hasData ? (
            <div className="h-[420px] flex items-center justify-center text-xs text-slate-500 text-center px-6">
              Đang chờ giá realtime cho {symbol} — đường giá sẽ vẽ dần theo mỗi lần poll.
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
              {timeLabels.map((tl, i) => (
                <text
                  key={i}
                  x={tl.isCandle ? PAD.l + tl.idx * (plotW / Math.max(1, candleData.length)) + plotW / Math.max(1, candleData.length) / 2 : tl.x}
                  y={H - 6}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {tl.t ? fmtT(tl.t) : ''}
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

              {isCandleMode ? (
                /* nến Kraken */
                candleData.map((c, i) => {
                  const n = Math.max(1, candleData.length);
                  const cw = plotW / n;
                  const bw = Math.max(1.5, cw * 0.62);
                  const x = PAD.l + i * cw + cw / 2;
                  const isUp = c.c >= c.o;
                  const col = isUp ? '#26a69a' : '#ef5350';
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
                })
              ) : (
                /* đường giá từ quote realtime */
                <g>
                  <polygon
                    points={`${PAD.l},${PAD.t + plotH} ${polyPoints} ${linePts[linePts.length - 1]?.x ?? PAD.l},${PAD.t + plotH}`}
                    fill={up ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)'}
                  />
                  <polyline
                    points={polyPoints}
                    fill="none"
                    stroke={up ? '#26a69a' : '#ef5350'}
                    strokeWidth="2"
                  />
                  {linePts.length > 0 && (
                    <circle
                      cx={linePts[linePts.length - 1].x}
                      cy={linePts[linePts.length - 1].y}
                      r="4"
                      fill={up ? '#26a69a' : '#ef5350'}
                      stroke="#080c14"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )}

              {/* đường giá hiện tại */}
              {hasData && (
                <g>
                  <line x1={PAD.l} y1={yOf(lastPrice)} x2={W - PAD.r} y2={yOf(lastPrice)} stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 3" />
                  <rect x={W - PAD.r + 2} y={yOf(lastPrice) - 9} width={PAD.r - 8} height={18} rx={3} fill="#0c4a6e" />
                  <text x={W - PAD.r + 6} y={yOf(lastPrice) + 4} fill="#e0f2fe" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    {lastPrice}
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
          <span className="ml-auto">
            {isCandleMode
              ? `${candleData.length} nến`
              : `${linePts.length} điểm giá`}
            {' '}· marker từ {trades.length} lệnh gần nhất trong sổ
          </span>
        </div>
      </div>
    </div>
  );
};
