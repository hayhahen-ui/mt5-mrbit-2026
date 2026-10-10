/**
 * engines.ts — Trạng thái bật/tắt 3 signal engines (dùng chung giữa UI tab SIG và engine chấm điểm).
 * Lưu localStorage để giữ sau F5. Engine bị tắt → evaluateSignal chặn tín hiệu loại đó.
 */
export type EngineId = 'SMC' | 'TREND' | 'MEAN_REV';

export const ENGINE_IDS: EngineId[] = ['SMC', 'TREND', 'MEAN_REV'];

export const ENGINE_NAMES: Record<EngineId, string> = {
  SMC: 'SMC ICT Alpha',
  TREND: 'Trend Ribbon Pro',
  MEAN_REV: 'Mean Reversion Sweep',
};

export const ENGINE_TAGS: Record<EngineId, string> = {
  SMC: 'SMART MONEY',
  TREND: 'MOMENTUM',
  MEAN_REV: 'REVERSAL',
};

export const ENGINE_DESC: Record<EngineId, string> = {
  SMC: 'Phát hiện Order Block (OB), Fair Value Gap (FVG), Phá vỡ cấu trúc đỉnh đáy (BOS/CHoCH) và Liquidity Sweep.',
  TREND: 'Theo dõi dải đường trung bình động EMA 21, 50, 200 kết hợp bộ lọc biến động ATR để bắt nhịp sóng hồi Pullback.',
  MEAN_REV: 'Bắt tín hiệu quét đỉnh/đáy phiên Á ngoài dải Bollinger Bands kết hợp phân kỳ RSI 14 cực đoan.',
};

const KEY = 'nexuspilot-engines-v1';

export function getEngineToggles(): Record<EngineId, boolean> {
  const def = { SMC: true, TREND: true, MEAN_REV: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const o = JSON.parse(raw);
    return {
      SMC: o.SMC !== false,
      TREND: o.TREND !== false,
      MEAN_REV: o.MEAN_REV !== false,
    };
  } catch {
    return def;
  }
}

export function setEngineToggle(id: EngineId, on: boolean): Record<EngineId, boolean> {
  const cur = getEngineToggles();
  cur[id] = on;
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch { /* noop */ }
  return cur;
}
