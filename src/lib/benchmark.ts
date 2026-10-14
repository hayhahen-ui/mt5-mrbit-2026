/**
 * benchmark.ts — ĐỐI ỨNG BENCHMARK
 * Lưu lệnh/số liệu của strategy tham chiếu (vd strategy copy trading Vantage)
 * để so sánh trực tiếp với tín hiệu hệ thống ở REPORT, phục vụ kaizen.
 *
 * Dữ liệu lưu localStorage (máy này), không tự xóa khi đầy — import vượt trần
 * sẽ bị từ chối kèm thông báo, giữ nguyên 100% dữ liệu cũ.
 */
import { pipSizeOf } from './account';

const STORAGE_KEY = 'nexuspilot-benchmark-v1';
export const MAX_TRADES_PER_STRATEGY = 5000;

export type BenchmarkSource = 'vantage-copy' | 'manual' | 'other';

export interface BenchmarkTrade {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  openTime: string; // ISO
  closeTime: string; // ISO
  openPrice: number;
  closePrice: number;
  lot: number;
  pnlUsd: number; // lãi/lỗ $ đã thực hiện (có dấu)
  riskUsd?: number; // rủi ro $/lệnh nếu biết → suy ra R
  rMultiple: number; // R (tính từ riskUsd, hoặc 0 + rKnown=false nếu không biết)
  rKnown: boolean; // R có phải số thật không (false = không biết SL/rủi ro)
  pips: number;
  note?: string;
}

export interface BenchmarkStrategy {
  id: string;
  name: string; // vd 'Vantage #1533098'
  source: BenchmarkSource;
  sourceNote?: string;
  sourceUrl?: string; // link gốc (vd link Vantage) — để nhận diện trùng
  createdAt: string; // ISO
  trades: BenchmarkTrade[];
}

export interface BenchmarkStats {
  total: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number; // %
  totalR: number; // chỉ tính trên lệnh rKnown
  avgR: number; // chỉ tính trên lệnh rKnown
  profitFactor: number; // R-based, chỉ khi hasR (0 = không tính được)
  totalPips: number;
  totalUsd: number;
  maxDrawdownR: number; // chỉ khi hasR
  maxDrawdownUsd: number;
  hasR: boolean;
}

export const BENCHMARK_SOURCE_LABEL: Record<BenchmarkSource, string> = {
  'vantage-copy': 'Vantage Copy',
  manual: 'Nhập tay',
  other: 'Khác',
};

/** Đọc danh sách strategy tham chiếu */
export function loadBenchmarks(): BenchmarkStrategy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Lưu danh sách strategy tham chiếu */
export function saveBenchmarks(list: BenchmarkStrategy[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn — bỏ qua im lặng */
  }
}

/** Tạo strategy tham chiếu mới */
export function createStrategy(name: string, source: BenchmarkSource, sourceNote?: string): BenchmarkStrategy {
  const now = new Date().toISOString();
  return {
    id: `BM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Benchmark ${now.slice(0, 10)}`,
    source,
    sourceNote: sourceNote?.trim() || undefined,
    createdAt: now,
    trades: [],
  };
}

function calcPips(symbol: string, direction: 'BUY' | 'SELL', openPrice: number, closePrice: number): number {
  const pip = pipSizeOf(symbol);
  if (!(pip > 0) || !(openPrice > 0) || !(closePrice > 0)) return 0;
  const diff = direction === 'BUY' ? closePrice - openPrice : openPrice - closePrice;
  return Number((diff / pip).toFixed(1));
}

