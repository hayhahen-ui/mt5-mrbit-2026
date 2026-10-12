/**
 * research/directionScore.ts — Chấm điểm định hướng theo Blueprint §9.2.
 *
 * - Mỗi nhóm chấm -2..+2 theo rule có phiên bản; dương = hỗ trợ TĂNG mã đang xét.
 * - direction_score = Σ(weight_i × group_score_i / 2) → miền -100..+100.
 * - coverage_pct = Σ weight của nhóm có dữ liệu (KHÔNG chuẩn hoá lại về 100%).
 * - Coverage < 70% → không phát thiên hướng tổng hợp.
 * - Cờ chặn (can thiệp, spread bất thường, sự kiện) là BLOCK, không cộng điểm.
 * - Không chuyển điểm thành xác suất thắng (§9.2, §13.4).
 */
import { FredSeries, FredSeriesId } from './fred';
import { EvidenceLabel } from '../../data/researchRegistry';

export interface GroupScore {
  id: string;
  label: string;
  weight: number;
  /** -2..+2, null = thiếu dữ liệu (không cộng, không coi trung tính) */
  score: number | null;
  evidence: EvidenceLabel;
  detail: string;
  sourceIds: string[];
}

export interface DirectionResult {
  symbol: string;
  directionScore: number | null; // -100..100, null khi coverage < 70
  coveragePct: number;
  bias: 'TĂNG' | 'GIẢM' | 'TRUNG TÍNH' | 'THIẾU DỮ LIỆU';
  groups: GroupScore[];
  blockers: string[];
  computedAt: number;
}

const GROUP_DEFS: Record<string, Array<{ id: string; label: string; weight: number }>> = {
  EURUSD: [
    { id: 'policy', label: 'Chính sách & vĩ mô tương đối', weight: 45 },
    { id: 'structure', label: 'Cấu trúc giá', weight: 30 },
    { id: 'positioning', label: 'Vị thế', weight: 10 },
    { id: 'cross', label: 'Xác nhận liên thị trường', weight: 15 },
  ],
  GBPUSD: [
    { id: 'policy', label: 'Chính sách & vĩ mô tương đối', weight: 45 },
    { id: 'structure', label: 'Cấu trúc giá', weight: 30 },
    { id: 'positioning', label: 'Vị thế', weight: 10 },
    { id: 'cross', label: 'Xác nhận liên thị trường', weight: 15 },
  ],
  USDJPY: [
    { id: 'policy', label: 'Chính sách & vĩ mô tương đối', weight: 45 },
    { id: 'structure', label: 'Cấu trúc giá', weight: 30 },
    { id: 'positioning', label: 'Vị thế', weight: 10 },
    { id: 'cross', label: 'Xác nhận liên thị trường', weight: 15 },
  ],
  XAUUSD: [
    { id: 'realyield', label: 'Lợi suất thực & USD', weight: 35 },
    { id: 'goldflows', label: 'Dòng vốn / cầu vàng', weight: 25 },
    { id: 'structure', label: 'Cấu trúc giá', weight: 30 },
    { id: 'positioning', label: 'Vị thế', weight: 10 },
  ],
};

/** Chấm -2..+2 từ độ thay đổi của một chuỗi so với ngưỡng */
function scoreFromChange(change: number | null, bullThreshold: number, bearThreshold: number, invert = false): number | null {
  if (change === null || !isFinite(change)) return null;
  let s = 0;
  if (change >= bullThreshold) s = 2;
  else if (change > 0) s = 1;
  else if (change <= bearThreshold) s = -2;
  else if (change < 0) s = -1;
  return invert ? -s : s;
}

export interface DirectionInputs {
  symbol: string; // EURUSD | GBPUSD | USDJPY | XAUUSD
  fred: Record<FredSeriesId, FredSeries>;
  /** Từ engine hiện tại: hướng & độ mạnh cấu trúc giá */
  priceDirection: 'BUY' | 'SELL' | 'FLAT';
  priceScore: number; // 0-100 từ engine
  /** Cờ chặn: can thiệp / spread bất thường / sự kiện */
  blockers?: string[];
  /** % long từ MyFxBook sentiment (proxy cho positioning khi chưa có COT) */
  sentimentLongPct?: number | null;
  /** Dòng vốn vàng thủ công (tấn, dương = vào) — nhập tay từ WGC */
  goldFlowTons?: number | null;
  /** Tín hiệu GLD proxy (-2..+2) — từ TwelveData */
  gldSignal?: number | null;
}

