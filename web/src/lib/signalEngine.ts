import {
  Asset, Signal, NewsEvent, DataSource, MarketSnapshot, KaizenRecord,
} from '../types';
import { getVerdict, checkNewsFilter, totalScore } from './scoring';
import { appendKaizen } from './kaizen';
import { newsNearSymbol } from './news';
import { RawFeatureInputs } from './neural/features';
import { evalSessions } from './sessions';
import { currenciesForSymbol } from './symbolNews';

/**
 * Signal Engine chạy trên DỮ LIỆU THẬT:
 * - Lịch sử giá: seed từ Kraken OHLC (BTC/ETH) + tích lũy live poll (các mã còn lại)
 * - Chỉ báo: EMA20, ROC, RSI14, độ biến động (stdev %)
 * - Phiên giao dịch + bộ lọc tin tức: tính bằng GIỜ THẬT
 * - Mọi lần đánh giá đều ghi nhật ký Kaizen (localStorage)
 */

export const WARMUP_MIN = 20;
const MAX_HISTORY = 120;



/* ---------- chỉ báo ---------- */

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export function roc(values: number[], n: number): number {
  if (values.length <= n) return 0;
  const a = values[values.length - 1 - n];
  const b = values[values.length - 1];
  return a > 0 ? ((b - a) / a) * 100 : 0;
}

export function stdevPct(values: number[], n: number): number {
  const s = values.slice(-n);
  if (s.length < 2) return 0;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const v = s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length;
  return mean > 0 ? (Math.sqrt(v) / mean) * 100 : 0;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let g = 0, l = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  const rs = g / l;
  return 100 - 100 / (1 + rs);
}

/** Phiên đang mở theo múi giờ chuẩn của sàn (đồng bộ với thanh đồng hồ) */
export function currentSession(): string {
  const open = evalSessions(new Date())
    .filter((s) => s.isOpen)
    .map((s) => s.label);
  return open.length ? open.join('+') : 'Nghỉ phiên';
}

function sessionPoints(session: string): { points: number; detail: string } {
  if (session.includes('London') || session.includes('New York'))
    return { points: 9, detail: `Phiên ${session} — thanh khoản cao` };
  if (session.includes('Tokyo') || session.includes('Sydney'))
    return { points: 6, detail: `Phiên ${session} — thanh khoản trung bình` };
  return { points: 4, detail: 'Ngoài giờ phiên chính — thanh khoản thấp' };
}

/* ---------- quản lý lịch sử ---------- */

export class PriceHistory {
  private map = new Map<string, number[]>();

  seed(symbol: string, closes: number[]) {
    this.map.set(symbol, closes.slice(-MAX_HISTORY));
  }

  push(symbol: string, price: number) {
    const arr = this.map.get(symbol) || [];
    const last = arr[arr.length - 1];
    if (last === price) return; // không trùng lặp
    arr.push(price);
    if (arr.length > MAX_HISTORY) arr.shift();
    this.map.set(symbol, arr);
  }

  get(symbol: string): number[] {
    return this.map.get(symbol) || [];
  }

  warmup(symbol: string): string {
    const n = this.get(symbol).length;
    return `${Math.min(n, WARMUP_MIN)}/${WARMUP_MIN}`;
  }

  isReady(symbol: string): boolean {
    return this.get(symbol).length >= WARMUP_MIN;
  }
}

/* ---------- đánh giá tín hiệu ---------- */

export interface EngineInput {
  asset: Asset;
  price: number;
  change24h: number;
  dataSource: DataSource;
  sourceName: string;
  news: NewsEvent[];
  equity: number;
  riskPct: number;
}

const ENGINE_NAMES: Record<string, string> = {
  SMC: 'SMC ICT Alpha',
  TREND: 'Trend Ribbon Pro',
  MEAN_REV: 'Mean Reversion Sweep',
};

