import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, ExternalLink, ArrowRight } from 'lucide-react';
import { getSourcesHealth, testSource, SourceHealth } from '../lib/marketData';
import { getNewsHealth, testNewsSource, NewsSourceHealth } from '../lib/news';

interface DataSourcesPanelProps {
  onGoRadar: () => void;
}

type Row = (SourceHealth | NewsSourceHealth) & { kind: 'price' | 'news' };

function timeAgo(ts: number): string {
  if (!ts) return 'chưa thử';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'vừa xong';
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p trước`;
  return `${Math.floor(m / 60)}h trước`;
}

/**
 * Panel kiểm chứng nguồn dữ liệu — người dùng tự test tính xác thực:
 * từng nguồn hiện endpoint, trạng thái, độ trễ, lần kiểm tra cuối + nút "Kiểm tra".
 */
export const DataSourcesPanel: React.FC<DataSourcesPanelProps> = ({ onGoRadar }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [testing, setTesting] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const priceRows: Row[] = getSourcesHealth().map((h) => ({ ...h, kind: 'price' as const }));
    const newsRow: Row = { ...getNewsHealth(), kind: 'news' as const };
    setRows([...priceRows, newsRow]);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const handleTest = async (row: Row) => {
    setTesting(row.id);
    try {
      if (row.kind === 'news') await testNewsSource();
      else await testSource(row.id);
    } finally {
      refresh();
      setTesting(null);
    }
  };

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-emerald-400" />
          <span className="font-bold text-sm text-slate-100">NGUỒN DỮ LIỆU — KIỂM CHỨNG TRỰC TIẾP</span>
        </div>
        <button
          onClick={onGoRadar}
          className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
        >
          Mở RADAR <ArrowRight size={12} />
        </button>
      </div>

      <div className="text-[11px] text-slate-400">
        Hệ thống lấy giá/tin từ các nguồn công khai bên dưới (không cần key). Bấm <b className="text-slate-200">Kiểm tra</b> để
        gọi thử endpoint ngay — nếu báo OK nghĩa là dữ liệu đang lấy thật từ nguồn đó.
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const ok = r.lastOk === true;
          const fail = r.lastOk === false;
          const dot = ok ? 'bg-emerald-400' : fail ? 'bg-rose-500' : 'bg-slate-500';
          const isTesting = testing === r.id;
          return (
            <div
              key={r.id}
              className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-3 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot} ${ok ? 'radar-pulse' : ''}`} />
              <div className="min-w-[140px]">
                <div className="text-xs font-bold font-mono text-slate-100">{r.name}</div>
                <div className="text-[10px] text-slate-500">{r.serves} · {r.interval}</div>
              </div>
              <div className="flex-1 min-w-[180px]">
                {r.endpoint.startsWith('http') ? (
                  <a
                    href={r.endpoint}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 break-all"
                  >
                    <ExternalLink size={10} className="shrink-0" />
                    {r.endpoint.replace('https://', '')}
                  </a>
                ) : (
                  <span className="text-[11px] font-mono text-slate-500">{r.endpoint}</span>
                )}
                {'note' in r && r.note && (
                  <div className="text-[10px] text-amber-400/80 mt-0.5">{(r as NewsSourceHealth).note}</div>
                )}
                {fail && r.error && (
                  <div className="text-[10px] text-rose-400 mt-0.5 font-mono">Lỗi: {r.error}</div>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-400 text-right">
                <div className={ok ? 'text-emerald-400 font-bold' : fail ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                  {ok ? `✓ OK${r.latencyMs != null ? ` · ${r.latencyMs}ms` : ''}` : fail ? '✗ LỖI' : '○ CHƯA THỬ'}
                </div>
                <div className="text-[10px] text-slate-500">{timeAgo(r.lastAt)}</div>
              </div>
              <button
                onClick={() => handleTest(r)}
                disabled={isTesting}
                className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold flex items-center gap-1.5 hover:bg-sky-500/25 disabled:opacity-50"
              >
                <RefreshCw size={11} className={isTesting ? 'animate-spin' : ''} />
                {isTesting ? 'Đang thử…' : 'Kiểm tra'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
