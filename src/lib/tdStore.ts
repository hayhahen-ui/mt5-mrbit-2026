/**
 * tdStore.ts — Kho nến TwelveData (localStorage, một phần của masterdata).
 * 9 cặp forex × 96 nến 5m, làm mới mỗi 20 phút.
 */
import { TdCandle } from './twelvedata';

const KEY = 'nexuspilot-td-candles-v1';

export interface TdCache { at: number; candles: Record<string, TdCandle[]> }

export function getTdCache(): TdCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || !d.candles) return null;
    return d as TdCache;
  } catch { return null; }
}

export function setTdCache(candles: Record<string, TdCandle[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), candles }));
  } catch { /* noop */ }
}

/** Merge thêm nến mới vào cache (dedupe theo timestamp). */
export function mergeTdCandles(symbol: string, fresh: TdCandle[], keep = 288): TdCandle[] {
  const cache = getTdCache();
  const old = cache?.candles?.[symbol] || [];
  const seen = new Set(old.map((c) => c.t));
  const merged = [...old];
  for (const c of fresh) {
    if (!seen.has(c.t)) { merged.push(c); seen.add(c.t); }
  }
  merged.sort((a, b) => a.t - b.t);
  const out = merged.slice(-keep);
  const all = cache?.candles || {};
  all[symbol] = out;
  setTdCache(all);
  return out;
}

export function tdCacheSize(): number {
  try { return (localStorage.getItem(KEY) || '').length * 2; } catch { return 0; }
}
