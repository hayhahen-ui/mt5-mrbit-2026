import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * Thanh đồng hồ giao dịch realtime:
 * - Giờ máy (local) + giờ UTC tick mỗi giây
 * - Giờ các phiên Á/Âu/Mỹ theo múi giờ chuẩn của sàn (Intl API)
 * - Trạng thái mở/đóng cửa + đếm ngược tới lần mở/đóng tiếp theo
 */

interface SessionDef {
  id: string;
  label: string;
  flag: string;
  tz: string;
  openHour: number;
  closeHour: number;
}

const SESSIONS: SessionDef[] = [
  { id: 'sydney', label: 'Sydney', flag: '🇦🇺', tz: 'Australia/Sydney', openHour: 9, closeHour: 17 },
  { id: 'tokyo', label: 'Tokyo · Á', flag: '🇯🇵', tz: 'Asia/Tokyo', openHour: 9, closeHour: 18 },
  { id: 'london', label: 'London · Âu', flag: '🇬🇧', tz: 'Europe/London', openHour: 8, closeHour: 17 },
  { id: 'newyork', label: 'New York · Mỹ', flag: '🇺🇸', tz: 'America/New_York', openHour: 8, closeHour: 17 },
];

function partsInTz(tz: string, d: Date): { h: number; m: number; s: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', timeZone: tz,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { h: get('hour'), m: get('minute'), s: get('second') };
}

function fmtTime(p: { h: number; m: number; s: number }): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(p.h)}:${z(p.m)}:${z(p.s)}`;
}

function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}p` : `${m}p`;
}

interface SessionState extends SessionDef {
  time: string;
  isOpen: boolean;
  countdown: string;
  countdownLabel: string;
}

function evalSession(def: SessionDef, now: Date): SessionState {
  const p = partsInTz(def.tz, now);
  const minsNow = p.h * 60 + p.m + p.s / 60;
  const openM = def.openHour * 60;
  const closeM = def.closeHour * 60;
  const isOpen = minsNow >= openM && minsNow < closeM;
  let targetM: number;
  let label: string;
  if (isOpen) {
    targetM = closeM;
    label = 'đóng sau';
  } else if (minsNow < openM) {
    targetM = openM;
    label = 'mở sau';
  } else {
    targetM = openM + 24 * 60; // qua ngày mai
    label = 'mở sau';
  }
  return {
    ...def,
    time: fmtTime(p),
    isOpen,
    countdown: fmtDur(targetM - minsNow),
    countdownLabel: label,
  };
}

export const SessionClocks: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const local = fmtTime(partsInTz(Intl.DateTimeFormat().resolvedOptions().timeZone, now));
  const utc = fmtTime(partsInTz('UTC', now));
  const sessions = SESSIONS.map((s) => evalSession(s, now));
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
          <div key={s.id} className="flex items-center gap-1.5 font-mono" title={`${s.label}: ${s.countdownLabel} ${s.countdown}`}>
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
