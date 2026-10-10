/**
 * quoteGuard.ts — Lưới lọc "tick ảo" (bad-tick guard).
 * Vấn đề thật (10/10/2026): Gold-API thoáng trả giá stale 2652.4 thay vì 4195.6
 * (rớt 37% trong 1 poll) → P&L/Equity ảo +$462.96, suýt khiến bot auto-chốt TP nhầm.
 * Nguyên tắc: mọi quote đều qua đây trước khi vào giá/heatmap/engine.
 * - Nhảy quá ngưỡng theo loại tài sản → TỪ CHỐI, giữ giá cũ, không ghi history.
 * - 3 poll liên tiếp đồng thuận mức giá mới (±0.5%) → chấp nhận (gap thật, vd mở cửa cuối tuần).
 * - Không bao giờ tự "sửa" giá — chỉ chấp nhận hoặc từ chối.
 */

/** Ngưỡng nhảy tối đa cho 1 poll (60s) — biến động thật trong 60s không bao giờ vượt */
const MAX_JUMP: Record<string, number> = {
  Forex: 0.02,   // 2%
  Metals: 0.02,  // 2%
  Indices: 0.03, // 3%
  Crypto: 0.06, // 6%
};
/** Số poll liên tiếp đồng thuận để chấp nhận gap thật */
const CONFIRM_NEEDED = 3;
/** Dung sai đồng thuận giữa các poll */
const CONFIRM_TOL = 0.005;

function categoryOf(symbol: string): string {
  if (symbol === 'XAUUSD') return 'Metals';
  if (symbol === 'BTCUSD' || symbol === 'ETHUSD') return 'Crypto';
  if (symbol === 'US30') return 'Indices';
  return 'Forex';
}

interface Pending { price: number; count: number }
const pending = new Map<string, Pending>();

export interface RejectedTick { sym: string; old: number; bad: number; at: number; jumpPct: number }
const rejectedLog: RejectedTick[] = [];
let rejectedCount = 0;

export interface GuardResult {
  accept: boolean;
  /** Giá để dùng tiếp: giá mới nếu chấp nhận, giá cũ nếu từ chối */
  price: number;
  reason?: string;
}

export function guardQuote(symbol: string, newPrice: number, oldPrice: number): GuardResult {
  if (!(oldPrice > 0) || !(newPrice > 0) || !Number.isFinite(newPrice)) {
    return { accept: true, price: newPrice };
  }
  const maxJump = MAX_JUMP[categoryOf(symbol)] ?? 0.02;
  const jump = Math.abs(newPrice - oldPrice) / oldPrice;
  if (jump <= maxJump) {
    pending.delete(symbol);
    return { accept: true, price: newPrice };
  }
  // Vượt ngưỡng → cần xác nhận
  const p = pending.get(symbol);
  if (p && Math.abs(newPrice - p.price) / p.price < CONFIRM_TOL) {
    p.count += 1;
    if (p.count >= CONFIRM_NEEDED) {
      pending.delete(symbol);
      return { accept: true, price: newPrice, reason: `gap thật (${CONFIRM_NEEDED} poll xác nhận)` };
    }
    return { accept: false, price: oldPrice, reason: `chờ xác nhận gap (${p.count}/${CONFIRM_NEEDED})` };
  }
  pending.set(symbol, { price: newPrice, count: 1 });
  rejectedCount += 1;
  rejectedLog.push({ sym: symbol, old: oldPrice, bad: newPrice, at: Date.now(), jumpPct: jump * 100 });
  if (rejectedLog.length > 20) rejectedLog.shift();
  try {
    window.dispatchEvent(new CustomEvent('badtick', {
      detail: { sym: symbol, old: oldPrice, bad: newPrice, jumpPct: jump * 100 },
    }));
  } catch { /* noop */ }
  return { accept: false, price: oldPrice, reason: `nhảy ${ (jump * 100).toFixed(1)}% > ngưỡng ${(maxJump * 100).toFixed(0)}%` };
}

/** Thống kê cho panel chẩn đoán */
export function guardStats(): { rejected: number; log: RejectedTick[] } {
  return { rejected: rejectedCount, log: [...rejectedLog].reverse() };
}

/** Reset bộ đếm (khi user reset toàn bộ) */
export function resetGuardStats(): void {
  rejectedCount = 0;
  rejectedLog.length = 0;
  pending.clear();
}
