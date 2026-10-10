import React, { useEffect, useState } from 'react';
import { Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { getOutlook, findSentiment, sentimentBias, getMfCred, SentimentRow } from '../lib/sentiment';
import { HEATMAP_SYMBOLS as TRACKED } from '../lib/priceHistory';

/** Panel tâm lý đám đông — MyFxBook Community Outlook (cần tài khoản user). */
export const SentimentPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [symbols, setSymbols] = useState<SentimentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const hasCred = !!getMfCred();
  const [, force] = useState(0);

  const load = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    const r = await getOutlook(forceRefresh);
    setLoading(false);
    setSymbols(r.symbols);
    setCached(r.cached);
    if (r.error) setError(r.error);
    force((x) => x + 1);
  };

  useEffect(() => { load(false); }, []);

  if (!hasCred) {
    return (
      <div className="glass-panel p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-amber-400" />
          <span className="font-bold text-sm text-slate-100">TÂM LÝ ĐÁM ĐÔNG (MYFXBOOK OUTLOOK)</span>
        </div>
        <div className="text-[11px] text-slate-400">
          Chưa kết nối tài khoản MyFxBook — vào tab HELP → mục TÂM LÝ THỊ TRƯỜNG để nhập.
          Tài khoản free xem được, dữ liệu làm mới mỗi 15 phút.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-amber-400" />
          <span className="font-bold text-sm text-slate-100">TÂM LÝ ĐÁM ĐÔNG (MYFXBOOK OUTLOOK)</span>
          {cached && <span className="text-[9px] font-mono text-slate-500">cache 15p</span>}
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} gap-2.5`}>
        {TRACKED.map((sym) => {
          const row = findSentiment(symbols, sym);
          if (!row) {
            return (
              <div key={sym} className="bg-[#0b0f19] p-3 rounded-xl border border-[#1e2b48]">
                <div className="font-mono font-bold text-xs text-slate-300">#{sym}</div>
                <div className="text-[10px] text-slate-500 mt-1">Chưa có dữ liệu</div>
              </div>
            );
          }
          return (
            <div key={sym} className="bg-[#0b0f19] p-3 rounded-xl border border-[#1e2b48] space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-xs text-slate-200">#{sym}</span>
                <span className="text-[10px] text-slate-500">{row.totalPositions.toLocaleString()} lệnh</span>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-[#17223b]">
                <div className="bg-emerald-500" style={{ width: `${row.longPct}%` }} title={`Long ${row.longPct}%`} />
                <div className="bg-rose-500" style={{ width: `${row.shortPct}%` }} title={`Short ${row.shortPct}%`} />
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-emerald-400 font-bold">LONG {row.longPct}%</span>
                <span className="text-rose-400 font-bold">SHORT {row.shortPct}%</span>
              </div>
              <div className="text-[10px] text-slate-400">{sentimentBias(row)}</div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-slate-500">
        Nguồn: MyFxBook Community Outlook — vị thế thật của cộng đồng. Đám đông nghiêng hẳn một chiều
        thường là tín hiệu contrarian (đảo chiều).
      </div>
    </div>
  );
};
