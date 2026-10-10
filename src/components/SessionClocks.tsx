import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { evalSessions, partsInTz, fmtClock, fmtDur } from '../lib/sessions';

/**
 * Thanh đồng hồ giao dịch realtime:
 * - Giờ máy (local) + giờ UTC tick mỗi giây
 * - Giờ các phiên Á/Âu/Mỹ theo múi giờ chuẩn của sàn (Intl API)
 * - Trạng thái mở/đóng cửa + đếm ngược tới lần mở/đóng tiếp theo
 */
export const SessionClocks: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const local = fmtClock(partsInTz(Intl.DateTimeFormat().resolvedOptions().timeZone, now));
  const utc = fmtClock(partsInTz('UTC', now));
  const sessions = evalSessions(now);
  const anyOpen = sessions.some((s) => s.isOpen);

  return (
    <div className="bg-[#0d1322] border-b border-[#1e2b48] px-4 py-1.5 flex items-center gap-4 overflow-x-auto text-xs">
      <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
        <Clock size={13} className="text-sky-400" />
        <span className="font-bold text-slate-300">GIỜ GIAO DỊCH</span>
      </div>

      {/* Giờ máy + UTC */}
      <div className="flex items-center gap-3 shrink-0 font-mono">
        <span className="text-slate-400">🖥 Máy: <strong className="text-slate-100">{local}</strong></span>
        <span className="text-slate-400">🌐 UTC: <strong className="text-slate-100">{utc}</strong></span>
      </div>

      <div className="w-px h-5 bg-[#1e2b48] shrink-0" />

      {/* Các phiên */}
      <div className="flex items-center gap-3 shrink-0">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 font-mono" title={`${s.label}: ${s.nextLabel} ${fmtDur(s.minsToNext)}`}>
            <span className={`w-2 h-2 rounded-full ${s.isOpen ? 'bg-emerald-400 radar-pulse' : 'bg-slate-600'}`} />
            <span className="text-slate-400">{s.flag} {s.label}:</span>
            <strong className={s.isOpen ? 'text-emerald-300' : 'text-slate-300'}>{s.time}</strong>
            <span className={`text-[10px] ${s.isOpen ? 'text-emerald-400' : 'text-slate-500'}`}>
              {s.isOpen ? 'MỞ' : 'ĐÓNG'}
            </span>
          </div>
        ))}
      </div>

      <div className="ml-auto shrink-0">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
          anyOpen ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-[#17223b] text-slate-400 border-[#243356]'
        }`}>
          {anyOpen ? 'THỊ TRƯỜNG ĐANG MỞ' : 'NGOÀI GIỜ GIAO DỊCH'}
        </span>
      </div>
    </div>
  );
};
