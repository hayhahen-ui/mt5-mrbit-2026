/**
 * sessions.ts — Định nghĩa & tính trạng thái phiên giao dịch theo múi giờ chuẩn của sàn.
 * Dùng chung cho thanh đồng hồ (SessionClocks) và panel phiên trong LeftDock.
 */

export interface SessionDef {
  id: 'sydney' | 'tokyo' | 'london' | 'newyork';
  label: string;
  flag: string;
  tz: string;
  openHour: number;
  closeHour: number;
}

export const SESSIONS: SessionDef[] = [
  { id: 'sydney', label: 'Sydney', flag: '🇦🇺', tz: 'Australia/Sydney', openHour: 9, closeHour: 17 },
  { id: 'tokyo', label: 'Tokyo', flag: '🇯🇵', tz: 'Asia/Tokyo', openHour: 9, closeHour: 18 },
  { id: 'london', label: 'London', flag: '🇬🇧', tz: 'Europe/London', openHour: 8, closeHour: 17 },
  { id: 'newyork', label: 'New York', flag: '🇺🇸', tz: 'America/New_York', openHour: 8, closeHour: 17 },
];

export function partsInTz(tz: string, d: Date): { h: number; m: number; s: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', timeZone: tz,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { h: get('hour'), m: get('minute'), s: get('second') };
}

export function fmtClock(p: { h: number; m: number; s: number }): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(p.h)}:${z(p.m)}:${z(p.s)}`;
}

export interface SessionState extends SessionDef {
  time: string;
  isOpen: boolean;
  /** phút tới lần mở/đóng tiếp theo */
  minsToNext: number;
  nextLabel: 'mở sau' | 'đóng sau';
}

export function evalSessions(now: Date): SessionState[] {
  return SESSIONS.map((def) => {
    const p = partsInTz(def.tz, now);
    const minsNow = p.h * 60 + p.m + p.s / 60;
    const openM = def.openHour * 60;
    const closeM = def.closeHour * 60;
    const isOpen = minsNow >= openM && minsNow < closeM;
    let targetM: number;
    let nextLabel: 'mở sau' | 'đóng sau';
    if (isOpen) {
      targetM = closeM;
      nextLabel = 'đóng sau';
    } else if (minsNow < openM) {
      targetM = openM;
      nextLabel = 'mở sau';
    } else {
      targetM = openM + 24 * 60;
      nextLabel = 'mở sau';
    }
    return {
      ...def,
      time: fmtClock(p),
      isOpen,
      minsToNext: Math.max(0, targetM - minsNow),
      nextLabel,
    };
  });
}

export function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}p` : `${m}p`;
}
