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

/* ---------- Lịch sử quote cho mã không có OHLC (vẽ đường giá) ---------- */

export interface QuotePoint {
  t: number; // ms
  price: number;
}

const MAX_POINTS = 300;

const quoteStore = new Map<string, QuotePoint[]>();

/** Gom mỗi lần poll thành 1 điểm giá (kể cả khi giá không đổi quá 30s) */
export function pushQuotePoint(symbol: string, price: number, ts: number): void {
  if (!(price > 0)) return;
  let arr = quoteStore.get(symbol);
  if (!arr) {
    arr = [];
    quoteStore.set(symbol, arr);
  }
  arr.push({ t: ts, price });
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
}

export function getQuoteHistory(symbol: string): QuotePoint[] {
  return quoteStore.get(symbol) || [];
}

/** Nhãn nguồn dữ liệu để UI hiển thị trung thực */
export function candleSourceLabel(symbol: string): string {
  return hasNativeOHLC(symbol)
    ? 'Nến sàn Kraken (thật) · nến 15m'
    : 'Đường giá từ quote realtime — không phải nến sàn';
}
