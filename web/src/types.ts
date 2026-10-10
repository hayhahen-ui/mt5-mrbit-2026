export type TabType = 'FLIGHT' | 'CTX' | 'SIG' | 'RADAR' | 'NEWS' | 'LOG' | 'HELP';

export type SignalDirection = 'BUY' | 'SELL' | 'FLAT';
export type QualityGrade = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5';
export type EngineId = 'SMC' | 'TREND' | 'MEAN_REV';

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