export function computeDirectionScore(inp: DirectionInputs): DirectionResult {
  const defs = GROUP_DEFS[inp.symbol] || GROUP_DEFS.EURUSD;
  const groups: GroupScore[] = [];
  const blockers = inp.blockers || [];

  const dgs2 = inp.fred.DGS2;
  const dgs10 = inp.fred.DGS10;
  const dfii10 = inp.fred.DFII10;
  const usw = inp.fred.DTWEXBGS;

  for (const def of defs) {
    switch (def.id) {
      case 'policy': {
        // Lợi suất Mỹ tăng → USD mạnh → giảm EUR/USD & GBP/USD, tăng USD/JPY
        const chg = dgs2.change;
        const invert = inp.symbol !== 'USDJPY'; // EUR/USD, GBP/USD: USD mạnh = giá giảm
        const s = scoreFromChange(chg, 0.08, -0.08, invert);
        groups.push({
          ...def,
          score: s,
          evidence: s === null ? 'UNVERIFIED' : 'FACT',
          detail: s === null
            ? 'Thiếu DGS2 — chưa nhập FRED key hoặc API lỗi'
            : `DGS2 ${dgs2.latest?.value?.toFixed(2)}% (${chg! >= 0 ? '+' : ''}${chg!.toFixed(2)}pp) — ${invert ? 'USD mạnh gây áp lực lên cặp' : 'hỗ trợ USD/JPY'}`,
          sourceIds: ['S17'],
        });
        break;
      }
      case 'realyield': {
        // DFII10 tăng → chi phí cơ hội vàng tăng → giảm XAU; USD mạnh → giảm XAU
        const ryChg = dfii10.change;
        const usdChg = usw.change;
        const ryScore = scoreFromChange(ryChg, 0.08, -0.08, true); // lợi suất thực tăng = xấu cho vàng
        const usdScore = scoreFromChange(usdChg, 0.3, -0.3, true); // USD tăng = xấu cho vàng
        const parts = [ryScore, usdScore].filter((x): x is number => x !== null);
        const s = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
        groups.push({
          ...def,
          score: s,
          evidence: s === null ? 'UNVERIFIED' : 'FACT',
          detail: s === null
            ? 'Thiếu DFII10/DTWEXBGS'
            : `Lợi suất thực ${dfii10.latest?.value?.toFixed(2)}% (${ryChg! >= 0 ? '+' : ''}${ryChg!.toFixed(2)}pp), USD index ${usw.latest?.value?.toFixed(1)}`,
          sourceIds: ['S19', 'S20'],
        });
        break;
      }
      case 'goldflows': {
        // Tầng 1: WGC nhập tay (tấn/tháng) — chính xác nhất
        // Tầng 2: GLD proxy (TwelveData) — tự động hàng ngày
        // Tầng 3: DGS10 proxy — fallback cuối
        const tons = inp.goldFlowTons;
        const gld = inp.gldSignal;
        let s: number | null = null;
        let detail = 'Chưa có dữ liệu — nhập WGC tay hoặc chờ GLD';
        let ev: 'FACT' | 'CALCULATION' | 'UNVERIFIED' = 'UNVERIFIED';
        if (tons !== null && tons !== undefined) {
          s = tons >= 20 ? 2 : tons >= 5 ? 1 : tons <= -20 ? -2 : tons <= -5 ? -1 : 0;
          detail = `WGC ETF flow: ${tons >= 0 ? '+' : ''}${tons} tấn/tháng (nhập tay)`;
          ev = 'FACT';
        } else if (gld !== null && gld !== undefined) {
          s = Math.max(-2, Math.min(2, Math.round(gld)));
          detail = `GLD proxy: tín hiệu ${s >= 0 ? '+' : ''}${s}/2 (volume + giá)`;
          ev = 'CALCULATION';
        } else {
          const d10Chg = dgs10.change;
          if (d10Chg !== null && d10Chg !== undefined) {
            s = scoreFromChange(d10Chg, -0.15, 0.15, false);
            detail = `Proxy DGS10 (${d10Chg >= 0 ? '+' : ''}${d10Chg.toFixed(2)}pp)`;
            ev = 'CALCULATION';
          }
        }
        groups.push({ ...def, score: s, evidence: ev, detail, sourceIds: ['S22', 'S13'] });
        break;
      }
      case 'structure': {
        // Từ engine kỹ thuật hiện tại
        let s: number | null = null;
        if (inp.priceDirection === 'BUY') s = inp.priceScore >= 65 ? 2 : 1;
        else if (inp.priceDirection === 'SELL') s = inp.priceScore >= 65 ? -2 : -1;
        else s = 0;
        groups.push({
          ...def, score: s, evidence: 'CALCULATION',
          detail: `Engine: ${inp.priceDirection} — điểm ${inp.priceScore}/100`,
          sourceIds: [],
        });
        break;
      }
      case 'positioning': {
        // Proxy: MyFxBook sentiment — đám đông quá lệch 1 phía = tín hiệu ngược (contrarian)
        const lp = inp.sentimentLongPct;
        let s: number | null = null;
        let detail = 'Chưa có COT tự động — đọc tay tại cftc.gov (chốt T3, công bố T6)';
        if (lp !== null && lp !== undefined) {
          // >75% long = quá mua đám đông → -1 (ngược); <25% long = quá bán → +1
          s = lp >= 75 ? -1 : lp <= 25 ? 1 : 0;
          detail = `MyFxBook: ${lp.toFixed(0)}% long (contrarian)`;
        }
        groups.push({
          ...def, score: s, evidence: s === null ? 'UNVERIFIED' : 'CALCULATION',
          detail, sourceIds: ['S13'],
        });
        break;
      }
      case 'cross': {
        // USD index xác nhận: USD mạnh → giảm EUR/USD, GBP/USD; tăng USD/JPY
        const chg = usw.change;
        const invert = inp.symbol !== 'USDJPY';
        const s = scoreFromChange(chg, 0.4, -0.4, invert);
        groups.push({
          ...def,
          score: s,
          evidence: s === null ? 'UNVERIFIED' : 'FACT',
          detail: s === null ? 'Thiếu DTWEXBGS' : `USD Broad ${usw.latest?.value?.toFixed(1)} (${chg! >= 0 ? '+' : ''}${chg!.toFixed(2)})`,
          sourceIds: ['S20'],
        });
        break;
      }
      default:
        groups.push({ ...def, score: null, evidence: 'UNVERIFIED', detail: 'Chưa định nghĩa rule', sourceIds: [] });
    }
  }

  // coverage = Σ weight nhóm có dữ liệu (không chuẩn hoá lại)
  const coveragePct = groups.reduce((sum, g) => sum + (g.score !== null ? g.weight : 0), 0);
  let directionScore: number | null = null;
  if (coveragePct >= 70 && blockers.length === 0) {
    directionScore = Math.round(groups.reduce((sum, g) => sum + (g.score !== null ? g.weight * g.score / 2 : 0), 0));
  }

  let bias: DirectionResult['bias'] = 'THIẾU DỮ LIỆU';
  if (directionScore !== null) {
    bias = directionScore >= 20 ? 'TĂNG' : directionScore <= -20 ? 'GIẢM' : 'TRUNG TÍNH';
  } else if (blockers.length > 0) {
    bias = 'TRUNG TÍNH'; // bị chặn → đứng ngoài, không phát thiên hướng
  }

  return { symbol: inp.symbol, directionScore, coveragePct, bias, groups, blockers, computedAt: Date.now() };
}

