import { Quote } from '../types';

/**
 * Tầng dữ liệu thị trường THẬT — toàn bộ nguồn free, không cần API key.
 * - XAUUSD: Gold-API (realtime, CORS *)
 * - Forex: Open ER-API (tỷ giá thật, cập nhật hằng ngày)
 * - BTCUSD/ETHUSD: Kraken public ticker + OHLC (CORS ok)
 * - US30: không có nguồn keyless → SIM (ghi rõ badge)
 * Mọi fetch đều có timeout + fallback, không bao giờ làm sập app.
 */

const TIMEOUT_MS = 12000;

async function fetchJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const now = () => Date.now();

/* ---------- Theo dõi sức khỏe nguồn (phục vụ kiểm chứng) ---------- */

export interface SourceHealth {
  id: string;
  name: string;
  endpoint: string;
  serves: string;
  interval: string;
  lastOk: boolean | null; // null = chưa thử lần nào
  lastAt: number;
  latencyMs: number | null;
  error: string | null;
}

const healthMap = new Map<string, SourceHealth>();

function initSource(id: string, name: string, endpoint: string, serves: string, interval: string) {
  if (!healthMap.has(id)) {
    healthMap.set(id, { id, name, endpoint, serves, interval, lastOk: null, lastAt: 0, latencyMs: null, error: null });
  }
}

function markHealth(id: string, ok: boolean, latencyMs: number | null, error: string | null = null) {
  const h = healthMap.get(id);
  if (!h) return;
  h.lastOk = ok;
  h.lastAt = now();
  h.latencyMs = latencyMs;
  h.error = error;
}

export function getSourcesHealth(): SourceHealth[] {
  return [...healthMap.values()];
}

export const SOURCE_DEFS = [
  { id: 'gold', name: 'Gold-API', endpoint: 'https://api.gold-api.com/price/XAU', serves: 'XAUUSD realtime', interval: '60 giây' },
  { id: 'kraken', name: 'Kraken', endpoint: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD', serves: 'BTCUSD, ETHUSD realtime + lịch sử OHLC', interval: '60 giây' },
  { id: 'erapi', name: 'ER-API', endpoint: 'https://open.er-api.com/v6/latest/USD', serves: 'EURUSD, GBPUSD, USDJPY, AUDUSD (tỷ giá ngày)', interval: '10 phút' },
  { id: 'sim', name: 'Mô phỏng nội bộ', endpoint: '—', serves: 'US30 (không có nguồn keyless)', interval: '1 giây' },
] as const;

SOURCE_DEFS.forEach((d) => initSource(d.id, d.name, d.endpoint, d.serves, d.interval));

/** Vàng realtime */
export async function fetchGoldQuote(): Promise<Quote | null> {
  const t0 = now();
  try {
    const d = await fetchJson('https://api.gold-api.com/price/XAU');
    if (!d || typeof d.price !== 'number') throw new Error('bad payload');
    markHealth('gold', true, now() - t0);
    return {
      symbol: 'XAUUSD',
      price: Number(d.price.toFixed(2)),
      change24h: 0, // tính từ lịch sử poll ở tầng hook
      source: 'LIVE',
      sourceName: 'Gold-API',
      updatedAt: now(),
    };
  } catch (e) {
    markHealth('gold', false, null, e instanceof Error ? e.message : 'fetch failed');
    return null;
  }
}

/** Forex từ ER-API (base USD) → suy ra các cặp */
export async function fetchForexQuotes(): Promise<Quote[]> {
  const t0 = now();
  try {
    const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
    const r = d?.rates;
    if (!r) throw new Error('bad payload');
    markHealth('erapi', true, now() - t0);
    const q = (symbol: string, price: number): Quote => ({
      symbol,
      price,
      change24h: 0,
      source: 'DAILY',
      sourceName: 'ER-API',
      updatedAt: now(),
    });
    return [
      q('EURUSD', 1 / r.EUR),
      q('GBPUSD', 1 / r.GBP),
      q('USDJPY', r.JPY),
      q('AUDUSD', 1 / r.AUD),
    ].map((x) => ({ ...x, price: Number(x.price.toFixed(x.symbol === 'USDJPY' ? 3 : 5)) }));
  } catch (e) {
    markHealth('erapi', false, null, e instanceof Error ? e.message : 'fetch failed');
    return [];
  }
}

/** Crypto realtime từ Kraken ticker (có % 24h từ giá mở cửa) */
export async function fetchCryptoQuotes(): Promise<Quote[]> {
  const t0 = now();
  try {
    const d = await fetchJson('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD');
    const res = d?.result;
    if (!res) throw new Error('bad payload');
    markHealth('kraken', true, now() - t0);
    const map: Record<string, string> = { XXBTZUSD: 'BTCUSD', XETHZUSD: 'ETHUSD' };
    const out: Quote[] = [];
    for (const [k, symbol] of Object.entries(map)) {
      const t = res[k];
      if (!t) continue;
      const last = Number(t.c[0]);
      const open = Number(t.o);
      const chg = open > 0 ? Number((((last - open) / open) * 100).toFixed(2)) : 0;
      out.push({
        symbol,
        price: Number(last.toFixed(2)),
        change24h: chg,
        source: 'LIVE',
        sourceName: 'Kraken',
        updatedAt: now(),
      });
    }
    return out;
  } catch (e) {
    markHealth('kraken', false, null, e instanceof Error ? e.message : 'fetch failed');
    return [];
  }
}

/** Lịch sử nến Kraken để seed engine ngay lập tức (BTC/ETH) */
export async function fetchKrakenHistory(krakenPair: string, intervalMin = 60): Promise<number[]> {
  try {
    const d = await fetchJson(`https://api.kraken.com/0/public/OHLC?pair=${krakenPair}&interval=${intervalMin}`);
    const key = Object.keys(d?.result || {}).find((k) => k !== 'last');
    const candles = key ? d.result[key] : [];
    // close price = index 4
    return candles.map((c: any[]) => Number(c[4])).filter((n: number) => n > 0);
  } catch {
    return [];
  }
}

/** Gom tất cả nguồn — trả về map symbol → Quote */
export async function fetchAllQuotes(): Promise<Record<string, Quote>> {
  const [gold, forex, crypto] = await Promise.all([
    fetchGoldQuote(),
    fetchForexQuotes(),
    fetchCryptoQuotes(),
  ]);
  const map: Record<string, Quote> = {};
  if (gold) map[gold.symbol] = gold;
  for (const q of forex || []) map[q.symbol] = q;
  for (const q of crypto || []) map[q.symbol] = q;
  // Nguồn mô phỏng nội bộ luôn "khỏe"
  markHealth('sim', true, 0);
  return map;
}

/** Kiểm tra lại một nguồn theo yêu cầu người dùng (nút "Kiểm tra") */
export async function testSource(id: string): Promise<boolean> {
  if (id === 'gold') return (await fetchGoldQuote()) !== null;
  if (id === 'kraken') return (await fetchCryptoQuotes()).length > 0;
  if (id === 'erapi') return (await fetchForexQuotes()).length > 0;
  if (id === 'sim') {
    markHealth('sim', true, 0);
    return true;
  }
  return false;
}
