/**
 * kaizenEngine.ts — Tầng 3 vòng Kaizen khép kín: sinh FINDING từ gap dữ liệu thật.
 *
 * Input: thống kê hệ thống (từ journal/kaizen analysis) + thống kê benchmark.
 * Output: finding có cấu trúc {vùng, chỉ số, bằng chứng số, giả thuyết, hành động, mức độ}.
 *
 * Nguyên tắc:
 * - Chỉ kết luận khi đủ cỡ mẫu (ngưỡng MIN_*). Thiếu → không sinh finding, không bịa.
 * - Finding là ĐỀ XUẤT mặc định; chỉ thành LUẬT CỨNG khi user duyệt tay.
 * - Logic thuần (không chạm localStorage) → test được 100%.
 */

export type FindingSeverity = 'cao' | 'trung-binh' | 'thap';
export type FindingKind = 'luat-cung' | 'de-xuat';
export type FindingStatus = 'moi' | 'dang-theo-doi' | 'da-kiem-chung' | 'da-bac-bo';

export interface KaizenFinding {
  id: string;
  area: 'phien' | 'benchmark' | 'factor' | 'verdict' | 'drawdown' | 'symbol';
  metric: string; // 'win-rate' | 'avg-r' | 'profit-factor' | 'max-dd' | ...
  title: string;
  evidence: string; // bằng chứng số, tiếng Việt
  hypothesis: string; // giả thuyết nguyên nhân
  action: string; // hành động đề xuất
  severity: FindingSeverity;
  kind: FindingKind; // mặc định 'de-xuat'; user duyệt tay mới thành 'luat-cung'
  status: FindingStatus;
  sampleSize: number;
  createdAt: number;
}

/** Thống kê rút gọn dùng cho engine (tương thích BenchmarkStats + KaizenAnalysis). */
export interface StatsLike {
  total: number;
  winRate: number; // %
  avgR: number;
  profitFactor: number; // 0 = không tính được
  maxDrawdownR: number;
  hasR: boolean;
}

export interface EngineInput {
  system: {
    stats: StatsLike;
    bySession?: { session: string; closed: number; winRate: number; avgR: number }[];
    factors?: {
      factorId: string;
      label: string;
      closedWithPass: number;
      winRateWhenPassed: number;
      avgRWhenPassed: number;
    }[];
    verdicts?: { verdict: string; closed: number; winRate: number; avgR: number }[];
    bySymbol?: Record<string, StatsLike>;
  };
  benchmarks: { name: string; stats: StatsLike }[];
}

/* Ngưỡng — mọi kết luận dưới ngưỡng mẫu đều bị chặn, không bịa. */
export const KAIZEN_MIN_TRADES = 10; // cỡ mẫu tối thiểu cho kết luận nội bộ
export const KAIZEN_MIN_BENCH_TRADES = 20; // cỡ mẫu tối thiểu mỗi bên khi so benchmark
export const KAIZEN_WR_GAP = 10; // chênh win rate (% điểm) đáng kể
export const KAIZEN_PF_GAP = 0.5; // chênh profit factor đáng kể
export const KAIZEN_WEAK_SESSION_WR = 35; // phiên yếu: win rate dưới mức này
export const KAIZEN_WEAK_FACTOR_WR = 40; // factor nhiễu: win rate khi đạt dưới mức này
export const KAIZEN_DEEP_DD_R = 8; // drawdown sâu (R)

