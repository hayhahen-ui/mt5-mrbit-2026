/**
 * reset.ts — Reset toàn bộ dữ liệu cục bộ để bắt đầu ghi thật từ thời điểm reset.
 * Xóa: sổ tín hiệu (journal), nhật ký Kaizen, bản ghi Neural shadow.
 * Giữ: cài đặt chế độ neural (shadow on/off).
 */

export const RESET_KEYS = [
  'nexuspilot-journal-v1',
  'nexuspilot-kaizen-v1',
  'nexuspilot-neural-v1',
] as const;

export function resetAllLocalData(): void {
  for (const k of RESET_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* bỏ qua */
    }
  }
}

/** Dấu mốc reset — để UI hiển thị "thống kê từ HH:MM DD/MM" */
export const RESET_MARK_KEY = 'nexuspilot-reset-mark-v1';

export function markResetTime(): number {
  const t = Date.now();
  try {
    localStorage.setItem(RESET_MARK_KEY, String(t));
  } catch {
    /* bỏ qua */
  }
  return t;
}

export function getResetMark(): number | null {
  try {
    const v = localStorage.getItem(RESET_MARK_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