/**
 * Tính điểm VĨ MÔ THUẦN cho engine (loại trừ nhóm 'structure' kỹ thuật).
 * Dùng prelimDirection từ engine để tránh phụ thuộc vòng tròn signal.
 */
export function computeMacroOnly(inp: DirectionInputs): { score: number | null; coveragePct: number } {
  const r = computeDirectionScore({ ...inp, priceDirection: 'FLAT', priceScore: 50 });
  // Loại trừ nhóm structure khỏi coverage và score
  const macroGroups = r.groups.filter((g) => g.id !== 'structure');
  const coveragePct = macroGroups.reduce((sum, g) => sum + (g.score !== null ? g.weight : 0), 0);
  // Tính lại score chỉ từ nhóm macro (chuẩn hoá theo tổng weight macro)
  const totalW = macroGroups.reduce((sum, g) => sum + g.weight, 0);
  let score: number | null = null;
  if (coveragePct >= 70) {
    score = Math.round(macroGroups.reduce((sum, g) => sum + (g.score !== null ? g.weight * g.score / 2 : 0), 0) * (100 / totalW));
  }
  return { score, coveragePct };
}

/** Mô tả ngắn cho badge RADAR */
export function directionBadge(r: DirectionResult): string {
  if (r.blockers.length > 0) return '⛔ BỊ CHẶN';
  if (r.directionScore === null) return `📊 THIẾU DL (${r.coveragePct}%)`;
  const arrow = r.directionScore > 0 ? '▲' : r.directionScore < 0 ? '▼' : '●';
  return `${arrow} ${r.directionScore > 0 ? '+' : ''}${r.directionScore}`;
}
