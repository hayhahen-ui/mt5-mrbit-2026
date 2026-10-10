import React, { useEffect, useState } from 'react';
import { CandlestickChart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getTdCache } from '../lib/tdStore';
import { getTdKey } from '../lib/twelvedata';
import { detectPatterns, patternBias, CandlePattern } from '../lib/patterns';

const fmtTime = (t: number) =>
  new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/**
 * MẪU HÌNH NẾN — góc nhìn đa chiều từ nến 5m thật (TwelveData).
 * Tương đương trang "technical patterns" của MyFxBook nhưng tự tính từ dữ liệu thật.
 */
export const PatternsPanel: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const hasKey = !!getTdKey();
  const cache = getTdCache();
  const symbols = cache ? Object.keys(cache.candles) : [];

  const rows = symbols.map((sym) => {
    const candles = cache!.candles[sym] || [];
    const patterns: CandlePattern[] = detectPatterns(candles, 12);
    const bias = patternBias(patterns);
    return { sym, patterns: patterns.slice(0, 4), bias, n: candles.length };
  });

  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CandlestickChart size={16} className="text-amber-400" />
        <span className="font-bold text-sm text-slate-100">MẪU HÌNH NẾN — ĐA CHIỀU</span>
        <span className="text-[10px] font-mono text-slate-500">
          nến 5m TwelveData{cache ? ` · cập nhật ${fmtTime(cache.at)}` : ''}
        </span>
      </div>
      {!hasKey && (
        <div className="text-[11px] text-slate-400">
          Chưa có API key TwelveData — nhập key miễn phí tại mục{' '}
          <span className="text-sky-300 font-bold">HELP → DỮ LIỆU FOREX NÂNG CAO</span>{' '}
          để bật góc nhìn này.
        </div>
      )}
      {hasKey && rows.length === 0 && (
        <div className="text-[11px] text-slate-400">Đang tải nến… (chu kỳ đầu mất ~1 phút cho 9 cặp)</div>
      )}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(({ sym, patterns, bias, n }) => (
            <div key={sym} className="rounded-lg bg-slate-900/50 border border-slate-800 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-xs text-slate-200">{sym}</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold ${
                  bias > 0 ? 'text-emerald-300' : bias < 0 ? 'text-red-300' : 'text-slate-400'
                }`}>
                  {bias > 0 ? <TrendingUp size={11} /> : bias < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                  {bias > 0 ? `TĂNG +${bias}` : bias < 0 ? `GIẢM ${bias}` : 'TRUNG TÍNH'}
                </span>
              </div>
              {patterns.length === 0 && (
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
