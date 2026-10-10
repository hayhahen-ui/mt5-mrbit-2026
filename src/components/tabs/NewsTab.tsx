import React from 'react';
import { NewsEvent } from '../../types';
import { Calendar, AlertCircle, Clock } from 'lucide-react';

interface NewsTabProps {
  newsEvents: NewsEvent[];
}

export const NewsTab: React.FC<NewsTabProps> = ({ newsEvents }) => {
  return (
    <div className="space-y-4">
      {/* News Window Alert */}
      <div className="glass-panel p-4 flex items-center justify-between border-l-4 border-l-sky-500">
        <div className="flex items-center gap-2.5">
          <Clock size={18} className="text-sky-400" />
          <div>
            <div className="text-xs font-bold text-slate-200">CỬA SỔ LỌC TIN KINH TẾ (NEWS WINDOW GUARD)</div>
            <div className="text-[11px] text-slate-400">
              Tự động chặn tín hiệu trước 30 phút và sau 15 phút khi có tin đỏ (High Impact).
            </div>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
          CỬA SỔ AN TOÀN
        </span>
      </div>

      {/* Events Table */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">LỊCH KINH TẾ 24H (MQL5 NATIVE & FOREX FACTORY)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Giờ địa phương GMT+7</span>
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
              {newsEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-[#17223b]/40">
                  <td className="py-3 text-slate-300 font-bold">{evt.time}</td>
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
    </div>
  );
};
