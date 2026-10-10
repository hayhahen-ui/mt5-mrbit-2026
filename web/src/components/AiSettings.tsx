import React, { useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, Trash2, ExternalLink, Cpu } from 'lucide-react';
import { CHAT_PROVIDERS, getProviderMeta, AiProviderId } from '../lib/aiProviders';
import { saveAiKey, getAiKey, removeAiKey, keyHint, setActiveProvider, getActiveProvider } from '../lib/aiKeys';
import { validateAiKey } from '../lib/aiClient';

/**
 * Cài đặt AI — user tự nhập API key của mình (lưu localStorage trên máy user).
 * Key không bao giờ gửi đi đâu ngoài provider do user chọn (qua /api/ai-proxy).
 */
export const AiSettings: React.FC = () => {
  const [providerId, setProviderId] = useState<AiProviderId>(() => getActiveProvider()?.provider || 'gemini');
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState(() => getActiveProvider()?.model || getProviderMeta('gemini')!.defaultModel);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [, force] = useState(0);

  const meta = getProviderMeta(providerId)!;
  const savedHint = keyHint(providerId);

  const pickProvider = (id: AiProviderId) => {
    setProviderId(id);
    setTestResult(null);
    const m = getProviderMeta(id)!;
    const active = getActiveProvider();
    setModel(active?.provider === id ? active.model : m.defaultModel);
    setKeyInput('');
  };

  const handleSave = () => {
    const k = keyInput.trim();
    if (k.length < 8) {
      setTestResult({ ok: false, msg: 'Key quá ngắn (tối thiểu 8 ký tự).' });
      return;
    }
    saveAiKey(providerId, k);
    setActiveProvider(providerId, model.trim() || meta.defaultModel);
    setKeyInput('');
    setTestResult({ ok: true, msg: `Đã lưu key ${meta.name} (${keyHint(providerId)}). Bấm "Kiểm tra kết nối" để thử.` });
    force((x) => x + 1);
  };

  const handleTest = async () => {
    const k = getAiKey(providerId);
    if (!k) {
      setTestResult({ ok: false, msg: 'Chưa có key — nhập key rồi bấm Lưu trước.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const r = await validateAiKey(providerId, k);
    setTesting(false);
    setTestResult(r.valid
      ? { ok: true, msg: `Kết nối OK — key ${meta.name} hợp lệ.` }
      : { ok: false, msg: `Key không hợp lệ: ${r.error || 'kiểm tra lại key.'}` });
  };

  const handleRemove = () => {
    if (!window.confirm(`Xóa API key ${meta.name} khỏi máy này?`)) return;
    removeAiKey(providerId);
    setTestResult({ ok: true, msg: `Đã xóa key ${meta.name}.` });
    force((x) => x + 1);
  };

  const active = getActiveProvider();

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-amber-400" />
        <span className="font-bold text-sm text-slate-100">CÀI ĐẶT AI — API KEY CỦA BẠN</span>
      </div>
      <div className="text-[11px] text-slate-400">
        Nhập API key của chính bạn — key chỉ lưu trên trình duyệt này, gọi model qua proxy nội bộ
        <span className="font-mono text-slate-300"> /api/ai-proxy </span>
        (không dính CORS). Bấm tên provider để mở trang tạo key chính thức.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {CHAT_PROVIDERS.map((p) => {
          const has = !!keyHint(p.id);
          const isActive = active?.provider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => pickProvider(p.id)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                providerId === p.id
                  ? 'bg-sky-500/15 border-sky-500/60'
                  : 'bg-[#0b0f19] border-[#1e2b48] hover:border-slate-600'
              }`}
            >
              <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                {p.name}
                {has && <span className="text-emerald-400 text-[9px]">●</span>}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 line-clamp-2">{p.keyNote || p.description}</div>
              {isActive && <div className="text-[9px] text-sky-400 font-bold mt-1">ĐANG DÙNG</div>}
            </button>
          );
        })}
      </div>

      <div className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Cpu size={14} className="text-sky-400" /> {meta.name}
            {savedHint && <span className="text-[10px] font-mono text-emerald-400">đã lưu {savedHint}</span>}
          </div>
          <a href={meta.keyUrl} target="_blank" rel="noreferrer"
             className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1">
            <ExternalLink size={11} /> Lấy API key
          </a>
        </div>
        <div className="text-[11px] text-slate-400">{meta.description}</div>

        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={savedHint ? 'Nhập key mới để thay thế…' : 'Dán API key vào đây…'}
            className="flex-1 min-w-[200px] bg-[#17223b] border border-[#243356] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[#17223b] border border-[#243356] rounded-lg px-2 py-2 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {meta.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-bold hover:bg-amber-500/30">
            Lưu key
          </button>
          <button onClick={handleTest} disabled={testing}
            className="px-4 py-2 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 disabled:opacity-50">
            {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </button>
          {savedHint && (
            <button onClick={handleRemove}
              className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[11px] font-bold hover:bg-rose-500/20 flex items-center gap-1">
              <Trash2 size={11} /> Xóa key
            </button>
          )}
        </div>

        {testResult && (
          <div className={`text-[11px] font-bold flex items-center gap-1.5 ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
            {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {testResult.msg}
          </div>
        )}
      </div>
    </div>
  );
};
