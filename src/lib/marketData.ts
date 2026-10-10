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

/** Vàng realtime */
export async function fetchGoldQuote(): Promise<Quote | null> {
  try {
    const d = await fetchJson('https://api.gold-api.com/price/XAU');
    if (!d || typeof d.price !== 'number') return null;
    return {
      symbol: 'XAUUSD',
      price: Number(d.price.toFixed(2)),
      change24h: 0, // tính từ lịch sử poll ở tầng hook
      source: 'LIVE',
      sourceName: 'Gold-API',
      updatedAt: now(),
    };
  } catch {
    return null;
  }
}

/** Forex từ ER-API (base USD) → suy ra các cặp */
export async function fetchForexQuotes(): Promise<Quote[]> {
  try {
    const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
    const r = d?.rates;
    if (!r) return [];
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
  } catch {
    return [];
  }
}

/** Crypto realtime từ Kraken ticker (có % 24h từ giá mở cửa) */
export async function fetchCryptoQuotes(): Promise<Quote[]> {
  try {
    const d = await fetchJson('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD');
    const res = d?.result;
    if (!res) return [];
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
  } catch {
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
  return map;
}
