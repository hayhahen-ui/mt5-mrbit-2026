/**
 * twelvedata.ts — Client lấy nến forex intraday thật (thay giá daily đứng yên của ER-API).
 * Free tier: 8 credit/phút, 800 credit/ngày → chu kỳ 20 phút cho 9 cặp ≈ 650 credit/ngày.
 * Key lưu localStorage máy user (như AI keys / MyFxBook), gọi qua /api/twelvedata.
 */
export interface TdCandle { t: number; o: number; h: number; l: number; c: number }

const KEY = 'nexuspilot-twelvedata-v1';
const USAGE_KEY = 'nexuspilot-twelvedata-usage-v1';
const PROXY = '/api/twelvedata';

/** XAUUSD giữ Gold-API 60s; 9 cặp forex còn lại qua TwelveData */
export const TD_SYMBOLS: Record<string, string> = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY',
  AUDUSD: 'AUD/USD', NZDUSD: 'NZD/USD', USDCAD: 'USD/CAD',
  USDCHF: 'USD/CHF', EURJPY: 'EUR/JPY', GBPJPY: 'GBP/JPY',
};
export const TD_LIST = Object.keys(TD_SYMBOLS);

export function getTdKey(): string {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function setTdKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY, k.trim());
    else localStorage.removeItem(KEY);
  } catch { /* noop */ }
}
export function tdKeyHint(): string {
  const k = getTdKey();
  return k ? `••••${k.slice(-4)}` : '';
}

/** Đếm credit đã dùng hôm nay (localStorage, reset theo ngày UTC). */
function usage(): { day: string; n: number } {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) { const u = JSON.parse(raw); if (u.day === day) return u; }
  } catch { /* noop */ }
  return { day, n: 0 };
}
function bumpUsage(n = 1) {
  const u = usage();
  u.n += n;
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch { /* noop */ }
}
export function tdUsageToday(): number { return usage().n; }
/** Còn quota không (giữ biên an toàn 750/800). */
export function tdHasQuota(n = 1): boolean { return usage().n + n <= 750; }

async function tdCall(endpoint: string, params: Record<string, string>): Promise<any> {
  const apikey = getTdKey();
  if (!apikey) throw new Error('Chưa nhập API key TwelveData.');
  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey, endpoint, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

/** Nến 5m thật cho 1 mã — 1 credit. */
export async function tdCandles(symbol: string, outputsize = 96): Promise<TdCandle[]> {
  const tdSym = TD_SYMBOLS[symbol];
  if (!tdSym) throw new Error(`Mã ${symbol} không hỗ trợ TwelveData.`);
  if (!tdHasQuota(1)) throw new Error('Hết quota TwelveData hôm nay (giữ biên 750/800).');
  const d = await tdCall('time_series', {
    symbol: tdSym, interval: '5min', outputsize: String(outputsize), order: 'ASC',
  });
  bumpUsage(1);
  const vals = Array.isArray(d.values) ? d.values : [];
  return vals
    .map((v: any) => ({
      t: new Date(v.datetime.replace(' ', 'T') + 'Z').getTime(),
      o: Number(v.open), h: Number(v.high), l: Number(v.low), c: Number(v.close),
    }))
    .filter((c: TdCandle) => Number.isFinite(c.c) && c.t > 0)
    .sort((a: TdCandle, b: TdCandle) => a.t - b.t);
}

/** Giá hiện tại 1 mã — 1 credit (dùng cho nút kiểm tra). */
export async function tdPrice(symbol: string): Promise<number> {
  const tdSym = TD_SYMBOLS[symbol];
  if (!tdSym) throw new Error(`Mã ${symbol} không hỗ trợ TwelveData.`);
  const d = await tdCall('price', { symbol: tdSym });
  bumpUsage(1);
  const p = Number(d.price);
  if (!Number.isFinite(p) || p <= 0) throw new Error('Giá không hợp lệ.');
  return p;
}

/** Delay giữa các call để không vượt 8 credit/phút. */
export const TD_GAP_MS = 8000;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
