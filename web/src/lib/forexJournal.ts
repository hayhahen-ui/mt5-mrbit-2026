/**
 * forexJournal.ts — NHẬT KÝ DỮ LIỆU FOREX (append-only, localStorage).
 * Mỗi 15 phút chụp 1 snapshot: giá + heatmap đa khung tự tính + tâm lý MyFxBook + tin HIGH.
 * Không bao giờ tự xóa — chỉ cắt trần 192 bản ghi (~48 giờ).
 */
import { heatmap, HEATMAP_SYMBOLS, HEATMAP_TFS } from './priceHistory';
import { getCachedOutlook } from './sentiment';

const KEY = 'nexuspilot-forex-journal-v1';
const SNAP_GAP_MS = 15 * 60_000;
const MAX_SNAPS = 192;

export interface ForexSnap {
  at: number;
  prices: Record<string, number>;
  /** { SYM: { minutes: pct|null } } */
  heat: Record<string, Record<number, number | null>>;
  /** { SYM: { longPct, shortPct } } — từ cache MyFxBook */
  sentiment: Record<string, { l: number; s: number }>;
  newsHigh: number;
}

function read(): ForexSnap[] {
  try {
    const raw = localStorage.getItem(KEY);
    const a = raw ? JSON.parse(raw) : [];
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

function write(a: ForexSnap[]) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* bỏ qua */ }
}

export function getForexJournal(): ForexSnap[] {
  return read();
}

export function lastSnapAt(): number {
  const a = read();
  return a.length ? a[a.length - 1].at : 0;
}

function buildSnap(prices: Record<string, number>, newsHigh: number): ForexSnap {
  const outlook = getCachedOutlook();
  const sentiment: Record<string, { l: number; s: number }> = {};
  for (const s of HEATMAP_SYMBOLS) {
    const row = outlook.find((r) => r.symbol === s);
    if (row) sentiment[s] = { l: row.longPct, s: row.shortPct };
  }
  return {
    at: Date.now(),
    prices: { ...prices },
    heat: heatmap(),
    sentiment,
    newsHigh,
  };
}

/** Chụp snapshot nếu đã quá 15 phút — trả về snap mới hoặc null. */
export function maybeForexSnapshot(prices: Record<string, number>, newsHigh: number): ForexSnap | null {
  if (Date.now() - lastSnapAt() < SNAP_GAP_MS) return null;
  return takeForexSnapshot(prices, newsHigh);
}

/** Chụp ngay 1 snapshot (nút tay). */
export function takeForexSnapshot(prices: Record<string, number>, newsHigh: number): ForexSnap {
  const a = read();
  const snap = buildSnap(prices, newsHigh);
  a.push(snap);
  while (a.length > MAX_SNAPS) a.shift();
  write(a);
  return snap;
}

/** Xu hướng heatmap của 1 mã trong snapshot: số khung xanh - số khung đỏ */
export function heatBias(snap: ForexSnap, symbol: string): number {
  const row = snap.heat[symbol];
  if (!row) return 0;
  let b = 0;
  for (const tf of HEATMAP_TFS) {
    const v = row[tf];
    if (v === null) continue;
    if (v > 0) b++;
    else if (v < 0) b--;
  }
  return b;
}
