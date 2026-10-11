import React, { useState } from 'react';
import { Users, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { saveMfCred, removeMfCred, mfEmailHint } from '../lib/sentiment';

/**
 * Cài đặt MyFxBook — user tự nhập tài khoản của mình (lưu localStorage trên máy user).
 * Dùng để lấy Community Outlook (tâm lý đám đông) qua proxy /api/myfxbook-outlook.
 * Tài khoản free dùng được (giới hạn làm mới 15 phút/lần).
 */
export const MfSettings: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, force] = useState(0);
  const hint = mfEmailHint();

  const handleSave = () => {
    if (!email.includes('@') || !password) {
      setMsg({ ok: false, text: 'Nhập đúng email và password MyFxBook.' });
      return;
    }
    saveMfCred(email, password);
    setPassword('');
    setMsg({ ok: true, text: `Đã lưu tài khoản ${mfEmailHint()}. Bấm "Kiểm tra kết nối" để thử.` });
    force((x) => x + 1);
  };

  const handleTest = async () => {
    // Ưu tiên tài khoản đã lưu; nếu đang nhập mới thì thử luôn cặp đang nhập
    const saved = (() => { try { return JSON.parse(localStorage.getItem('nexuspilot-mf-cred-v1') || 'null'); } catch { return null; } })();
    const useEmail = saved?.email || email.trim();
    const usePass = saved?.password || password;
    if (!useEmail || !usePass) {
      setMsg({ ok: false, text: 'Chưa có tài khoản — nhập email/password rồi bấm Lưu trước.' });
      return;
    }
    setTesting(true);
    setMsg(null);
    try {
      const r = await fetch('/api/myfxbook-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: useEmail, password: usePass }),
      });
      const { readApiJson } = await import('../lib/apiHealth');
      const d = await readApiJson(r, 'MyFxBook');
      setMsg(d.ok
        ? { ok: true, text: `Kết nối OK — lấy được outlook ${d.symbols?.length || 0} mã.` }
        : { ok: false, text: `Thất bại: ${d.error || 'kiểm tra lại tài khoản.'}` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Lỗi mạng.' });
    } finally {
      setTesting(false);
      setEmail('');
    }
  };

  const handleRemove = () => {
    if (!window.confirm('Xóa tài khoản MyFxBook khỏi máy này?')) return;
    removeMfCred();
    setMsg({ ok: true, text: 'Đã xóa.' });
    force((x) => x + 1);
  };

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-amber-400" />
        <span className="font-bold text-sm text-slate-100">TÂM LÝ THỊ TRƯỜNG — TÀI KHOẢN MYFXBOOK</span>
      </div>
      <div className="text-[11px] text-slate-400">
        Nhập tài khoản MyFxBook của anh để lấy <b className="text-slate-200">Community Outlook</b> (% LONG/SHORT
        thật của cộng đồng theo từng mã). Tài khoản <b className="text-slate-200">free dùng được</b>, dữ liệu
        làm mới mỗi 15 phút. Tài khoản chỉ lưu trên trình duyệt này, gọi qua proxy nội bộ
        <span className="font-mono text-slate-300"> /api/myfxbook-outlook </span>
        (không dính CORS, không lưu server).
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={hint ? `Đã lưu: ${hint} — nhập mới để thay…` : 'Email MyFxBook…'}
          className="flex-1 min-w-[200px] bg-[#17223b] border border-[#243356] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password…"
          className="flex-1 min-w-[160px] bg-[#17223b] border border-[#243356] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-bold hover:bg-amber-500/30">
          Lưu tài khoản
        </button>
        <button onClick={handleTest} disabled={testing}
          className="px-4 py-2 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 disabled:opacity-50">
          {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </button>
        {hint && (
          <button onClick={handleRemove}
            className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[11px] font-bold hover:bg-rose-500/20 flex items-center gap-1">
            <Trash2 size={11} /> Xóa
          </button>
        )}
      </div>
      {msg && (
        <div className={`text-[11px] font-bold flex items-center gap-1.5 ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
          {msg.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {msg.text}
        </div>
      )}
    </div>
  );
};
