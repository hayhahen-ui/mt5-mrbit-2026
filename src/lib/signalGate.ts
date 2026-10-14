/**
 * signalGate.ts — Tầng 6 vòng Kaizen khép kín: CỔNG RADAR (Phase C).
 *
 * Mỗi tín hiệu trước khi hiển thị lên RADAR phải qua cổng:
 *  1. Luật CHẶN (knowledge effect='block', đang active, khớp điều kiện) → BỊ CHẶN + lý do.
 *  2. Luật CẢNH BÁO (effect='warn') → đi qua nhưng gắn cảnh báo.
 *  3. Luật NGHIÊN CỨU (effect='research') → cổng bỏ qua (chỉ để theo dõi trong kho).
 *  4. Điểm NN (nếu có) → đính kèm thông tin, chưa dùng để chặn (NN còn yếu — Phase B).
 *
 * Logic thuần → test được. Không tự sinh luật — chỉ áp luật user đã duyệt.
 */

import type { KnowledgeEntry } from './knowledge';
import { entryMatches } from './knowledge';

export interface GateContext {
  symbol: string;
  direction: 'BUY' | 'SELL';
  verdict?: string;
  score?: number;
  session?: string; // 'Sydney' | 'Tokyo' | 'London' | 'New York' ...
  newsHigh?: boolean; // có tin HIGH trong ±60'
  hour?: number; // giờ VN 0-23
}

export interface GateResult {
  pass: boolean; // true = qua cổng, hiển thị bình thường
  blocked: boolean; // true = bị luật chặn
  reasons: string[]; // luật chặn đã khớp (rule text)
  warnings: string[]; // luật cảnh báo đã khớp (rule text)
  nnScore?: number; // điểm NN nếu có (0-100)
  evaluatedAt: number;
}

/**
 * Chạy cổng kiểm duyệt cho 1 tín hiệu.
 * - Chỉ luật active mới có hiệu lực; luật inactive bị bỏ qua hoàn toàn.
 * - Luật 'block' khớp → chặn. Luật 'warn' khớp → cảnh báo. 'research' → bỏ qua.
 */
export function gateSignal(
  ctx: GateContext,
  knowledge: KnowledgeEntry[],
  nnScore?: number
): GateResult {
  const flat: Record<string, unknown> = {
    symbol: ctx.symbol,
    direction: ctx.direction,
    verdict: ctx.verdict,
    score: ctx.score,
    session: ctx.session,
    newsHigh: ctx.newsHigh,
    hour: ctx.hour,
  };
  const reasons: string[] = [];
  const warnings: string[] = [];

  for (const k of knowledge) {
    if (!k.active) continue;
    if (k.effect === 'research') continue; // nghiên cứu → cổng không áp
    if (!entryMatches(k, flat)) continue;
    if (k.effect === 'block') reasons.push(k.rule);
    else if (k.effect === 'warn') warnings.push(k.rule);
  }

  const blocked = reasons.length > 0;
  return {
    pass: !blocked,
    blocked,
    reasons,
    warnings,
    nnScore: typeof nnScore === 'number' ? nnScore : undefined,
    evaluatedAt: Date.now(),
  };
}

/** Đếm luật chặn đang hiệu lực — dùng cho node giám sát DÒNG CHẢY. */
export function countBlockRules(knowledge: KnowledgeEntry[]): number {
  return knowledge.filter((k) => k.active && k.effect === 'block').length;
}
