/**
 * patterns.ts — Phát hiện mẫu hình nến cơ bản từ OHLC (thay cho trang patterns của MyFxBook).
 * Chạy trên nến 5m TwelveData; kết quả là góc nhìn đa chiều cho phân tích.
 */
import { TdCandle } from './twelvedata';

export interface CandlePattern {
  name: string;
  direction: 'bull' | 'bear' | 'neutral';
  /** Chỉ số nến trong mảng (từ cuối lên): 0 = nến mới nhất */
  age: number;
  detail: string;
}

const body = (c: TdCandle) => Math.abs(c.c - c.o);
const isBull = (c: TdCandle) => c.c > c.o;
const isBear = (c: TdCandle) => c.c < c.o;
const range = (c: TdCandle) => c.h - c.l;

/** Quét N nến gần nhất, trả về các mẫu hình tìm thấy (mới nhất trước). */
export function detectPatterns(candles: TdCandle[], lookback = 12): CandlePattern[] {
  const out: CandlePattern[] = [];
  if (!candles || candles.length < 3) return out;
  const n = candles.length;
  const avgRange = candles.slice(-20).reduce((a, c) => a + range(c), 0) / Math.min(20, n) || 1;

  for (let age = 0; age < Math.min(lookback, n - 2); age++) {
    const i = n - 1 - age;
    const c = candles[i];
    const p = candles[i - 1];
    if (range(c) <= 0) continue;
    const b = body(c);

    // Doji — lưỡng lự
    if (b <= range(c) * 0.1 && range(c) >= avgRange * 0.5) {
      out.push({ name: 'Doji', direction: 'neutral', age, detail: 'Thân nến rất nhỏ — phe mua/bán giằng co' });
      continue;
    }
    // Hammer — búa rút chân (đảo chiều tăng)
    const lowerWick = Math.min(c.o, c.c) - c.l;
    const upperWick = c.h - Math.max(c.o, c.c);
    if (lowerWick >= b * 2 && upperWick <= b * 0.5 && range(c) >= avgRange * 0.6) {
      out.push({ name: 'Hammer', direction: 'bull', age, detail: 'Bóng dưới dài — lực mua đỡ giá' });
      continue;
    }
    // Shooting Star — sao băng (đảo chiều giảm)
    if (upperWick >= b * 2 && lowerWick <= b * 0.5 && range(c) >= avgRange * 0.6) {
      out.push({ name: 'Shooting Star', direction: 'bear', age, detail: 'Bóng trên dài — lực bán chốt lời' });
      continue;
    }
    // Engulfing — nhấn chìm
    if (isBear(p) && isBull(c) && c.o <= p.c && c.c >= p.o && b > body(p)) {
      out.push({ name: 'Bullish Engulfing', direction: 'bull', age, detail: 'Nến tăng nuốt trọn nến giảm trước' });
      continue;
    }
    if (isBull(p) && isBear(c) && c.o >= p.c && c.c <= p.o && b > body(p)) {
      out.push({ name: 'Bearish Engulfing', direction: 'bear', age, detail: 'Nến giảm nuốt trọn nến tăng trước' });
      continue;
    }
    // Morning/Evening Star (3 nến, rút gọn)
    if (i >= 2) {
      const a = candles[i - 2];
      if (isBear(a) && body(a) > avgRange * 0.5 && body(c) > avgRange * 0.5 && isBull(c)
        && c.c > (a.o + a.c) / 2) {
        out.push({ name: 'Morning Star', direction: 'bull', age, detail: 'Bộ 3 nến đảo chiều tăng' });
        continue;
      }
      if (isBull(a) && body(a) > avgRange * 0.5 && body(c) > avgRange * 0.5 && isBear(c)
        && c.c < (a.o + a.c) / 2) {
        out.push({ name: 'Evening Star', direction: 'bear', age, detail: 'Bộ 3 nến đảo chiều giảm' });
      }
    }
  }
  return out;
}

/** Tóm tắt phe cho 1 mã: bull - bear */
export function patternBias(patterns: CandlePattern[]): number {
  let s = 0;
  for (const p of patterns.slice(0, 5)) {
    const w = p.age === 0 ? 2 : 1;
    s += (p.direction === 'bull' ? 1 : p.direction === 'bear' ? -1 : 0) * w;
  }
  return s;
}
