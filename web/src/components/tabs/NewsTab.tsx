import React from 'react';
import { REFERENCE_SOURCES, VN_REGULATORY_NOTE, referenceSourcesPrompt } from '../../data/referenceSources';
import { NewsEvent } from '../../types';
import { Calendar, AlertCircle, Clock, Radio } from 'lucide-react';
import { AiAsk } from '../AiAsk';

interface NewsTabProps {
  newsEvents: NewsEvent[];
  newsSource?: string;
}

export const NewsTab: React.FC<NewsTabProps> = ({ newsEvents, newsSource }) => {
  const inWindowCount = newsEvents.filter((e) => e.inWindow && e.impact === 'HIGH').length;
  return (
    <div className="space-y-4">
      {/* News Window Alert */}
      <div className={`glass-panel p-4 flex items-center justify-between border-l-4 ${inWindowCount > 0 ? 'border-l-rose-500' : 'border-l-sky-500'}`}>
        <div className="flex items-center gap-2.5">
          <Clock size={18} className="text-sky-400" />
          <div>
            <div className="text-xs font-bold text-slate-200">CỬA SỔ LỌC TIN KINH TẾ (NEWS WINDOW GUARD)</div>
            <div className="text-[11px] text-slate-400">
              Tự động chặn tín hiệu trước 30 phút và sau 15 phút khi có tin đỏ (High Impact) — tính bằng giờ thật.
            </div>
          </div>
        </div>
        <span className={`text-xs font-mono px-2.5 py-1 rounded font-bold border ${
          inWindowCount > 0
            ? 'bg-rose-950 text-rose-400 border-rose-800'
            : 'bg-emerald-950 text-emerald-400 border-emerald-800'
        }`}>
          {inWindowCount > 0 ? `⛔ ${inWindowCount} TIN HIGH TRONG CỬA SỔ` : 'CỬA SỔ AN TOÀN'}
        </span>
      </div>

      {/* Events Table */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">LỊCH KINH TẾ (ECONOMIC CALENDAR)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#17223b] text-sky-400 border border-[#243356] flex items-center gap-1">
              <Radio size={11} />
              Nguồn: {newsSource || '…'}
            </span>
            <span className="text-xs text-slate-400 font-mono">Giờ địa phương</span>
            <AiAsk
              buttonLabel="✨ AI TÓM TẮT TIN"
              buildPrompt={() => {
                const highs = newsEvents.filter((e) => e.impact === 'HIGH');
                const lines = highs.slice(0, 25).map(
                  (e) => `- [${e.time}] ${e.currency} — ${e.title} (dự báo: ${e.forecast || '—'}, kỳ trước: ${e.previous || '—'})${e.inWindow ? ' ← TRONG CỬA SỔ' : ''}`
                );
                return [
                  `Tóm tắt lịch kinh tế tuần (nguồn: ${newsSource || 'ForexFactory'}), tập trung tin HIGH:`,
                  ...lines,
                  '',
                  'Hãy: 1) Liệt kê 3-5 tin quan trọng nhất cần tránh giao dịch (kèm giờ),',
                  '2) Nhận định nhanh tác động lên USD/EUR/JPY/XAUUSD,',
                  '3) Gợi ý khung giờ nào trong tuần cần đứng ngoài. Ngắn gọn, tiếng Việt.',
                  '',
                  referenceSourcesPrompt(),
                ].join('\n');
              }}
              systemPrompt="Bạn là trợ lý phân tích lịch kinh tế cho trader. Trả lời bằng tiếng Việt, ngắn gọn, dạng gạch đầu dòng."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                <th className="py-2.5">Thời gian</th>
                <th>Đồng tiền</th>
                <th>Mức độ</th>
                <th>Sự kiện kinh tế</th>
                <th>Dự báo</th>
                <th>Kỳ trước</th>
                <th>Thực tế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2b48] font-mono">
              {newsEvents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 text-xs">
                    Đang tải lịch kinh tế…
                  </td>
                </tr>
              )}
              {newsEvents.map((evt) => (
                <tr key={evt.id} className={`hover:bg-[#17223b]/40 ${evt.inWindow && evt.impact === 'HIGH' ? 'bg-rose-950/20' : ''}`}>
                  <td className="py-3 text-slate-300 font-bold">
                    {evt.time}
                    {evt.inWindow && evt.impact === 'HIGH' && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold">TRONG CỬA SỔ</span>
                    )}
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded bg-[#17223b] text-slate-200 font-bold border border-[#243356]">
                      {evt.currency}
                    </span>
                  </td>
                  <td>
                    {evt.impact === 'HIGH' ? (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-bold text-[10px] border border-rose-800">
                        🔴 HIGH
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 font-bold text-[10px] border border-amber-800">
                        🟠 MED
                      </span>
                    )}
                  </td>
                  <td className="font-sans text-slate-200 font-medium">{evt.title}</td>
                  <td className="text-slate-400">{evt.forecast}</td>
                  <td className="text-slate-400">{evt.previous}</td>
                  <td className="font-bold text-emerald-400">{evt.actual || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-5 mt-4">
        <div className="font-bold text-sm text-slate-100 mb-1">📚 NGUỒN THAM CHIẾU TIN CẬY</div>
        <div className="text-[11px] text-slate-400 mb-3">Do user sưu tầm 11/10/2026 — đã nạp vào prompt của AI phân tích. Bấm để mở nguồn gốc.</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REFERENCE_SOURCES.map((cat) => (
            <div key={cat.id} className="rounded-lg border border-[#1e2b48] bg-[#0d1526] p-3">
              <div className="text-xs font-bold text-slate-200 mb-2">{cat.title}</div>
              <div className="space-y-2">
                {cat.sources.map((src) => (
                  <div key={src.name} className="text-[11px]">
                    <a href={src.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline font-medium">{src.name}</a>
                    <div className="text-slate-400 mt-0.5">{src.provides}</div>
                    <div className="text-slate-500 italic">{src.usage}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-amber-300/90 border border-amber-800/50 bg-amber-950/30 rounded-lg p-2.5">
          ⚖️ {VN_REGULATORY_NOTE}
        </div>
      </div>
    </div>
  );
};
