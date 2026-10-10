/**
 * positions.ts — Lưu/tải vị thế đang mở xuống localStorage.
 * F5 lại trang không mất lệnh: giá/pnl tính lại ở tick tiếp theo,
 * cấu hình auto-close (TP/SL/time-stop) được giữ nguyên nên bot vẫn làm việc.
 */
import { Position, AutoCloseConfig } from '../types';

export const POSITIONS_KEY = 'nexuspilot-positions-v1';

export const DEFAULT_AUTO_CLOSE: AutoCloseConfig = {
  mode: 'AUTO',
  tp: true,
  sl: true,
  timeStopMin: null,
};

/** Đọc vị thế đã lưu — lọc bản ghi hỏng, reset giá trị live về mặc định an toàn */
export function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p.id === 'string' && typeof p.symbol === 'string' && p.entryPrice > 0 && p.lot > 0)
      .map((p) => ({
        ...p,
        currentPrice: p.entryPrice, // tính lại ở tick giá tiếp theo
        pnl: 0,
        pips: 0,
        openedAt: typeof p.openedAt === 'number' ? p.openedAt : Date.now(),
        autoClose: p.autoClose && typeof p.autoClose === 'object'
          ? { ...DEFAULT_AUTO_CLOSE, ...p.autoClose }
          : { ...DEFAULT_AUTO_CLOSE },
      })) as Position[];
  } catch {
    return [];
  }
}

/** Lưu vị thế đang mở */
export function savePositions(positions: Position[]): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn — bỏ qua im lặng */
  }
}

/** Xóa vị thế đã lưu */
export function clearPositions(): void {
  try {
    localStorage.removeItem(POSITIONS_KEY);
  } catch {
    /* noop */
  }
}