/** Dựng 1 trade từ dữ liệu thô (CSV / form tay) */
export function makeTrade(input: {
  symbol: string;
  direction: 'BUY' | 'SELL';
  openTime?: string;
  closeTime?: string;
  openPrice?: number;
  closePrice?: number;
  lot?: number;
  pnlUsd: number;
  riskUsd?: number;
  rMultiple?: number;
  pips?: number;
  note?: string;
}): BenchmarkTrade {
  const now = new Date().toISOString();
  const symbol = (input.symbol || '').toUpperCase().trim();
  const rKnown = typeof input.rMultiple === 'number' || (typeof input.riskUsd === 'number' && input.riskUsd > 0);
  const rMultiple = typeof input.rMultiple === 'number'
    ? Number(input.rMultiple.toFixed(2))
    : input.riskUsd && input.riskUsd > 0
      ? Number((input.pnlUsd / input.riskUsd).toFixed(2))
      : 0;
  return {
    id: `BT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    direction: input.direction,
    openTime: input.openTime || now,
    closeTime: input.closeTime || now,
    openPrice: input.openPrice ?? 0,
    closePrice: input.closePrice ?? 0,
    lot: input.lot ?? 0,
    pnlUsd: Number(input.pnlUsd.toFixed(2)),
    riskUsd: input.riskUsd,
    rMultiple,
    rKnown,
    pips: typeof input.pips === 'number' ? input.pips : calcPips(symbol, input.direction, input.openPrice ?? 0, input.closePrice ?? 0),
    note: input.note?.trim() || undefined,
  };
}

export interface CsvParseResult {
  trades: BenchmarkTrade[];
  errors: string[];
}

/**
 * Parse CSV dán từ clipboard.
 * Cột: symbol,direction,openTime,closeTime,openPrice,closePrice,lot,pnlUsd,riskUsd,pips,note
 * - Dòng đầu là header (ô đầu = 'symbol', không phân biệt hoa thường) → bỏ qua.
 * - Bắt buộc: symbol, direction (BUY/SELL), pnlUsd (số, có dấu).
 * - Các cột còn lại tùy chọn; thiếu openTime/closeTime → lấy thời điểm nhập.
 */
export function parseBenchmarkCsv(text: string): CsvParseResult {
  const trades: BenchmarkTrade[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  lines.forEach((line, idx) => {
    const cols = line.split(',').map((c) => c.trim());
    if (idx === 0 && cols[0]?.toLowerCase() === 'symbol') return; // header
    const [symbol, dirRaw, openTime, closeTime, openPriceS, closePriceS, lotS, pnlS, riskS, pipsS, ...noteRest] = cols;
    const direction = (dirRaw || '').toUpperCase();
    const pnlUsd = Number(pnlS);
    if (!symbol) { errors.push(`Dòng ${idx + 1}: thiếu symbol`); return; }
    if (direction !== 'BUY' && direction !== 'SELL') { errors.push(`Dòng ${idx + 1}: direction phải là BUY/SELL`); return; }
    if (!isFinite(pnlUsd)) { errors.push(`Dòng ${idx + 1}: pnlUsd không phải số`); return; }
    const num = (s: string | undefined): number | undefined => {
      if (s === undefined || s === '') return undefined;
      const n = Number(s);
      return isFinite(n) ? n : undefined;
    };
    trades.push(makeTrade({
      symbol,
      direction,
      openTime: openTime || undefined,
      closeTime: closeTime || undefined,
      openPrice: num(openPriceS),
      closePrice: num(closePriceS),
      lot: num(lotS),
      pnlUsd,
      riskUsd: num(riskS),
      pips: num(pipsS),
      note: noteRest.join(',') || undefined,
    }));
  });
  return { trades, errors };
}

/** Thống kê tổng hợp của 1 strategy (mirror calcJournalStats + max drawdown) */
export function calcBenchmarkStats(trades: BenchmarkTrade[]): BenchmarkStats {
  const total = trades.length;
  const wins = trades.filter((t) => t.pnlUsd > 0).length;
  const losses = trades.filter((t) => t.pnlUsd < 0).length;
  const breakEvens = trades.filter((t) => t.pnlUsd === 0).length;
  const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;
  const known = trades.filter((t) => t.rKnown);
  const hasR = known.length > 0;
  const totalR = Number(known.reduce((a, t) => a + t.rMultiple, 0).toFixed(2));
  const avgR = hasR ? Number((totalR / known.length).toFixed(2)) : 0;
  const grossWin = known.filter((t) => t.rMultiple > 0).reduce((a, t) => a + t.rMultiple, 0);
  const grossLoss = Math.abs(known.filter((t) => t.rMultiple < 0).reduce((a, t) => a + t.rMultiple, 0));
  const profitFactor = hasR ? (grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? 99.99 : 0) : 0;
  const totalPips = Number(trades.reduce((a, t) => a + t.pips, 0).toFixed(1));
  const totalUsd = Number(trades.reduce((a, t) => a + t.pnlUsd, 0).toFixed(2));
  const maxDrawdownR = hasR ? maxDrawdown(benchmarkEquityCurveR(trades).map((p) => p.y)) : 0;
  const maxDrawdownUsd = maxDrawdown(benchmarkEquityCurveUsd(trades).map((p) => p.y));
  return { total, wins, losses, breakEvens, winRate, totalR, avgR, profitFactor, totalPips, totalUsd, maxDrawdownR, maxDrawdownUsd, hasR };
}

/** Max drawdown (peak-to-trough) của 1 đường equity */
export function maxDrawdown(equity: number[]): number {
  let peak = 0;
  let dd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    dd = Math.max(dd, peak - v);
  }
  return Number(dd.toFixed(2));
}

/** Đường cong equity R tích lũy (chỉ lệnh rKnown), sắp xếp theo closeTime */
export function benchmarkEquityCurveR(trades: BenchmarkTrade[]): { x: number; y: number }[] {
  const sorted = [...trades].filter((t) => t.rKnown).sort((a, b) => a.closeTime.localeCompare(b.closeTime));
  let acc = 0;
  return sorted.map((t, i) => {
    acc = Number((acc + t.rMultiple).toFixed(2));
    return { x: i + 1, y: acc };
  });
}

/** Đường cong equity $ tích lũy, sắp xếp theo closeTime */
export function benchmarkEquityCurveUsd(trades: BenchmarkTrade[]): { x: number; y: number }[] {
  const sorted = [...trades].sort((a, b) => a.closeTime.localeCompare(b.closeTime));
  let acc = 0;
  return sorted.map((t, i) => {
    acc = Number((acc + t.pnlUsd).toFixed(2));
    return { x: i + 1, y: acc };
  });
}

/** Lọc trade theo cutoff (ms) — đồng bộ với bộ lọc 7D/30D/ALL của REPORT */
export function filterTradesByCutoff(trades: BenchmarkTrade[], cutoffMs: number): BenchmarkTrade[] {
  if (!cutoffMs) return trades;
  return trades.filter((t) => new Date(t.closeTime).getTime() >= cutoffMs);
}

// ── Server-side (Supabase qua api-server Render) ─────────────────────────────
// App ưu tiên đọc server (đa thiết bị, online); rớt mạng → dùng localStorage.

const serverBase = (): string => {
  try {
    const u = (import.meta as any).env?.VITE_POSITIONS_API_URL || '';
    return String(u).replace(/\/$/, '');
  } catch {
    return '';
  }
};

export const benchmarkServerOn = (): boolean => !!serverBase();

/** Parse link Vantage copy trading → { strategyId } | null */
export function parseVantageLink(url: string): { strategyId: string } | null {
  const m = String(url || '').match(/[?&]strategyId=(\d+)/);
  return m ? { strategyId: m[1] } : null;
}

/** GET /api/benchmarks — null khi server chưa sẵn sàng */
export async function fetchBenchmarksServer(): Promise<BenchmarkStrategy[] | null> {
  const base = serverBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api/benchmarks`);
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok && Array.isArray(j.strategies) ? j.strategies : null;
  } catch {
    return null;
  }
}

/** POST /api/benchmarks — tạo strategy trên server */
export async function createBenchmarkServer(input: {
  name: string;
  source: BenchmarkSource;
  sourceNote?: string;
  sourceUrl?: string;
  id?: string;
}): Promise<BenchmarkStrategy | null> {
  const base = serverBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api/benchmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? j.strategy : null;
  } catch {
    return null;
  }
}

/** POST /api/benchmark-trades — đẩy bulk trades lên server */
export async function pushBenchmarkTradesServer(
  strategyId: string,
  trades: BenchmarkTrade[]
): Promise<{ inserted: number; conflicted: number; skipped: number } | null> {
  const base = serverBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api/benchmark-trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId, trades }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? { inserted: j.inserted || 0, conflicted: j.conflicted || 0, skipped: j.skipped || 0 } : null;
  } catch {
    return null;
  }
}

/** DELETE /api/benchmarks?id= — xóa strategy trên server */
export async function deleteBenchmarkServer(id: string): Promise<boolean> {
  const base = serverBase();
  if (!base) return false;
  try {
    const r = await fetch(`${base}/api/benchmarks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    return r.ok;
  } catch {
    return false;
  }
}
