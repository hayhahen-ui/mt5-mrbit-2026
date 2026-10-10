import React, { useEffect, useState } from 'react';
import { Database, Camera, ChevronDown } from 'lucide-react';
import {
  heatmap, HEATMAP_SYMBOLS, HEATMAP_TFS, HEATMAP_TF_LABELS, latestPrices, pointCounts,
  priceHistorySize,
} from '../lib/priceHistory';
import { Download, Trash2, AlertTriangle, HardDrive } from 'lucide-react';
import {
  getForexJournal, lastSnapAt, takeForexSnapshot, heatBias, ForexSnap,
  isJournalFull, clearJournal, journalSize, MAX_SNAPS,
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
  const [counts, setCounts] = useState<Record<string, number>>(() => pointCounts());
  const [journal, setJournal] = useState<ForexSnap[]>(() => getForexJournal());
  const [showHist, setShowHist] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHm(heatmap());
      setCounts(pointCounts());
      setJournal(getForexJournal());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const handleSnap = () => {
    try {
      const r = takeForexSnapshot(latestPrices(), 0);
      if (!r) { alert('Kho snapshot đã đầy — hãy xuất dữ liệu ra file trước khi xóa.'); return; }
      setJournal(getForexJournal());
      setHm(heatmap());
      setFull(isJournalFull());
      force((x) => x + 1);
    } catch { /* noop */ }
  };

  const [full, setFull] = useState(() => isJournalFull());

  const dl = (name: string, text: string, type: string) => {
    const b = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const exportJSON = () => {
    const rawHist = (() => { try { return localStorage.getItem('nexuspilot-pricehist-v1'); } catch { return null; } })();
    dl(`forex-masterdata-${stamp()}.json`, JSON.stringify({
      exportedAt: new Date().toISOString(),
      journal: getForexJournal(),
      priceHistory: rawHist ? JSON.parse(rawHist) : {},
    }, null, 1), 'application/json');
  };
  const exportCSV = () => {
    const rows = ['at,time,symbol,price,h5m,h15m,h1h,h4h,h24h,longPct,shortPct,newsHigh,newsTop'];
    for (const s of getForexJournal()) {
      const t = new Date(s.at).toISOString();
      for (const sym of HEATMAP_SYMBOLS) {
        const se = s.sentiment?.[sym];
        rows.push([s.at, t, sym, s.prices?.[sym] ?? '',
          s.heat?.[sym]?.[5] ?? '', s.heat?.[sym]?.[15] ?? '', s.heat?.[sym]?.[60] ?? '',
          s.heat?.[sym]?.[240] ?? '', s.heat?.[sym]?.[1440] ?? '',
          se?.l ?? '', se?.s ?? '', s.newsHigh ?? '',
          `"${(s.newsTop || []).join(' | ').replace(/"/g, "'")}"`].join(','));
      }
    }
    dl(`forex-masterdata-${stamp()}.csv`, rows.join('\n'), 'text/csv');
  };
  const handleClear = () => {
    if (!confirm('Xuất file backup trước khi xóa? (OK = đã xuất xong, xóa kho)')) return;
    clearJournal();
    setJournal([]);
    setFull(false);
  };
  const kb = (b: number) => (b / 1024).toFixed(1) + ' KB';

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
        <div className="flex gap-1.5">
          <button
            onClick={handleSnap}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25 flex items-center gap-1"
          >
            <Camera size={11} /> Ghi snapshot ngay
          </button>
          <button
            onClick={exportJSON}
            title="Tải toàn bộ masterdata (journal + lịch sử giá) dạng JSON"
            className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 flex items-center gap-1"
          >
            <Download size={11} /> JSON
          </button>
          <button
            onClick={exportCSV}
            title="Tải journal dạng CSV (mở bằng Excel)"
            className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 flex items-center gap-1"
          >
            <Download size={11} /> CSV
          </button>
        </div>
      </div>
      {full && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200">
          <AlertTriangle size={13} className="shrink-0" />
          <span>Kho snapshot đã đầy ({MAX_SNAPS} bản) — đã <strong>DỪNG GHI</strong>, giữ nguyên 100% dữ liệu. Hãy xuất file backup rồi bấm xóa.</span>
          <button onClick={handleClear} className="ml-auto px-2.5 py-1 rounded bg-red-500/15 border border-red-500/40 text-red-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
            <Trash2 size={11} /> Xóa kho (tay)
          </button>
        </div>
      )}

      <div className="text-[11px] text-slate-400">
        Heatmap % thay đổi giá đa khung, tự tính từ giá thật app thu thập (thay cho MyFxBook heat-map).
        Snapshot 15 phút/lần: giá + heatmap + tâm lý MyFxBook + tin HIGH — lưu append-only, không tự xóa.
        <span className="font-mono text-slate-500 flex items-center gap-1 mt-0.5">
          <HardDrive size={10} /> Kho: localStorage trên máy này · journal {journal.length}/{MAX_SNAPS} ({kb(journalSize())}) · giá {kb(priceHistorySize())}
        </span>
        <span className="font-mono text-slate-500">
          {' '}· điểm giá đã ghi: {HEATMAP_SYMBOLS.map((x) => `${x}:${counts[x] ?? 0}`).join(' ')}
        </span>
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
