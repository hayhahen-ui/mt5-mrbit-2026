import React, { useState } from 'react';
import { Landmark, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { getFredKey, setFredKey, fetchFredSeries, clearFredCache } from '../lib/research/fred';

/**
 * Cài đặt FRED — user tự đăng ký key miễn phí tại fred.stlouisfed.org
 * (lưu localStorage trên máy user). Cho dữ liệu vĩ mô Mỹ: lợi suất 2Y/10Y,
 * lợi suất thực 10Y, USD Broad Index, breakeven lạm phát → điểm định hướng §9.2.
 */
export const FredSettings: React.FC = () => {
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, force] = useState(0);
  const saved = getFredKey();
  const hint = saved ? `••••${saved.slice(-4)}` : 'chưa có';

  const handleSave = () => {
    const k = key.trim();
    if (k.length < 8) {
      setMsg({ ok: false, text: 'API key không hợp lệ (quá ngắn).' });
      return;
    }
    setFredKey(k);
    setKey('');
    clearFredCache();
    setMsg({ ok: true, text: `Đã lưu key ${hint}. Bấm "Kiểm tra kết nối" để thử.` });
    force((x) => x + 1);
  };

  const handleTest = async () => {
    const useKey = getFredKey() || key.trim();
    if (!useKey) {
      setMsg({ ok: false, text: 'Chưa có key — nhập key rồi bấm Lưu trước.' });
      return;
    }
    if (!getFredKey()) setFredKey(useKey);
    setTesting(true);
    setMsg(null);
    try {
      clearFredCache();
      const s = await fetchFredSeries('DGS10', 3);
      if (s.error) throw new Error(s.error);
      setMsg({ ok: true, text: `Kết nối OK — Lợi suất US 10Y = ${s.latest?.value?.toFixed(2)}% (${s.latest?.date}).` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Lỗi mạng.' });
    } finally {
      setTesting(false);
      setKey('');
      force((x) => x + 1);
    }
  };

  const handleRemove = () => {
    if (!window.confirm('Xóa API key FRED khỏi máy này?')) return;
    setFredKey('');
    clearFredCache();
    setMsg({ ok: true, text: 'Đã xóa key.' });
    force((x) => x + 1);
  };

  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Landmark size={18} className="text-violet-400" />
        <div>
          <div className="font-bold text-sm text-slate-100">FRED — DỮ LIỆU VĨ MÔ MỸ</div>
          <div className="text-[11px] text-slate-400">
            Key miễn phí tại <a href="https://fred.stlouisfed.org/docs/api/api_key.html" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">fred.stlouisfed.org</a> →
            lợi suất 2Y/10Y, lợi suất thực, USD index, breakeven lạm phát → điểm định hướng tab NGHIÊN CỨU.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={saved ? `Key hiện tại: ${hint} — dán key mới để thay` : 'Dán FRED API key…'}
          className="bg-[#0b0f19] border border-[#1e2b48] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 w-64 focus:outline-none focus:border-violet-500"
        />
        <button onClick={handleSave} className="px-3 py-2 rounded-lg text-[11px] font-bold bg-violet-600/30 border border-violet-500/50 text-violet-200 hover:bg-violet-600/50">Lưu key</button>
        <button onClick={handleTest} disabled={testing} className="px-3 py-2 rounded-lg text-[11px] font-bold bg-[#17223b] border border-[#243356] text-slate-300 hover:text-white disabled:opacity-50">
          {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </button>
        {saved && (
          <button onClick={handleRemove} className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/50" title="Xóa key">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {msg && (
        <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border ${msg.ok ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
          {msg.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {msg.text}
        </div>
      )}
      <div className="text-[10px] text-slate-500">
        Key chỉ lưu trên trình duyệt của bạn, không gửi đi đâu ngoài api.stlouisfed.org qua proxy. Dữ liệu FRED là theo ngày — app cache 6 giờ.
      </div>
    </div>
  );
};
