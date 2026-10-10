import React, { useEffect, useState } from 'react';
import { HardDrive, AlertTriangle, CloudUpload, Trash2 } from 'lucide-react';
import {
  localStorageUsage, ghRemoteSizeCache, getGhPat, ghSyncNow, ghRefreshRemoteSize,
} from '../lib/ghSync';
import { clearJournal, getForexJournal } from '../lib/forexJournal';

/**
 * Đồng hồ bộ nhớ: % localStorage đã dùng + dung lượng kho GitHub.
 * >85% → banner ĐỎ báo đầy ngay để user giải phóng kịp thời.
 * Luật: chỉ user bấm tay mới xóa — hệ thống không bao giờ tự xóa.
 */
export const StorageMeter: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [usage, setUsage] = useState(() => localStorageUsage());
  const [syncing, setSyncing] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setUsage(localStorageUsage()), 30000);
    return () => clearInterval(id);
  }, []);

  const remote = ghRemoteSizeCache();
  const pct = usage.pct;
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor = pct > 85 ? 'text-red-300' : pct > 60 ? 'text-amber-200' : 'text-slate-400';
  const kb = (b: number) => (b / 1024).toFixed(1) + ' KB';

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
      setUsage(localStorageUsage());
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
      <div className="flex items-center gap-2 text-[11px]">
        <HardDrive size={12} className={textColor} />
        <span className={textColor}>Bộ nhớ trình duyệt</span>
        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden min-w-[80px]">
          <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <span className={`font-mono font-bold ${textColor}`}>{pct.toFixed(1)}%</span>
        <span className="font-mono text-slate-500">({kb(usage.bytes)}/~5MB</span>
        {remote && <span className="font-mono text-slate-500">· GitHub: {remote.files} file, {kb(remote.bytes)})</span>}
        {!remote && <span className="font-mono text-slate-500">· GitHub: chưa đồng bộ)</span>}
      </div>
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
              setUsage(localStorageUsage());
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
