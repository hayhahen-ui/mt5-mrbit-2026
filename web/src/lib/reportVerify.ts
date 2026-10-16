/**
 * reportVerify.ts — lớp KIỂM CHỨNG cho tab REPORT (audit 16/10/2026).
 *
 * Mục tiêu: mọi con số trên REPORT đều truy được về 3 thứ —
 *   (1) công thức bằng chữ, (2) các đầu vào, (3) từng lệnh đằng sau nó.
 * User tự đối chiếu được; sai ở đâu thì chỉ ra được.
 *
 * NGUYÊN TẮC: KHÔNG đổi bất kỳ định nghĩa nào trong journal.ts / account.ts.
 * Mọi hàm ở đây chỉ bọc lại các hàm đã fix (pipsOf, calcJournalStats,
 * entryPnlUsd, lotOutliers, realizedPnlUsdClean) để phục vụ hiển thị kiểm chứng.
 */
import { JournalEntry, JournalOutcome } from '../types';
import { pipsOf, calcJournalStats } from './journal';
import { entryPnlUsd, lotOutliers, realizedPnlUsdClean } from './account';

/** Một dòng trong bảng drill-down "lệnh đằng sau con số" */
export interface VerifyRow {
  id: string;
  closeTime: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  outcome: JournalOutcome;
  rMultiple: number;
  pips: number; // pips đã chữa (pipsOf), không phải cột pips thô
  pnlUsd: number; // entryPnlUsd
  lot: number;
  isOutlierLot: boolean; // true → đã loại khỏi tổng $ REPORT
}

/** Dựng danh sách lệnh kiểm chứng, mới nhất trước */
export function verifyRows(entries: JournalEntry[]): VerifyRow[] {
  const outIds = new Set(lotOutliers(entries).map((e) => e.id));
  return [...entries]
    .sort((a, b) => b.closeTime.localeCompare(a.closeTime))
    .map((e) => ({
      id: e.id,
      closeTime: e.closeTime,
      symbol: e.symbol,
      direction: e.direction,
      outcome: e.outcome,
      rMultiple: e.rMultiple,
      pips: pipsOf(e),
      pnlUsd: entryPnlUsd(e),
      lot: e.lot,
      isOutlierLot: outIds.has(e.id),
    }));
}

/** Thống kê thắng/thua đã phân định của một tập lệnh (dùng cho BY Q / theo mã) */
export function decidedStats(entries: JournalEntry[]): {
  wins: number;
  losses: number;
  decided: number;
  winPct: number; // % làm tròn 0 chữ số như UI
} {
  const wins = entries.filter((e) => e.outcome === 'TP').length;
  const losses = entries.filter((e) => e.outcome === 'SL').length;
  const decided = wins + losses;
  return { wins, losses, decided, winPct: decided > 0 ? Number(((wins / decided) * 100).toFixed(0)) : 0 };
}

/** Chuỗi "100% (3/3)" — luôn kèm mẫu số đã phân định, tránh hiểu lầm */
export function fmtWinFrac(entries: JournalEntry[]): string {
  const d = decidedStats(entries);
  return `${d.winPct}% (${d.wins}/${d.decided})`;
}

export type ReconKey = 'R' | 'wins' | 'pips' | 'usd';

export interface ReconItem {
  key: ReconKey;
  label: string;
  bySymbol: number; // cộng dồn theo từng mã
  total: number; // số trên thẻ metric
  diff: number; // bySymbol - total (làm tròn hiển thị)
  ok: boolean;
}

/**
 * Đối chiếu: tổng theo mã cộng lại có bằng số tổng trên thẻ không.
 * Dung sai làm tròn: R 0.05, wins khớp tuyệt đối, pips 1.0, $ 0.05.
 * Lưu ý: $ theo mã cũng loại cùng tập outlier toàn cục (realizedPnlUsdClean
 * tính outlier trên toàn bộ entries), nên hai vế phải khớp nhau.
 */
