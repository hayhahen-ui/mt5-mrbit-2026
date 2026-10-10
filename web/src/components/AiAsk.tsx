import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { aiChat } from '../lib/aiClient';
import { getActiveProvider } from '../lib/aiKeys';

interface AiAskProps {
  /** Nhãn nút, VD: "AI PHÂN TÍCH TÍN HIỆU" */
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
  const active = getActiveProvider();

  const ask = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
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
      setError(e instanceof Error ? e.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={ask}
        disabled={loading}
        title={active ? `Dùng ${active.provider} · ${active.model}` : 'Chưa cấu hình AI'}
        className="px-4 py-2 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[11px] font-bold hover:bg-purple-500/25 disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? 'AI đang phân tích…' : buttonLabel}
      </button>
      {!active && (
        <div className="text-[10px] text-amber-400/80">
          Chưa cấu hình AI — vào tab HELP → CÀI ĐẶT AI để nhập API key.
        </div>
      )}
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
