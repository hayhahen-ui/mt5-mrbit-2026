import { FeatureDefinition, FeatureSet, FEATURE_VERSION } from './contracts';

/**
 * neural/features.ts — Feature registry + builder.
 * Chỉ bật feature đã có định nghĩa kiểm chứng được trong code (skill §7).
 * Chống nhìn trước: mọi giá trị tính từ dữ liệu đã khả dụng tại as_of.
 */

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  { id: 'trend_ema20', label: 'Xu hướng EMA20', description: '(giá − EMA20)/EMA20 × 100, % — dương = trên EMA', required: true },
  { id: 'momentum_roc10', label: 'Động lượng ROC10', description: 'Rate of change % trên 10 mẫu giá đã đóng', required: true },
  { id: 'volatility_stdev20', label: 'Biến động', description: 'Độ lệch chuẩn % trên 20 mẫu (proxy ATR)', required: true },
  { id: 'rsi14', label: 'RSI14', description: 'RSI 14 kỳ trên giá đã biết', required: true },
  { id: 'session_code', label: 'Mã phiên', description: '0=nghỉ, 2=Á/Úc, 3=London/NewYork, 4=giao thoa', required: false },
  { id: 'news_blocked', label: 'Cờ chặn tin', description: '1 = có tin HIGH trong cửa sổ ±30 phút', required: false },
  { id: 'spread_ok', label: 'Spread đạt', description: '1 = spread trong ngưỡng cho phép', required: false },
  { id: 'change24h', label: 'Biến động 24h', description: '% thay đổi 24h từ nguồn giá (null nếu nguồn không có)', required: false },
];

export interface RawFeatureInputs {
  price: number;
  ema20: number;
  roc10: number;
  stdev20: number;
  rsi14: number;
  session: string;
  newsBlocked: boolean;
  spreadOk: boolean;
  change24h: number | null;
  historyReady: boolean;
}

function encodeSession(session: string): number {
  const hasLondon = session.includes('London');
  const hasNY = session.includes('New York');
  if (hasLondon && hasNY) return 4;
  if (hasLondon || hasNY) return 3;
  if (session.includes('Tokyo') || session.includes('Sydney')) return 2;
  return 0;
}

function finiteOrNull(v: number, reason: string, missing: Record<string, string>, id: string): number | null {
  if (typeof v !== 'number' || !isFinite(v)) {
    missing[id] = reason;
    return null;
  }
  return v;
}

/** Xây feature đúng cutoff; báo thiếu dữ liệu thay vì bịa số */
export function buildFeatures(input: RawFeatureInputs): FeatureSet {
  const missing: Record<string, string> = {};
  const qualityFlags: string[] = [];

  if (!input.historyReady) {
    missing['trend_ema20'] = 'history_not_ready';
    missing['momentum_roc10'] = 'history_not_ready';
    missing['volatility_stdev20'] = 'history_not_ready';
    missing['rsi14'] = 'history_not_ready';
    qualityFlags.push('insufficient_history');
  }

  const values: Record<string, number | null> = {
    trend_ema20:
      input.historyReady && input.ema20 > 0
        ? finiteOrNull(((input.price - input.ema20) / input.ema20) * 100, 'invalid_ema', missing, 'trend_ema20')
        : (missing['trend_ema20'] ??= 'history_not_ready', null),
    momentum_roc10: input.historyReady
      ? finiteOrNull(input.roc10, 'invalid_roc', missing, 'momentum_roc10')
      : (missing['momentum_roc10'] ??= 'history_not_ready', null),
    volatility_stdev20: input.historyReady
      ? finiteOrNull(input.stdev20, 'invalid_vol', missing, 'volatility_stdev20')
      : (missing['volatility_stdev20'] ??= 'history_not_ready', null),
    rsi14: input.historyReady
      ? finiteOrNull(input.rsi14, 'invalid_rsi', missing, 'rsi14')
      : (missing['rsi14'] ??= 'history_not_ready', null),
    session_code: encodeSession(input.session),
    news_blocked: input.newsBlocked ? 1 : 0,
    spread_ok: input.spreadOk ? 1 : 0,
    change24h: input.change24h === null ? (missing['change24h'] = 'source_no_change24h', null) : input.change24h,
  };

  if (input.newsBlocked) qualityFlags.push('news_window_block');
  if (!input.spreadOk) qualityFlags.push('spread_exceeded');

  return { version: FEATURE_VERSION, values, missing, qualityFlags };
}

/** true nếu thiếu feature bắt buộc → assessment insufficient_data */
export function hasMissingRequired(fs: FeatureSet): boolean {
  const requiredIds = FEATURE_REGISTRY.filter((f) => f.required).map((f) => f.id);
  return requiredIds.some((id) => fs.values[id] === null || fs.values[id] === undefined);
}
