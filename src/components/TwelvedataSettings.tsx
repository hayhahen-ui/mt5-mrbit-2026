import React, { useState } from 'react';
import { CandlestickChart, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import {
  getTdKey, setTdKey, tdKeyHint, tdPrice, tdUsageToday, TD_LIST,
} from '../lib/twelvedata';

/**
 * Cài đặt TwelveData — user tự đăng ký key miễn phí tại twelvedata.com
 * (lưu localStorage trên máy user). Cho nến forex 5m thật → engine/heatmap
 * có dữ liệu intraday thật thay vì giá daily đứng yên.
 * Free tier: 8 credit/phút, 800/ngày — app dùng ~650/ngày (chu kỳ 20 phút).
 */
export const TwelvedataSettings: React.FC = () => {
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, force] = useState(0);
  const hint = tdKeyHint();

  const handleSave = () => {
    const k = key.trim();
    if (k.length < 8) {
      setMsg({ ok: false, text: 'API key không hợp lệ (quá ngắn).' });
      return;
    }
    setTdKey(k);
    setKey('');
    setMsg({ ok: true, text: `Đã lưu key ${tdKeyHint()}. Bấm "Kiểm tra kết nối" để thử.` });
    force((x) => x + 1);
  };

  const handleTest = async () => {
    const useKey = getTdKey() || key.trim();
    if (!useKey) {
      setMsg({ ok: false, text: 'Chưa có key — nhập key rồi bấm Lưu trước.' });
      return;
    }
    if (!getTdKey()) setTdKey(useKey);
    setTesting(true);
    setMsg(null);
    try {
      const p = await tdPrice('EURUSD');
      setMsg({ ok: true, text: `Kết nối OK — EUR/USD = ${p}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Lỗi mạng.' });
    } finally {
      setTesting(false);
      setKey('');
      force((x) => x + 1);
    }
  };

  const handleRemove = () => {
    if (!window.confirm('Xóa API key TwelveData khỏi máy này?')) return;
    setTdKey('');
    setMsg({ ok: true, text: 'Đã xóa key.' });
    force((x) => x + 1);
  };

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CandlestickChart size={15} className="text-amber-400" />
        <span className="font-bold text-sm text-slate-100">DỮ LIỆU FOREX NÂNG CAO — TWELVEDATA</span>
        {hint && <span className="text-[10px] font-mono text-emerald-300">đã lưu {hint}</span>}
      </div>
      <p className="text-[11px] text-slate-400">
        Key miễn phí tại <span className="text-sky-300 font-mono">twelvedata.com</span> (đăng ký 2 phút).
        Cho nến 5 phút thật của 9 cặp forex + Vàng + Bạc → radar/heatmap/mẫu hình nến
        có dữ liệu intraday thật, thay vì giá ER-API đứng yên cả ngày.
        Free tier 800 credit/ngày — app dùng ~530.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={hint ? 'Nhập key mới để thay thế' : 'Dán API key TwelveData'}
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-600"
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25"
        >
          Lưu key
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 disabled:opacity-50"
        >
          {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </button>
        {hint && (
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-bold hover:bg-red-500/25 flex items-center gap-1"
          >
            <Trash2 size={11} /> Xóa key
          </button>
        )}
      </div>
      {msg && (
        <div className={`flex items-center gap-1.5 text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {msg.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {msg.text}
        </div>
      )}
      <div className="text-[10px] font-mono text-slate-500">
        credit đã dùng hôm nay: {tdUsageToday()}/800 · {TD_LIST.length} mã · chu kỳ 30 phút
      </div>
    </div>
  );
};
