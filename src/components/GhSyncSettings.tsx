import React, { useState } from 'react';
import { Github, CheckCircle2, XCircle, Trash2, RefreshCw } from 'lucide-react';
import {
  getGhPat, setGhPat, ghPatHint, ghAutoSync, setGhAutoSync,
  ghSyncNow, ghSyncStatus, ghRefreshRemoteSize, ghRemoteSizeCache,
} from '../lib/ghSync';

/**
 * Đồng bộ masterdata lên GitHub (nhánh `data`) — dữ liệu luôn sẵn có trong hệ thống.
 * Cần PAT fine-grained của user: repo hayhahen-ui/mt5-mrbit-2026, quyền Contents: Read+Write.
 * Tạo tại github.com → Settings → Developer settings → Personal access tokens → Fine-grained.
 */
export const GhSyncSettings: React.FC = () => {
  const [pat, setPat] = useState('');
  const [auto, setAuto] = useState(() => ghAutoSync());
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, force] = useState(0);
  const hint = ghPatHint();
  const st = ghSyncStatus();
  const remote = ghRemoteSizeCache();

  const handleSave = () => {
    const p = pat.trim();
    if (p.length < 20) {
      setMsg({ ok: false, text: 'PAT không hợp lệ (quá ngắn).' });
      return;
    }
    setGhPat(p);
    setPat('');
    setMsg({ ok: true, text: `Đã lưu PAT ${ghPatHint()}. Bấm "Đồng bộ ngay" để thử.` });
    force((x) => x + 1);
  };

  const handleSync = async () => {
    if (!getGhPat()) {
      setMsg({ ok: false, text: 'Chưa có PAT — nhập PAT rồi bấm Lưu trước.' });
      return;
    }
    setSyncing(true);
    setMsg(null);
    try {
      const r = await ghSyncNow();
      const rs = await ghRefreshRemoteSize().catch(() => null);
      setMsg({
        ok: true,
        text: r.pushed === 0
          ? 'Không có snapshot mới — kho GitHub đã đồng bộ.'
          : `Đã đẩy ${r.pushed} snapshot → ${r.path}${rs ? ` (kho GitHub: ${(rs.bytes / 1024).toFixed(1)} KB)` : ''}`,
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Lỗi mạng.' });
    } finally {
      setSyncing(false);
      setPat('');
      force((x) => x + 1);
    }
  };

  const handleRemove = () => {
    if (!window.confirm('Xóa GitHub PAT khỏi máy này?')) return;
    setGhPat('');
    setMsg({ ok: true, text: 'Đã xóa PAT.' });
    force((x) => x + 1);
  };

  const toggleAuto = () => {
    const v = !auto;
    setAuto(v);
    setGhAutoSync(v);
  };

  const fmtKB = (b: number) => (b / 1024).toFixed(1) + ' KB';

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Github size={15} className="text-slate-200" />
        <span className="font-bold text-sm text-slate-100">ĐỒNG BỘ MASTERDATA — GITHUB</span>
        {hint && <span className="text-[10px] font-mono text-emerald-300">PAT {hint}</span>}
      </div>
      <p className="text-[11px] text-slate-400">
        Đẩy snapshot journal lên nhánh <span className="font-mono text-sky-300">data</span> của repo
        (file <span className="font-mono">forex/YYYY-MM-DD.jsonl</span>) — dữ liệu luôn sẵn có trong hệ thống,
        không sợ mất khi xóa cache. Cần PAT fine-grained (Contents: Read + Write) tạo tại{' '}
        <span className="font-mono text-sky-300">github.com → Settings → Developer settings → Tokens</span>.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder={hint ? 'Nhập PAT mới để thay thế' : 'Dán GitHub PAT (fine-grained)'}
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-600"
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25"
        >
          Lưu PAT
        </button>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Đang đẩy…' : 'Đồng bộ ngay'}
        </button>
        {hint && (
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-bold hover:bg-red-500/25 flex items-center gap-1"
          >
            <Trash2 size={11} /> Xóa PAT
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
        <input type="checkbox" checked={auto} onChange={toggleAuto} className="accent-emerald-500" />
        Tự động đẩy mỗi 15 phút (khi app đang mở)
      </label>
      {msg && (
        <div className={`flex items-center gap-1.5 text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {msg.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {msg.text}
        </div>
      )}
      <div className="text-[10px] font-mono text-slate-500">
        đã đẩy: {st.pushed} snapshot
        {st.lastOk ? ` · lần cuối ${new Date(st.lastOk).toLocaleString('vi-VN')}` : ' · chưa đồng bộ lần nào'}
        {remote ? ` · kho GitHub: ${remote.files} file, ${fmtKB(remote.bytes)}` : ''}
      </div>
    </div>
  );
};
