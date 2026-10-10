import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { aiChat } from '../lib/aiClient';
import { CHAT_PROVIDERS, getProviderMeta, AiProviderId } from '../lib/aiProviders';
import { getActiveProvider, hasAiKey, keyHint, setActiveProvider } from '../lib/aiKeys';

interface AiAskProps {
  /** Nhãn nút, VD: "AI PHÂN TÍCH TÍN HIỆU NÀY" */
  buttonLabel: string;
  /** Hàm dựng prompt từ dữ liệu mới nhất lúc bấm */
  buildPrompt: () => string;
  systemPrompt?: string;
  maxTokens?: number;
}

const DEFAULT_SYSTEM =
  'Bạn là trợ lý phân tích giao dịch. Trả lời bằng tiếng Việt, ngắn gọn, dạng gạch đầu dòng, ' +
  'đi thẳng vào nội dung. Không hứa hẹn lợi nhuận chắc chắn.';

function renderText(t: string) {
  return t.split('\n').map((ln, i) => {
    const s = ln.trim();
    if (!s) return <div key={i} className="h-2" />;
    if (/^#{1,3}\s/.test(s)) {
      return <div key={i} className="font-bold text-slate-100 text-xs mt-2">{s.replace(/^#{1,3}\s/, '')}</div>;
    }
    if (/^[-*•]\s/.test(s)) {
      return <div key={i} className="text-[11px] text-slate-300 pl-3 relative"><span className="absolute left-0 text-sky-400">•</span>{s.replace(/^[-*•]\s/, '')}</div>;
    }
    if (/^\d+[.)]\s/.test(s)) {
      return <div key={i} className="text-[11px] text-slate-300 pl-3">{s}</div>;
    }
    return <div key={i} className="text-[11px] text-slate-300">{s}</div>;
  });
}

/** Nút + panel gọi AI phân tích — dùng chung cho FLIGHT/NEWS. */
export const AiAsk: React.FC<AiAskProps> = ({ buttonLabel, buildPrompt, systemPrompt, maxTokens = 1024 }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [meta, setMeta] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Chỉ liệt kê provider ĐÃ CÓ key — chọn môi trường key ngay tại đây
  const keyed = CHAT_PROVIDERS.filter((p) => hasAiKey(p.id));
  const cur = getActiveProvider();
  const [selProv, setSelProv] = useState<AiProviderId | ''>(cur?.provider || '');
  const [selModel, setSelModel] = useState(cur?.model || '');
  const [, force] = useState(0);

  const pickProvider = (id: AiProviderId) => {
    const m = getProviderMeta(id)!;
    setSelProv(id);
    setSelModel(m.defaultModel);
    setActiveProvider(id, m.defaultModel);
    setError(null);
    force((x) => x + 1);
  };

  const pickModel = (model: string) => {
    if (!selProv) return;
    setSelModel(model);
    setActiveProvider(selProv, model);
    force((x) => x + 1);
  };

  const ask = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const active = getActiveProvider();
    try {
      const r = await aiChat(
        [
          { role: 'system', content: systemPrompt || DEFAULT_SYSTEM },
          { role: 'user', content: buildPrompt() },
        ],
        maxTokens,
      );
      setResult(r.content);
      setMeta(`${r.provider} · ${r.model}`);
    } catch (e) {
      // Ghi rõ provider+model nào lỗi để user biết mà đổi
      const where = active ? ` [${active.provider} · ${active.model}]` : '';
      setError(`${e instanceof Error ? e.message : 'Lỗi không xác định.'}${where}`);
    } finally {
      setLoading(false);
    }
  };

  const provMeta = selProv ? getProviderMeta(selProv) : undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {keyed.length > 0 ? (
          <>
            <select
              value={selProv}
              onChange={(e) => pickProvider(e.target.value as AiProviderId)}
              title="Chọn môi trường key API"
              className="bg-[#17223b] border border-[#243356] rounded-lg px-2 py-2 text-[11px] font-bold text-slate-200 focus:outline-none focus:border-purple-500/60"
            >
              {keyed.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({keyHint(p.id)})</option>
              ))}
            </select>
            {provMeta && (
              <select
                value={selModel}
                onChange={(e) => pickModel(e.target.value)}
                title="Chọn model"
                className="bg-[#17223b] border border-[#243356] rounded-lg px-2 py-2 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-purple-500/60 max-w-[220px]"
              >
                {provMeta.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </>
        ) : (
          <div className="text-[10px] text-amber-400/80">
            Chưa có key AI nào — vào tab HELP → CÀI ĐẶT AI để nhập API key.
          </div>
        )}
        <button
          onClick={ask}
          disabled={loading || keyed.length === 0}
          title={cur ? `Dùng ${cur.provider} · ${cur.model}` : 'Chưa cấu hình AI'}
          className="px-4 py-2 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[11px] font-bold hover:bg-purple-500/25 disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {loading ? 'AI đang phân tích…' : buttonLabel}
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </div>
      )}
      {result && (
        <div className="bg-[#0b0f19] rounded-xl border border-purple-900/50 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-purple-300 flex items-center gap-1">
              <Sparkles size={11} /> KẾT QUẢ PHÂN TÍCH AI
            </div>
            <div className="text-[9px] font-mono text-slate-500">{meta}</div>
          </div>
          <div>{renderText(result)}</div>
        </div>
      )}
    </div>
  );
};
