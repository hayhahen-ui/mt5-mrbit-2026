import { JournalEntry, JournalOutcome, JournalStats, Position } from '../types';
import { pipSizeOf } from './account';

const STORAGE_KEY = 'nexuspilot-journal-v1';

/** Đọc sổ tín hiệu từ localStorage */
export function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Lưu sổ tín hiệu xuống localStorage */
export function saveJournal(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn — bỏ qua im lặng */
  }
}

/** Xóa toàn bộ sổ (có xác nhận ở tầng UI) */
export function clearJournal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Tính số R của một lệnh đã đóng.
 * risk = |entry − SL| ; reward = (exit − entry) có dấu theo chiều lệnh.
 */
export function calcRMultiple(
  direction: 'BUY' | 'SELL',
  entryPrice: number,
  stopLoss: number,
  exitPrice: number
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk <= 0) return 0;
  const signed = direction === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return Number((signed / risk).toFixed(2));
}

/**
 * Tạo bản ghi sổ từ một position vừa đóng với kết quả do user đánh dấu.
 * exitPrice: giá thoát thực tế (TP/SL/BE/giá hiện tại khi đóng tay).
 */
export function entryFromPosition(
  pos: Position,
  outcome: JournalOutcome,
  exitPrice: number,
  digits: number,
  closeMethod: 'tay' | 'auto' = 'tay',
  closeNote?: string
): JournalEntry {
  const rMultiple = outcome === 'BE' ? 0 : calcRMultiple(pos.type, pos.entryPrice, pos.sl, exitPrice);
  // Dùng pipSizeOf dùng chung (account.ts): JPY 0.01, forex 0.0001, vàng/crypto/chỉ số 0.1.
  // Trước đây hardcode 0.0001 cho mọi mã không phải JPY → cột pips của XAU/BTC/ETH/US30 sai hàng nghìn lần.
  const pipSize = pipSizeOf(pos.symbol);
  const pips = Number((((pos.type === 'BUY' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice)) / pipSize).toFixed(1));
  const now = new Date().toISOString();
  return {
    id: `J-${Date.now()}-${pos.tier}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: pos.symbol,
    direction: pos.type,
    engine: pos.engine || 'SMC',
    engineName: pos.engineName || '—',
    tier: pos.tier,
    lot: pos.lot,
    entryPrice: pos.entryPrice,
    stopLoss: pos.sl,
    takeProfit: pos.tp,
    score: pos.score ?? 0,
    quality: pos.quality ?? 'Q3',
    openTime: now,
    closeTime: now,
    outcome,
    exitPrice: Number(exitPrice.toFixed(digits)),
    rMultiple,
    pips,
    marketSnapshot: pos.marketSnapshot,
    kaizenId: pos.kaizenId,
    closeMethod,
    closeNote,
  };
}

/** Thống kê tổng hợp từ sổ — thay thế số liệu cứng ở tab LOG */
export function calcJournalStats(entries: JournalEntry[]): JournalStats {
  const total = entries.length;
  const wins = entries.filter((e) => e.outcome === 'TP').length;
  const losses = entries.filter((e) => e.outcome === 'SL').length;
  const breakEvens = entries.filter((e) => e.outcome === 'BE').length;
  const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;
  const totalR = Number(entries.reduce((a, e) => a + e.rMultiple, 0).toFixed(2));
  const avgR = total > 0 ? Number((totalR / total).toFixed(2)) : 0;
  const grossWin = entries.filter((e) => e.rMultiple > 0).reduce((a, e) => a + e.rMultiple, 0);
  const grossLoss = Math.abs(entries.filter((e) => e.rMultiple < 0).reduce((a, e) => a + e.rMultiple, 0));
  const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? 99.99 : 0;
  const totalPips = Number(entries.reduce((a, e) => a + e.pips, 0).toFixed(1));
  return { total, wins, losses, breakEvens, winRate, totalR, avgR, profitFactor, totalPips };
}

/** Đường cong equity (R tích lũy) cho biểu đồ */
export function equityCurve(entries: JournalEntry[]): { x: number; y: number }[] {
  const sorted = [...entries].sort((a, b) => a.closeTime.localeCompare(b.closeTime));
  let acc = 0;
  return sorted.map((e, i) => {
    acc = Number((acc + e.rMultiple).toFixed(2));
    return { x: i + 1, y: acc };
  });
}

export const OUTCOME_META: Record<JournalOutcome, { label: string; color: string }> = {
  TP: { label: 'Chạm TP', color: 'text-emerald-400' },
  SL: { label: 'Dính SL', color: 'text-rose-400' },
  BE: { label: 'Hòa vốn', color: 'text-sky-400' },
  MANUAL: { label: 'Đóng tay', color: 'text-slate-400' },
  TIME: { label: 'Time-stop', color: 'text-amber-400' },
};
