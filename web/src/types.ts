export type TabType = 'FLIGHT' | 'CTX' | 'SIG' | 'RADAR' | 'NEWS' | 'LOG' | 'CHART' | 'HELP';

export type SignalDirection = 'BUY' | 'SELL' | 'FLAT';
export type QualityGrade = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5';
export type EngineId = 'SMC' | 'TREND' | 'MEAN_REV';
export type SignalVerdict = 'MANH' | 'TRUNG_BINH' | 'YEU' | 'BO_QUA';

/** Chi tiết chấm điểm từng yếu tố — minh bạch như Trade.2026 */
export interface ScoreFactor {
  id: string;          // 'cau_truc' | 'nen' | 'ob_fvg' | 'phien' | 'rr' | 'spread' | 'news'
  label: string;       // 'Cấu trúc BOS/CHoCH'
  points: number;      // điểm đạt được
  maxPoints: number;   // điểm tối đa của yếu tố
  passed: boolean;
  detail: string;      // diễn giải ngắn
}

/** Bản ghi sổ tín hiệu — kết quả thật của từng lệnh đã đóng */
export type JournalOutcome = 'TP' | 'SL' | 'BE' | 'MANUAL';

export interface JournalEntry {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  engine: EngineId;
  engineName: string;
  tier: 'TP1' | 'TP2' | 'TP3' | 'SINGLE';
  lot: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  score: number;
  quality: QualityGrade;
  openTime: string;   // ISO
  closeTime: string;  // ISO
  outcome: JournalOutcome;
  exitPrice: number;
  rMultiple: number;  // số R đạt được (âm khi thua)
  pips: number;
  note?: string;
  /** Bối cảnh thị trường + tin tức lúc vào lệnh — phục vụ phân tích Kaizen */
  marketSnapshot?: MarketSnapshot;
  /** Liên kết tới bản ghi đánh giá tín hiệu trong nhật ký Kaizen */
  kaizenId?: string;
}

/** Ảnh chụp bối cảnh lúc tín hiệu được đánh giá / lệnh được mở */
export interface MarketSnapshot {
  price: number;
  change24h: number;
  atrProxy: number;      // độ biến động (độ lệch chuẩn giá gần nhất, %)
  roc: number;           // momentum % trên cửa sổ quan sát
  session: string;       // phiên đang mở: 'London', 'New York', ...
  newsNear: string[];    // tin HIGH trong ±60' (tiêu đề ngắn)
  dataSource: DataSource;
  warmup: string;        // vd '20/20' — số mẫu đã thu thập
}

/** Nguồn dữ liệu của một báo giá */
export type DataSource = 'LIVE' | 'DAILY' | 'SIM' | 'OFFLINE';

/** Một báo giá realtime kèm nguồn */
export interface Quote {
  symbol: string;
  price: number;
  change24h: number;
  source: DataSource;
  sourceName: string;    // 'Gold-API', 'Kraken', 'ER-API', 'Mô phỏng'
  updatedAt: number;     // epoch ms
}

/** Bản ghi nhật ký Kaizen — mỗi lần engine đánh giá tín hiệu */
export interface KaizenRecord {
  id: string;
  ts: number;                 // epoch ms lúc đánh giá
  time: string;               // ISO
  symbol: string;
  direction: SignalDirection;
  engine: EngineId;
  engineName: string;
  score: number;
  verdict: SignalVerdict;
  quality: QualityGrade;
  factors: { id: string; label: string; points: number; maxPoints: number; passed: boolean }[];
  snapshot: MarketSnapshot;
  newsBlocked: boolean;
  /** Điền sau khi lệnh từ tín hiệu này đóng sổ */
  outcome?: JournalOutcome;
  rMultiple?: number;
}

/** Kết quả phân tích Kaizen: yếu tố nào đang hiệu quả */
export interface FactorEffectiveness {
  factorId: string;
  label: string;
  evaluated: number;      // số tín hiệu đã đánh giá có yếu tố này
  passed: number;         // số lần đạt
  closedWithPass: number; // số lệnh đã đóng mà yếu tố đạt
  winRateWhenPassed: number; // % thắng khi yếu tố đạt
  avgRWhenPassed: number;
}

export interface KaizenAnalysis {
  totalEvaluated: number;
  totalClosed: number;
  byEngine: { engine: string; evaluated: number; closed: number; winRate: number; avgR: number }[];
  byVerdict: { verdict: SignalVerdict; evaluated: number; closed: number; winRate: number; avgR: number }[];
  bySession: { session: string; evaluated: number; closed: number; winRate: number; avgR: number }[];
  factors: FactorEffectiveness[];
}

export interface JournalStats {
  total: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;      // %
  totalR: number;
  avgR: number;
  profitFactor: number; // tổng R thắng / |tổng R thua|
  totalPips: number;
}

export interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: SignalDirection;
  engine: EngineId;
  engineName: string;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp1Odds: number;
  tp2Odds: number;
  tp3Odds: number;
  quality: QualityGrade;
  pWin: number;
  pipsSL: number;
  pipsTP1: number;
  pipsTP2: number;
  pipsTP3: number;
  suggestedLot: number;
  rationale: string;
  isHeadsUp: boolean;
  timestamp: string;
  /** Chi tiết chấm điểm minh bạch (Trade.2026-style). Nếu thiếu, UI tự suy từ quality. */
  scoreBreakdown?: ScoreFactor[];
  verdict?: SignalVerdict;
}

export interface Asset {
  symbol: string;
  name: string;
  category: 'Forex' | 'Metals' | 'Crypto' | 'Indices';
  price: number;
  change24h: number;
  spread: number;
  trendH1: 'BULL' | 'BEAR' | 'FLAT';
  signalDir: SignalDirection;
  quality: QualityGrade;
  digits: number;
  /** Nguồn giá realtime (LIVE/DAILY/SIM/OFFLINE) — badge minh bạch trên Radar */
  dataSource?: DataSource;
  sourceName?: string;
  updatedAt?: number;
  warmup?: string;
}

export interface MarketContextState {
  trendM15: 'BULL' | 'BEAR' | 'FLAT';
  trendH1: 'BULL' | 'BEAR' | 'FLAT';
  trendH4: 'BULL' | 'BEAR' | 'FLAT';
  trendD1: 'BULL' | 'BEAR' | 'FLAT';
  atr: number;
  spread: number;
  candleRemainingSec: number;
  sessions: {
    sydney: boolean;
    tokyo: boolean;
    london: boolean;
    newYork: boolean;
  };
  csm: { currency: string; score: number }[];
}

export interface AccountState {
  balance: number;
  equity: number;
  dailyStartingEquity: number;
  dailyDrawdownPct: number;
  maxDailyLossPct: number;
  isPropFirmLocked: boolean;
  leverage: number;
  riskPct: number;
}

export interface Position {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lot: number;
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  pnl: number;
  pips: number;
  tier: 'TP1' | 'TP2' | 'TP3' | 'SINGLE';
  openTime: string;
  /** Liên kết ngược tới tín hiệu gốc để ghi sổ khi đóng lệnh */
  signalId?: string;
  engine?: EngineId;
  engineName?: string;
  score?: number;
  quality?: QualityGrade;
  /** Liên kết Kaizen + ảnh chụp thị trường lúc mở lệnh */
  kaizenId?: string;
  marketSnapshot?: MarketSnapshot;
}

export interface NewsEvent {
  id: string;
  time: string;
  currency: string;
  impact: 'HIGH' | 'MED' | 'LOW';
  title: string;
  forecast: string;
  previous: string;
  actual?: string;
  inWindow: boolean;
}
