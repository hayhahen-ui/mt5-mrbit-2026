/**
 * candles.ts — Dữ liệu nến cho biểu đồ chart.
 * - BTCUSD/ETHUSD: OHLC thật từ Kraken (public, không cần key).
 * - Các mã còn lại: nến tổng hợp từ giá poll realtime (bucket 5 phút),
 *   ghi rõ trên UI là nến tổng hợp — không giả vờ là nến sàn.
 */

export interface Candle {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
}

const KRAKEN_PAIR: Record<string, string> = { BTCUSD: 'XBTUSD', ETHUSD: 'ETHUSD' };

export function hasNativeOHLC(symbol: string): boolean {
  return symbol in KRAKEN_PAIR;
}

/** OHLC thật từ Kraken — interval phút (15/60/240/1440) */
export async function fetchKrakenOHLC(symbol: string, intervalMin = 15): Promise<Candle[]> {
  const pair = KRAKEN_PAIR[symbol];
  if (!pair) return [];
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${intervalMin}`, {
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) return [];
    const d = await res.json();
    const key = Object.keys(d?.result || {}).find((k) => k !== 'last');
    const raw = key ? d.result[key] : [];
    return raw
      .map((c: any[]): Candle => ({
        t: c[0] * 1000,
        o: Number(c[1]),
        h: Number(c[2]),
        l: Number(c[3]),
        c: Number(c[4]),
      }))
      .filter((c: Candle) => c.o > 0 && c.c > 0);
  } catch {
    return [];
  }
}

/* ---------- Nến tổng hợp từ giá poll (mã không có OHLC) ---------- */

const BUCKET_MS = 5 * 60 * 1000;
const MAX_CANDLES = 288; // 24h nến 5 phút

const store = new Map<string, Candle[]>();

export function pushQuote(symbol: string, price: number, ts: number): void {
  if (!(price > 0)) return;
  let arr = store.get(symbol);
  if (!arr) {
    arr = [];
    store.set(symbol, arr);
  }
  const bucketT = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
  const last = arr[arr.length - 1];
  if (last && last.t === bucketT) {
    last.c = price;
    if (price > last.h) last.h = price;
    if (price < last.l) last.l = price;
  } else {
    arr.push({ t: bucketT, o: price, h: price, l: price, c: price });
    if (arr.length > MAX_CANDLES) arr.splice(0, arr.length - MAX_CANDLES);
  }
}

export function getSynthCandles(symbol: string): Candle[] {
  return store.get(symbol) || [];
}

/** Nhãn nguồn nến để UI hiển thị trung thực */
export function candleSourceLabel(symbol: string): string {
  return hasNativeOHLC(symbol) ? 'Nến sàn Kraken (thật)' : 'Nến tổng hợp từ giá realtime';
}
