import React, { useEffect, useState } from 'react';
import { CandlestickChart, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import { getTdCache } from '../lib/tdStore';
import { getTdKey, TD_LIST, getTdErrors } from '../lib/twelvedata';
import { detectPatterns, patternBias, CandlePattern } from '../lib/patterns';

const fmtTime = (t: number) =>
  new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/**
 * MẪU HÌNH NẾN — góc nhìn đa chiều từ nến 5m thật (TwelveData).
 * Tương đương trang "technical patterns" của MyFxBook nhưng tự tính từ dữ liệu thật.
 * Mã nào thiếu nến sẽ hiện RÕ lý do (không nuốt lỗi im lặng).
 */
export const PatternsPanel: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const bump = () => { setTick((x) => x + 1); setRefreshing(false); };
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    window.addEventListener('td-updated', bump);
    return () => { clearInterval(id); window.removeEventListener('td-updated', bump); };
  }, []);

  const hasKey = !!getTdKey();
  const cache = getTdCache();
  const errors = getTdErrors();

  const manualRefresh = () => {
    setRefreshing(true);
    try { window.dispatchEvent(new CustomEvent('td-refresh-now')); } catch { /* noop */ }
    setTimeout(() => setRefreshing(false), 120000); // hết chu kỳ ~100s
  };

  const rows = TD_LIST.map((sym) => {
    const candles = cache?.candles?.[sym] || [];
    const patterns: CandlePattern[] = detectPatterns(candles, 12);
    return { sym, patterns: patterns.slice(0, 4), bias: patternBias(patterns), n: candles.length, err: errors[sym]?.msg };
  });

  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CandlestickChart size={16} className="text-amber-400" />
        <span className="font-bold text-sm text-slate-100">MẪU HÌNH NẾN — ĐA CHIỀU</span>
        <span className="text-[10px] font-mono text-slate-500">
          nến 5m TwelveData{cache ? ` · cập nhật ${fmtTime(cache.at)}` : ''}
        </span>
        {hasKey && (
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="ml-auto px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang tải…' : 'Làm mới ngay'}
          </button>
        )}
      </div>
      {!hasKey && (
        <div className="text-[11px] text-slate-400">
          Chưa có API key TwelveData — nhập key miễn phí tại mục{' '}
          <span className="text-sky-300 font-bold">HELP → DỮ LIỆU FOREX NÂNG CAO</span>{' '}
          để bật góc nhìn này.
        </div>
      )}
      {hasKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(({ sym, patterns, bias, n, err }) => (
            <div key={sym} className="rounded-lg bg-slate-900/50 border border-slate-800 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-xs text-slate-200">{sym}</span>
                {n > 0 ? (
                  <span className={`flex items-center gap-1 text-[10px] font-bold ${
                    bias > 0 ? 'text-emerald-300' : bias < 0 ? 'text-red-300' : 'text-slate-400'
                  }`}>
                    {bias > 0 ? <TrendingUp size={11} /> : bias < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                    {bias > 0 ? `TĂNG +${bias}` : bias < 0 ? `GIẢM ${bias}` : 'TRUNG TÍNH'}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">{n} nến</span>
                )}
              </div>
              {n === 0 && (
                <div className="text-[10px] text-slate-500 flex items-start gap-1">
                  <AlertCircle size={11} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Chưa có nến.{' '}
                    {err ? <span className="text-red-300/90">Lỗi: {err}</span> : 'Đang chờ chu kỳ tải.'}
                  </span>
                </div>
              )}
              {patterns.length === 0 && n > 0 && (
                <div className="text-[10px] text-slate-500">Không có mẫu hình rõ trong 12 nến gần nhất ({n} nến).</div>
              )}
              {patterns.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] py-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    p.direction === 'bull' ? 'bg-emerald-400' : p.direction === 'bear' ? 'bg-red-400' : 'bg-slate-500'
                  }`} />
                  <span className="font-bold text-slate-200">{p.name}</span>
                  <span className="text-slate-500 truncate" title={p.detail}>
                    {p.age === 0 ? '· nến hiện tại' : `· ${p.age * 5} phút trước`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-slate-500">
        Mẫu hình tự tính từ dữ liệu thật (không phụ thuộc MyFxBook) — dùng tham khảo cùng radar tín hiệu.
      </div>
    </div>
  );
};
