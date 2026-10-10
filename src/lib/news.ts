import { NewsEvent } from '../types';
import { INITIAL_NEWS } from '../data/mockData';

/**
 * Lịch kinh tế THẬT: thử lấy từ ForexFactory (faireconomy.media, JSON tuần này),
 * parse đúng format thật. Nếu bị chặn (CORS/offline) → dùng bộ dự phòng,
 * nhưng cửa sổ tin (inWindow) luôn tính bằng GIỜ THẬT của máy user.
 */

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const WINDOW_MIN = 30; // ±30 phút quanh giờ tin = cửa sổ chặn tín hiệu

const COUNTRY_CCY: Record<string, string> = {
  USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY',
  AUD: 'AUD', CAD: 'CAD', CHF: 'CHF', NZD: 'NZD',
};

let cachedReal: NewsEvent[] | null = null;
let newsSourceName = 'Dự phòng';

export function getNewsSourceName(): string {
  return newsSourceName;
}

/** Sức khỏe nguồn lịch tin — phục vụ panel kiểm chứng */
export interface NewsSourceHealth {
  id: string;
  name: string;
  endpoint: string;
  serves: string;
  interval: string;
  lastOk: boolean | null;
  lastAt: number;
  latencyMs: number | null;
  error: string | null;
  note: string;
}

const newsHealth: NewsSourceHealth = {
  id: 'forexfactory',
  name: 'ForexFactory',
  endpoint: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  serves: 'Lịch kinh tế tuần (tin HIGH/MED/LOW)',
  interval: '15 phút',
  lastOk: null,
  lastAt: 0,
  latencyMs: null,
  error: null,
  note: 'Trình duyệt có thể chặn CORS → tự dùng bộ dự phòng, cửa sổ tin vẫn tính bằng giờ thật',
};

export function getNewsHealth(): NewsSourceHealth {
  return { ...newsHealth };
}

function parseFF(raw: any[]): NewsEvent[] {
  const out: NewsEvent[] = [];
  raw.forEach((e, i) => {
    const ccy = COUNTRY_CCY[String(e.country || '').toUpperCase()];
    if (!ccy) return;
    const impactRaw = String(e.impact || '').toLowerCase();
    if (impactRaw === 'holiday') return;
    const impact: NewsEvent['impact'] =
      impactRaw === 'high' ? 'HIGH' : impactRaw === 'medium' ? 'MED' : 'LOW';
    const dt = new Date(e.date);
    if (isNaN(dt.getTime())) return;
    const mins = Math.abs(Date.now() - dt.getTime()) / 60000;
    out.push({
      id: `ff-${i}`,
      time: dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      currency: ccy,
      impact,
      title: String(e.title || '—'),
      forecast: String(e.forecast || '-'),
      previous: String(e.previous || '-'),
      inWindow: mins <= WINDOW_MIN,
    });
  });
  // Sắp xếp theo độ ưu tiên: HIGH trước, rồi theo inWindow
  return out.sort((a, b) => {
    const rank = { HIGH: 0, MED: 1, LOW: 2 };
    if (a.inWindow !== b.inWindow) return a.inWindow ? -1 : 1;
    return rank[a.impact] - rank[b.impact];
  });
}

/** Tính lại inWindow cho bộ dự phòng bằng giờ thật */
function refreshFallbackWindow(): NewsEvent[] {
  const now = new Date();
  return INITIAL_NEWS.map((n) => {
    const [h, m] = n.time.split(':').map(Number);
    const dt = new Date(now);
    dt.setHours(h, m, 0, 0);
    const mins = Math.abs(Date.now() - dt.getTime()) / 60000;
    return { ...n, inWindow: mins <= WINDOW_MIN };
  });
}

export async function fetchEconomicCalendar(): Promise<NewsEvent[]> {
  // Dùng cache nếu đã lấy thật thành công (lịch tuần ít thay đổi)
  if (cachedReal) return cachedReal.map((n) => ({ ...n }));
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(FF_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty');
    cachedReal = parseFF(raw);
    newsSourceName = 'ForexFactory (live)';
    newsHealth.lastOk = true;
    newsHealth.lastAt = Date.now();
    newsHealth.latencyMs = Date.now() - t0;
    newsHealth.error = null;
    return cachedReal;
  } catch (e) {
    newsSourceName = 'Dự phòng (giờ thật)';
    newsHealth.lastOk = false;
    newsHealth.lastAt = Date.now();
    newsHealth.latencyMs = null;
    newsHealth.error = e instanceof Error ? e.message : 'fetch failed (có thể bị CORS)';
    return refreshFallbackWindow();
  }
}

/** Kiểm tra lại nguồn lịch tin theo yêu cầu người dùng (nút "Kiểm tra") */
export async function testNewsSource(): Promise<boolean> {
  const keep = cachedReal;
  cachedReal = null; // bỏ cache để thử fetch thật
  await fetchEconomicCalendar();
  if (newsHealth.lastOk !== true && keep) cachedReal = keep; // giữ cache cũ nếu thử thất bại
  return newsHealth.lastOk === true;
}

/** Tin HIGH gần một mã trong ±minutes phút — dùng cho market snapshot */
export function newsNearSymbol(
  symbol: string,
  news: NewsEvent[],
  symbolCurrencies: (sym: string) => string[],
  minutes = 60
): string[] {
  const ccys = symbolCurrencies(symbol);
  return news
    .filter((n) => n.impact === 'HIGH' && ccys.includes(n.currency))
    .map((n) => `${n.currency} ${n.title} (${n.time})`);
}
