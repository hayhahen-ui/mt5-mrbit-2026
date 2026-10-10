import { NewsEvent, ScoreFactor, SignalVerdict } from '../types';
import { currenciesForSymbol } from './symbolNews';

export interface NewsFilterResult {
  blocked: boolean;
  reason: string;
  events: NewsEvent[];
}

/**
 * Bộ lọc tin tức (Trade.2026-style): chặn/cảnh báo tín hiệu khi có tin
 * HIGH impact của đồng tiền liên quan đang trong cửa sổ tin.
 */
export function checkNewsFilter(symbol: string, newsEvents: NewsEvent[]): NewsFilterResult {
  const currencies = currenciesForSymbol(symbol);
  const hits = newsEvents.filter(
    (n) => n.impact === 'HIGH' && n.inWindow && currencies.includes(n.currency)
  );
  if (hits.length === 0) {
    return { blocked: false, reason: 'Không có tin HIGH trong cửa sổ tin tức', events: [] };
  }
  const titles = hits.map((h) => `${h.currency} ${h.title} (${h.time})`).join('; ');
  return {
    blocked: true,
    reason: `BỊ CHẶN bởi tin HIGH: ${titles}`,
    events: hits,
  };
}

/** Tổng điểm từ các yếu tố chấm điểm */
export function totalScore(factors: ScoreFactor[] | undefined): number {
  if (!factors || factors.length === 0) return 0;
  return factors.reduce((acc, f) => acc + f.points, 0);
}

/** Điểm tối đa có thể đạt */
export function maxScore(factors: ScoreFactor[] | undefined): number {
  if (!factors || factors.length === 0) return 100;
  return factors.reduce((acc, f) => acc + f.maxPoints, 0);
}

/**
 * Verdict theo thang điểm 100 (đồng bộ với chuẩn Trade.2026):
 * ≥80 MẠNH · 65–79 TRUNG BÌNH · 50–64 YẾU · <50 BỎ QUA
 */
export function getVerdict(score: number): SignalVerdict {
  if (score >= 80) return 'MANH';
  if (score >= 65) return 'TRUNG_BINH';
  if (score >= 50) return 'YEU';
  return 'BO_QUA';
}

export const VERDICT_META: Record<SignalVerdict, { label: string; color: string; bg: string; border: string }> = {
  MANH: { label: 'MẠNH — VÀO LỆNH', color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800' },
  TRUNG_BINH: { label: 'TRUNG BÌNH — CÂN NHẮC', color: 'text-sky-400', bg: 'bg-sky-950/60', border: 'border-sky-800' },
  YEU: { label: 'YẾU — ĐỨNG NGOÀI', color: 'text-amber-400', bg: 'bg-amber-950/60', border: 'border-amber-800' },
  BO_QUA: { label: 'BỎ QUA', color: 'text-rose-400', bg: 'bg-rose-950/60', border: 'border-rose-800' },
};
