import React, { useEffect, useState } from 'react';
import { Database, Camera, ChevronDown } from 'lucide-react';
import {
  heatmap, HEATMAP_SYMBOLS, HEATMAP_TFS, HEATMAP_TF_LABELS, latestPrices,
} from '../lib/priceHistory';
import {
  getForexJournal, lastSnapAt, takeForexSnapshot, heatBias, ForexSnap,
} from '../lib/forexJournal';

function cellColor(v: number | null): string {
  if (v === null) return 'bg-[#17223b] text-slate-600';
  if (v === 0) return 'bg-[#17223b] text-slate-400';
  const a = Math.min(Math.abs(v) * 2, 0.85); // % càng lớn màu càng đậm
  return v > 0
    ? `text-emerald-300 font-bold`
    : `text-rose-300 font-bold`;
}

function cellBg(v: number | null): React.CSSProperties {
  if (v === null || v === 0) return {};
  const a = Math.min(Math.abs(v) * 1.5, 0.45);
  return { backgroundColor: v > 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})` };
}

function fmtTime(t: number): string {
  try {
    return new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch { return '—'; }
}

/**
 * NHẬT KÝ DỮ LIỆU FOREX — heatmap đa khung tự tính từ giá thật app thu thập
 * + snapshot 15 phút (giá/heatmap/sentiment/tin HIGH), append-only.
 */
export const ForexJournalPanel: React.FC = () => {
  const [hm, setHm] = useState(() => heatmap());
  const [journal, setJournal] = useState<ForexSnap[]>(() => getForexJournal());
  const [showHist, setShowHist] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHm(heatmap());
      setJournal(getForexJournal());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const handleSnap = () => {
    try {
      takeForexSnapshot(latestPrices(), 0);
      setJournal(getForexJournal());
      setHm(heatmap());
      force((x) => x + 1);
    } catch { /* noop */ }
  };

  const last = lastSnapAt();

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-emerald-400" />
          <span className="font-bold text-sm text-slate-100">NHẬT KÝ DỮ LIỆU FOREX</span>
          <span className="text-[10px] font-mono text-slate-500">
            {journal.length} snapshot{last ? ` · mới nhất ${fmtTime(last)}` : ' · chưa có'}
          </span>
        </div>
        <button
          onClick={handleSnap}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25 flex items-center gap-1"
        >
          <Camera size={11} /> Ghi snapshot ngay
        </button>
      </div>

      <div className="text-[11px] text-slate-400">
        Heatmap % thay đổi giá đa khung, tự tính từ giá thật app thu thập (thay cho MyFxBook heat-map).
        Snapshot 15 phút/lần: giá + heatmap + tâm lý MyFxBook + số tin HIGH — lưu append-only, không tự xóa.
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left py-1.5 pr-2 font-bold">Mã</th>
              {HEATMAP_TFS.map((tf) => (
                <th key={tf} className="py-1.5 px-2 font-bold text-center">{HEATMAP_TF_LABELS[tf]}</th>
              ))}
              <th className="py-1.5 px-2 font-bold text-center">Bias</th>
            </tr>
          </thead>
          <tbody>
            {HEATMAP_SYMBOLS.map((sym) => {
              const bias = HEATMAP_TFS.reduce((b, tf) => {
                const v = hm[sym]?.[tf];
                return b + (v === null || v === undefined ? 0 : v > 0 ? 1 : v < 0 ? -1 : 0);
              }, 0);
              return (
                <tr key={sym} className="border-t border-[#1e2b48]">
                  <td className="py-1.5 pr-2 font-bold text-slate-200">#{sym}</td>
                  {HEATMAP_TFS.map((tf) => {
                    const v = hm[sym]?.[tf] ?? null;
                    return (
                      <td key={tf} className={`py-1.5 px-2 text-center rounded ${cellColor(v)}`} style={cellBg(v)}>
                        {v === null ? '—' : `${v >= 0 ? '+' : ''}${v}%`}
                      </td>
                    );
                  })}
                  <td className={`py-1.5 px-2 text-center font-bold ${bias > 0 ? 'text-emerald-400' : bias < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                    {bias > 0 ? `▲${bias}` : bias < 0 ? `▼${-bias}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lịch sử snapshot */}
      {journal.length > 0 && (
        <div>
          <button
            onClick={() => setShowHist(!showHist)}
            className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold"
          >
            <ChevronDown size={12} className={showHist ? 'rotate-180' : ''} />
            Lịch sử {journal.length} snapshot
          </button>
          {showHist && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {[...journal].reverse().slice(0, 24).map((s) => (
                <div key={s.at} className="flex items-center gap-3 text-[10px] font-mono text-slate-400 bg-[#0b0f19] rounded-lg px-3 py-1.5 border border-[#1e2b48]">
                  <span className="text-slate-300">{fmtTime(s.at)}</span>
                  <span className="flex gap-2">
                    {HEATMAP_SYMBOLS.map((sym) => {
                      const b = heatBias(s, sym);
                      return (
                        <span key={sym} className={b > 0 ? 'text-emerald-400' : b < 0 ? 'text-rose-400' : 'text-slate-600'}>
                          {sym.replace('USD', '')}:{b > 0 ? `+${b}` : b}
                        </span>
                      );
                    })}
                  </span>
                  <span className="ml-auto">tin HIGH: {s.newsHigh}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
