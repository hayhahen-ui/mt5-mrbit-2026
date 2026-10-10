import React, { useEffect, useState } from 'react';
import { HardDrive, AlertTriangle, CloudUpload, Trash2, Database, ChevronDown } from 'lucide-react';
import {
  localStorageUsage, ghRemoteSizeCache, getGhPat, ghSyncNow, ghRefreshRemoteSize,
} from '../lib/ghSync';
import { clearJournal, getForexJournal } from '../lib/forexJournal';
import { kaizenStoreStats } from '../lib/kaizen';
import { neuralStoreStats } from '../lib/neural/repository';
import { storageQuota } from '../lib/idb';

/**
 * Đồng hồ bộ nhớ 3 tầng:
 * - localStorage (~5MB): cache nóng + cấu hình — thanh % + báo đầy >85%.
 * - IndexedDB (hàng GB): nhật ký Kaizen/Neural đầy đủ — kho lạnh trên cùng máy.
 * - GitHub nhánh data: bản sao masterdata trên cloud.
 * Luật: chỉ user bấm tay mới xóa — hệ thống không bao giờ tự xóa.
 */
export const StorageMeter: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [usage, setUsage] = useState(() => localStorageUsage());
  const [syncing, setSyncing] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [idb, setIdb] = useState<{ k: string; hot: number; cold: number; bytes: number }[]>([]);
  const [quota, setQuota] = useState<{ quota: number; usage: number } | null>(null);
  const [, force] = useState(0);

  const refresh = () => {
    setUsage(localStorageUsage());
    Promise.all([kaizenStoreStats(), neuralStoreStats()])
      .then(([k, n]) => setIdb([
        { k: 'Kaizen', hot: k.hot, cold: k.cold, bytes: k.coldBytes },
        { k: 'Neural', hot: n.hot, cold: n.cold, bytes: n.coldBytes },
      ]))
      .catch(() => { /* IDB chưa sẵn sàng */ });
    storageQuota().then(setQuota).catch(() => { /* noop */ });
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);

  const keyBreakdown = (): { k: string; bytes: number }[] => {
    const out: { k: string; bytes: number }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const v = localStorage.getItem(k) || '';
        out.push({ k: k.replace('nexuspilot-', ''), bytes: (k.length + v.length) * 2 });
      }
    } catch { /* noop */ }
    return out.sort((a, b) => b.bytes - a.bytes).slice(0, 8);
  };

  const remote = ghRemoteSizeCache();
  const pct = usage.pct;
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor = pct > 85 ? 'text-red-300' : pct > 60 ? 'text-amber-200' : 'text-slate-400';
  const kb = (b: number) => (b / 1024).toFixed(1) + ' KB';
  const mb = (b: number) => (b / 1048576).toFixed(1) + ' MB';
  const fmtB = (b: number) => (b > 1048576 ? mb(b) : kb(b));

  const handleSyncThenClear = async () => {
    if (!getGhPat()) {
      alert('Chưa nhập GitHub PAT — vào HELP → ĐỒNG BỘ MASTERDATA để nhập trước.');
      return;
    }
    if (!confirm(`Đẩy ${getForexJournal().length} snapshot lên GitHub rồi XÓA kho local?`)) return;
    setSyncing(true);
    try {
      const r = await ghSyncNow();
      await ghRefreshRemoteSize().catch(() => null);
      if (!confirm(`Đã đẩy ${r.pushed} snapshot lên GitHub. Bấm OK để XÓA kho local giải phóng bộ nhớ.`)) return;
      clearJournal();
      refresh();
      onChanged?.();
      force((x) => x + 1);
    } catch (e) {
      alert('Đồng bộ thất bại: ' + (e instanceof Error ? e.message : 'lỗi mạng'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        <HardDrive size={12} className={textColor} />
        <span className={textColor}>Bộ nhớ trình duyệt</span>
        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden min-w-[80px]">
          <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <span className={`font-mono font-bold ${textColor}`}>{pct.toFixed(1)}%</span>
        <span className="font-mono text-slate-500">({kb(usage.bytes)}/~5MB</span>
        <button
          onClick={() => setShowKeys((v) => !v)}
          className="font-mono text-sky-400/80 hover:text-sky-300 flex items-center gap-0.5"
          title="Xem chi tiết từng kho"
        >
          chi tiết <ChevronDown size={10} className={showKeys ? 'rotate-180' : ''} />
        </button>
        <span className="font-mono text-slate-500">)</span>
      </div>

      {showKeys && (
        <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-2.5 space-y-1 text-[10px] font-mono">
          <div className="text-slate-400 font-bold mb-1">localStorage — cache nóng + cấu hình:</div>
          {keyBreakdown().map(({ k, bytes }) => (
            <div key={k} className="flex justify-between text-slate-500">
              <span className="truncate mr-2">{k}</span>
              <span className="shrink-0">{kb(bytes)}</span>
            </div>
          ))}
          <div className="text-slate-400 font-bold pt-1 flex items-center gap-1">
            <Database size={10} /> IndexedDB — kho lạnh (toàn bộ lịch sử):
          </div>
          {idb.map((r) => (
            <div key={r.k} className="flex justify-between text-slate-500">
              <span>{r.k}: {r.cold} bản lạnh + {r.hot} nóng</span>
              <span className="shrink-0">{fmtB(r.bytes)}</span>
            </div>
          ))}
          {quota && quota.quota > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Hạn mức trình duyệt cấp</span>
              <span className="shrink-0">{fmtB(quota.usage)} / {fmtB(quota.quota)}</span>
            </div>
          )}
          {remote && (
            <div className="flex justify-between text-slate-500">
              <span>GitHub nhánh data</span>
              <span className="shrink-0">{remote.files} file, {kb(remote.bytes)}</span>
            </div>
          )}
        </div>
      )}
      {!showKeys && idb.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
          <Database size={10} />
          IndexedDB: {idb.map((r) => `${r.k} ${r.cold + r.hot} bản (${fmtB(r.bytes)})`).join(' · ')}
          {remote && <span>· GitHub: {remote.files} file, {kb(remote.bytes)}</span>}
        </div>
      )}

      {pct > 85 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/50 text-[11px] text-red-200">
          <AlertTriangle size={13} className="shrink-0" />
          <span><strong>BỘ NHỚ SẮP ĐẦY ({pct.toFixed(0)}%)</strong> — hãy đẩy lên GitHub rồi xóa local ngay.</span>
          <button
            onClick={handleSyncThenClear}
            disabled={syncing}
            className="ml-auto px-2.5 py-1 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <CloudUpload size={11} /> {syncing ? 'Đang đẩy…' : 'Đồng bộ & xóa local'}
          </button>
        </div>
      )}
      {pct > 85 && (
        <button
          onClick={() => {
            if (confirm('XÓA TRỰC TIẾP kho snapshot local mà KHÔNG đẩy GitHub? Dữ liệu chưa đồng bộ sẽ MẤT.')) {
              clearJournal();
              refresh();
              onChanged?.();
            }
          }}
          className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400/80 text-[10px] flex items-center gap-1"
        >
          <Trash2 size={10} /> Xóa local trực tiếp (mất dữ liệu chưa đồng bộ)
        </button>
      )}
    </div>
  );
};