export function reconcile(entries: JournalEntry[]): ReconItem[] {
  const st = calcJournalStats(entries);
  const clean = realizedPnlUsdClean(entries);
  const outIds = new Set(lotOutliers(entries).map((e) => e.id));
  const syms = [...new Set(entries.map((e) => e.symbol))];

  let rSum = 0;
  let wSum = 0;
  let pSum = 0;
  let uSum = 0;
  for (const s of syms) {
    const es = entries.filter((e) => e.symbol === s);
    const ss = calcJournalStats(es);
    rSum = Number((rSum + ss.totalR).toFixed(2));
    wSum += ss.wins;
    pSum = Number((pSum + ss.totalPips).toFixed(1));
    // $ theo mã: loại đúng tập outlier toàn cục để so sánh công bằng
    const usd = es.filter((e) => !outIds.has(e.id)).reduce((a, e) => a + entryPnlUsd(e), 0);
    uSum = Number((uSum + usd).toFixed(2));
  }

  const items: Array<Omit<ReconItem, 'diff' | 'ok'> & { tol: number; dp: number }> = [
    { key: 'R', label: 'Tổng R', bySymbol: rSum, total: st.totalR, tol: 0.05, dp: 2 },
    { key: 'wins', label: 'Tổng wins (TP)', bySymbol: wSum, total: st.wins, tol: 0, dp: 0 },
    { key: 'pips', label: 'Tổng pips', bySymbol: pSum, total: st.totalPips, tol: 1.0, dp: 1 },
    { key: 'usd', label: 'Tổng $ (đã loại outlier)', bySymbol: uSum, total: clean.total, tol: 0.05, dp: 2 },
  ];
  return items.map(({ tol, dp, ...it }) => {
    const diff = Number((it.bySymbol - it.total).toFixed(dp));
    return { ...it, diff, ok: Math.abs(it.bySymbol - it.total) <= tol };
  });
}

export interface DataQuality {
  total: number;
  /** Bản ghi thiếu giá vào hoặc giá ra */
  missingPrices: number;
  /** Bản ghi có pips đã lưu ≠ pips tính lại (chênh > 0.05) → đã được pipsOf tự chữa */
  pipsHealed: number;
  /** Tổng |chênh lệch| pips đã chữa — cho thấy mức độ sai của dữ liệu cũ */
  pipsHealedAbs: number;
  /** Số outlier lot (bị loại khỏi tổng $ REPORT) */
  outlierCount: number;
}

/** Dải chất lượng dữ liệu: đếm các vấn đề, không sửa gì */
export function dataQuality(entries: JournalEntry[]): DataQuality {
  let missingPrices = 0;
  let pipsHealed = 0;
  let pipsHealedAbs = 0;
  for (const e of entries) {
    if (!(e.entryPrice > 0) || !(e.exitPrice > 0)) missingPrices++;
    const stored = e.pips ?? 0;
    const fixed = pipsOf(e);
    const d = Math.abs(fixed - stored);
    if (d > 0.05) {
      pipsHealed++;
      pipsHealedAbs = Number((pipsHealedAbs + d).toFixed(1));
    }
  }
  return {
    total: entries.length,
    missingPrices,
    pipsHealed,
    pipsHealedAbs,
    outlierCount: lotOutliers(entries).length,
  };
}

/** Tổng pips / R / $ theo từng mã — dùng cho drill-down của thẻ metric */
export interface SymbolSubtotal {
  symbol: string;
  n: number;
  totalR: number;
  totalPips: number;
  totalUsd: number; // đã loại outlier toàn cục
  wins: number;
  decided: number;
}

export function symbolSubtotals(entries: JournalEntry[]): SymbolSubtotal[] {
  const outIds = new Set(lotOutliers(entries).map((e) => e.id));
  return [...new Set(entries.map((e) => e.symbol))]
    .map((s) => {
      const es = entries.filter((e) => e.symbol === s);
      const st = calcJournalStats(es);
      const usd = es.filter((e) => !outIds.has(e.id)).reduce((a, e) => a + entryPnlUsd(e), 0);
      return {
        symbol: s,
        n: es.length,
        totalR: st.totalR,
        totalPips: st.totalPips,
        totalUsd: Number(usd.toFixed(2)),
        wins: st.wins,
        decided: st.wins + st.losses,
      };
    })
    .sort((a, b) => b.n - a.n);
}