function pickEngine(rsiV: number, rocV: number): 'SMC' | 'TREND' | 'MEAN_REV' {
  if (rsiV <= 32 || rsiV >= 68) return 'MEAN_REV'; // cực đoan → bắt đảo chiều
  if (Math.abs(rocV) > 0.4) return 'TREND';        // động lượng rõ → theo trend
  return 'SMC';                                    // mặc định: cấu trúc giá
}

export function evaluateSignal(
  input: EngineInput,
  history: PriceHistory,
  logKaizen = true
): { signal: Signal | null; snapshot: MarketSnapshot; rawFeatures: RawFeatureInputs } {
  const { asset, price, change24h, dataSource, sourceName, news, equity, riskPct } = input;
  const hist = history.get(asset.symbol);
  const session = currentSession();
  const atrP = stdevPct(hist, 20);
  const rocV = roc(hist, 10);
  const rsiV = rsi(hist, 14);
  const ema20 = ema(hist, 20);
  const newsFilter = checkNewsFilter(asset.symbol, news);
  const nearNews = newsNearSymbol(asset.symbol, news, currenciesForSymbol, 60);
  const historyReady = history.isReady(asset.symbol);
  const spreadOk = asset.spread <= (asset.category === 'Crypto' ? 25 : 2.5);

  const rawFeatures: RawFeatureInputs = {
    price,
    ema20,
    roc10: rocV,
    stdev20: atrP,
    rsi14: rsiV,
    session,
    newsBlocked: newsFilter.blocked,
    spreadOk,
    change24h,
    historyReady,
  };

  const snapshot: MarketSnapshot = {
    price,
    change24h,
    atrProxy: Number(atrP.toFixed(3)),
    roc: Number(rocV.toFixed(3)),
    session,
    newsNear: nearNews.slice(0, 3),
    dataSource,
    warmup: history.warmup(asset.symbol),
  };

  if (!historyReady) return { signal: null, snapshot, rawFeatures };

  const direction = price > ema20 && rocV > 0 ? 'BUY' : price < ema20 && rocV < 0 ? 'SELL' : 'FLAT';
  const engine = pickEngine(rsiV, rocV);

  // --- chấm điểm từng yếu tố trên số liệu THẬT ---
  const fTrend = Math.min(20, Math.max(0, 10 + Math.abs(rocV) * 12));
  const fMom = Math.min(20, Math.max(0, 10 + Math.abs(rocV) * 10));
  const healthyVol = atrP > 0.02 && atrP < 3.0;
  const fVol = healthyVol ? 13 : 5;
  const sess = sessionPoints(session);
  const rsiOk = rsiV >= 30 && rsiV <= 70;
  const fRsi = rsiOk ? 13 : 6;
  const fSpread = spreadOk ? 8 : 4;
  const fNews = newsFilter.blocked ? 0 : 9;

  const factors = [
    { id: 'xu_huong', label: 'Xu hướng EMA20', points: Math.round(fTrend), maxPoints: 20, passed: fTrend >= 12, detail: `Giá ${price} vs EMA20 ${ema20.toFixed(asset.digits)} — ${direction}` },
    { id: 'dong_luong', label: 'Động lượng ROC(10)', points: Math.round(fMom), maxPoints: 20, passed: fMom >= 12, detail: `ROC ${rocV.toFixed(2)}% trên 10 mẫu` },
    { id: 'bien_dong', label: 'Biến động hợp lý', points: fVol, maxPoints: 15, passed: healthyVol, detail: `Độ lệch chuẩn ${atrP.toFixed(3)}% ${healthyVol ? 'trong vùng an toàn' : 'bất thường'}` },
    { id: 'phien', label: 'Phiên giao dịch', points: sess.points, maxPoints: 10, passed: sess.points >= 6, detail: sess.detail },
    { id: 'rsi', label: 'RSI không cực đoan', points: fRsi, maxPoints: 15, passed: rsiOk, detail: `RSI14 = ${rsiV.toFixed(1)}` },
    { id: 'spread', label: 'Spread trong ngưỡng', points: fSpread, maxPoints: 10, passed: spreadOk, detail: `Spread ${asset.spread} pips` },
    { id: 'tin_tuc', label: 'Lọc tin tức', points: fNews, maxPoints: 10, passed: !newsFilter.blocked, detail: newsFilter.blocked ? newsFilter.reason : 'Không có tin HIGH trong cửa sổ tin' },
  ];

  const score = totalScore(factors as any);
  const verdict = getVerdict(score);
  const quality = score >= 80 ? 'Q5' : score >= 65 ? 'Q4' : score >= 50 ? 'Q3' : score >= 35 ? 'Q2' : 'Q1';

  // Giá vào/SL/TP suy từ biến động thật: risk = 1.5 × ATR-proxy
  const riskDist = Math.max(price * (atrP / 100) * 1.5, price * 0.0005);
  const isBuy = direction === 'BUY';
  const entry = price;
  const sl = isBuy ? entry - riskDist : entry + riskDist;
  const tp1 = isBuy ? entry + riskDist : entry - riskDist;
  const tp2 = isBuy ? entry + riskDist * 2 : entry - riskDist * 2;
  const tp3 = isBuy ? entry + riskDist * 3 : entry - riskDist * 3;
  const pipSize = asset.category === 'Forex' ? 0.0001 : asset.category === 'Metals' ? 0.1 : 1;
  const toPips = (d: number) => Number((Math.abs(d) / pipSize).toFixed(1));
  const r = (x: number) => Number(x.toFixed(asset.digits));

  // Lot theo % rủi ro trên số liệu thật
  const riskAmount = equity * (riskPct / 100);
  const pipValue = asset.category === 'Forex' ? 10 : 1;
  const slPips = Math.max(toPips(riskDist), 1);
  const suggestedLot = Math.max(0.01, Number((riskAmount / (slPips * pipValue)).toFixed(2)));

  const signal: Signal = {
    id: `sig-${asset.symbol}-${Date.now()}`,
    symbol: asset.symbol,
    timeframe: dataSource === 'LIVE' ? 'M15' : 'H1',
    direction,
    engine,
    engineName: ENGINE_NAMES[engine],
    entryPrice: r(entry),
    stopLoss: r(sl),
    tp1: r(tp1),
    tp2: r(tp2),
    tp3: r(tp3),
    tp1Odds: Math.min(92, Math.round(score * 0.95)),
    tp2Odds: Math.min(75, Math.round(score * 0.68)),
    tp3Odds: Math.min(55, Math.round(score * 0.42)),
    quality: quality as any,
    pWin: Math.min(95, Math.round(score * 0.92 * 10) / 10),
    pipsSL: slPips,
    pipsTP1: toPips(tp1 - entry),
    pipsTP2: toPips(tp2 - entry),
    pipsTP3: toPips(tp3 - entry),
    suggestedLot,
    rationale: `${ENGINE_NAMES[engine]}: EMA20 ${isBuy ? 'hỗ trợ' : 'kháng cự'} + ROC ${rocV.toFixed(2)}% + RSI ${rsiV.toFixed(1)} — tính trên ${hist.length} mẫu giá thật (${sourceName})`,
    isHeadsUp: newsFilter.blocked,
    timestamp: 'Vừa cập nhật từ dữ liệu thật',
    scoreBreakdown: factors as any,
    verdict,
  };

  // Nhật ký Kaizen: ghi mọi đánh giá có hướng (chống trùng 15')
  if (logKaizen && direction !== 'FLAT') {
    const rec: KaizenRecord = {
      id: `KZ-${Date.now()}-${asset.symbol}`,
      ts: Date.now(),
      time: new Date().toISOString(),
      symbol: asset.symbol,
      direction,
      engine,
      engineName: ENGINE_NAMES[engine],
      score,
      verdict,
      quality: quality as any,
      factors: factors.map((f) => ({ id: f.id, label: f.label, points: f.points, maxPoints: f.maxPoints, passed: f.passed })),
      snapshot,
      newsBlocked: newsFilter.blocked,
    };
    appendKaizen(rec, 15);
  }

  return { signal, snapshot, rawFeatures };
}