let findingSeq = 0;
function newId(prefix: string): string {
  findingSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${findingSeq}`;
}

function base(area: KaizenFinding['area'], metric: string, sampleSize: number): Omit<KaizenFinding, 'title' | 'evidence' | 'hypothesis' | 'action' | 'severity'> {
  return {
    id: newId('KF'),
    area,
    metric,
    kind: 'de-xuat',
    status: 'moi',
    sampleSize,
    createdAt: Date.now(),
  };
}

const fmtPct = (n: number) => `${Number(n.toFixed(1))}%`;
const fmtR = (n: number) => `${n >= 0 ? '+' : ''}${Number(n.toFixed(2))}R`;

/**
 * Sinh findings từ dữ liệu thật. Trả về mảng rỗng (không phải lỗi) khi chưa đủ dữ liệu.
 */
export function generateFindings(input: EngineInput): KaizenFinding[] {
  const out: KaizenFinding[] = [];
  const { system, benchmarks } = input;
  const sys = system.stats;

  // R1 — Benchmark vượt hệ thống về win rate (đủ mẫu cả hai bên)
  for (const b of benchmarks) {
    const bs = b.stats;
    if (
      sys.total >= KAIZEN_MIN_BENCH_TRADES &&
      bs.total >= KAIZEN_MIN_BENCH_TRADES &&
      bs.winRate - sys.winRate >= KAIZEN_WR_GAP
    ) {
      const gap = bs.winRate - sys.winRate;
      out.push({
        ...base('benchmark', 'win-rate', Math.min(sys.total, bs.total)),
        title: `${b.name} thắng nhiều hơn hệ thống ${fmtPct(gap)}`,
        evidence: `Benchmark ${b.name}: win rate ${fmtPct(bs.winRate)} trên ${bs.total} lệnh; hệ thống: ${fmtPct(sys.winRate)} trên ${sys.total} lệnh.`,
        hypothesis: 'Benchmark có bộ lọc vào lệnh hoặc quản lý lệnh tốt hơn ở cùng điều kiện thị trường.',
        action: `Mổ xẻ ${b.name}: so sánh điểm vào, khung giờ và mã giao dịch với hệ thống để rút ra 1-2 quy tắc cụ thể.`,
        severity: gap >= 20 ? 'cao' : 'trung-binh',
      });
    }
    // R1b — Benchmark vượt về profit factor
    if (
      sys.hasR && bs.hasR &&
      sys.total >= KAIZEN_MIN_BENCH_TRADES &&
      bs.total >= KAIZEN_MIN_BENCH_TRADES &&
      bs.profitFactor - sys.profitFactor >= KAIZEN_PF_GAP
    ) {
      const gap = bs.profitFactor - sys.profitFactor;
      out.push({
        ...base('benchmark', 'profit-factor', Math.min(sys.total, bs.total)),
        title: `Profit factor của ${b.name} cao hơn ${gap.toFixed(2)}`,
        evidence: `${b.name}: PF ${bs.profitFactor.toFixed(2)}; hệ thống: PF ${sys.profitFactor.toFixed(2)}.`,
        hypothesis: 'Benchmark giữ lệnh thắng lâu hơn hoặc cắt lỗ kỷ luật hơn.',
        action: 'So sánh avg R khi thắng và avg R khi thua giữa hai bên để xác định lệch ở đầu nào.',
        severity: gap >= 1 ? 'cao' : 'trung-binh',
      });
    }
  }

  // R2 — Phiên yếu (đủ mẫu)
  for (const s of system.bySession || []) {
    if (s.closed >= KAIZEN_MIN_TRADES && s.winRate < KAIZEN_WEAK_SESSION_WR) {
      out.push({
        ...base('phien', 'win-rate', s.closed),
        title: `Phiên ${s.session}: win rate chỉ ${fmtPct(s.winRate)}`,
        evidence: `Phiên ${s.session}: ${s.closed} lệnh đã đóng, win rate ${fmtPct(s.winRate)}, avg ${fmtR(s.avgR)}.`,
        hypothesis: 'Biến động phiên này không hợp với đặc tính tín hiệu hiện tại (spread giãn, tin, thanh khoản mỏng).',
        action: `Cân nhắc tắt tín hiệu phiên ${s.session} 2 tuần rồi đo lại, hoặc giảm size một nửa ở phiên này.`,
        severity: s.winRate < 25 ? 'cao' : 'trung-binh',
      });
    }
  }

  // R3 — Factor nhiễu: khi đạt mà win rate vẫn thấp
  for (const f of system.factors || []) {
    if (f.closedWithPass >= KAIZEN_MIN_TRADES && f.winRateWhenPassed < KAIZEN_WEAK_FACTOR_WR) {
      out.push({
        ...base('factor', 'win-rate', f.closedWithPass),
        title: `Yếu tố "${f.label}" không phân biệt được thắng/thua`,
        evidence: `Khi yếu tố đạt: ${f.closedWithPass} lệnh đóng, win rate ${fmtPct(f.winRateWhenPassed)}, avg ${fmtR(f.avgRWhenPassed)}.`,
        hypothesis: 'Yếu tố này đã lỗi thời hoặc trùng lặp thông tin với yếu tố khác — cho điểm mà không lọc được nhiễu.',
        action: `Thử bỏ/chỉnh trọng số yếu tố "${f.label}" trên bản backtest rồi so sánh lại win rate.`,
        severity: f.winRateWhenPassed < 30 ? 'cao' : 'trung-binh',
      });
    }
  }

  // R4 — Verdict MẠNH nhưng avg R không dương
  for (const v of system.verdicts || []) {
    if (
      v.verdict === 'MẠNH' &&
      v.closed >= KAIZEN_MIN_TRADES &&
      v.avgR <= 0
    ) {
      out.push({
        ...base('verdict', 'avg-r', v.closed),
        title: 'Tín hiệu verdict MẠNH đang cho avg R không dương',
        evidence: `Verdict MẠNH: ${v.closed} lệnh đóng, win rate ${fmtPct(v.winRate)}, avg ${fmtR(v.avgR)}.`,
        hypothesis: 'Ngưỡng điểm verdict MẠNH đang quá thấp hoặc một yếu tố cho điểm ảo.',
        action: 'Nâng ngưỡng MẠNH lên 5 điểm trong 2 tuần và đo lại, hoặc rà soát yếu tố cho điểm cao nhất.',
        severity: 'cao',
      });
    }
  }

  // R5 — Drawdown sâu
  if (sys.hasR && sys.total >= KAIZEN_MIN_TRADES && sys.maxDrawdownR >= KAIZEN_DEEP_DD_R) {
    out.push({
      ...base('drawdown', 'max-dd', sys.total),
      title: `Max drawdown sâu ${fmtR(sys.maxDrawdownR)}`,
      evidence: `Max drawdown ${fmtR(sys.maxDrawdownR)} trên ${sys.total} lệnh.`,
      hypothesis: 'Thiếu cơ chế ngắt khi chuỗi thua — hệ thống gỡ gạc bằng cách vào lệnh tiếp trong điều kiện xấu.',
      action: 'Áp dụng daily loss limit cứng và nghỉ 24h sau 3 lệnh thua liên tiếp, rồi đo lại drawdown.',
      severity: sys.maxDrawdownR >= 12 ? 'cao' : 'trung-binh',
    });
  }

  // R6 — Mã giao dịch yếu so với mặt bằng hệ thống
  if (system.bySymbol) {
    for (const [symbol, st] of Object.entries(system.bySymbol)) {
      if (
        st.total >= KAIZEN_MIN_TRADES &&
        sys.winRate - st.winRate >= KAIZEN_WR_GAP &&
        st.winRate < KAIZEN_WEAK_SESSION_WR
      ) {
        out.push({
          ...base('symbol', 'win-rate', st.total),
          title: `${symbol} kéo tụt hệ thống: win rate ${fmtPct(st.winRate)}`,
          evidence: `${symbol}: ${st.total} lệnh, win rate ${fmtPct(st.winRate)}; toàn hệ thống: ${fmtPct(sys.winRate)}.`,
          hypothesis: `Đặc tính ${symbol} (spread, biến động, giờ tin) không hợp tín hiệu hiện tại.`,
          action: `Tạm dừng ${symbol} 2 tuần hoặc viết filter riêng cho mã này rồi đo lại.`,
          severity: 'trung-binh',
        });
      }
    }
  }

  return out;
}
