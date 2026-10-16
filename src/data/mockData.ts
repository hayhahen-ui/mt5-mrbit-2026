import { Asset, Signal, MarketContextState, AccountState, NewsEvent, ScoreFactor } from '../types';

/** Thang chấm điểm minh bạch 100đ — 7 yếu tố (đồng bộ chuẩn Trade.2026) */
const SCORE_XAUUSD: ScoreFactor[] = [
  { id: 'cau_truc', label: 'Cấu trúc BOS/CHoCH', points: 18, maxPoints: 20, passed: true, detail: 'Phá vỡ đỉnh phụ + đóng nến trên BOS' },
  { id: 'ob_fvg', label: 'Order Block / FVG', points: 17, maxPoints: 20, passed: true, detail: 'Retest FVG tăng + phản ứng Demand OB' },
  { id: 'nen', label: 'Nến xác nhận', points: 13, maxPoints: 15, passed: true, detail: 'Pinbar tăng đuôi dài tại vùng cầu' },
  { id: 'phien', label: 'Phiên giao dịch', points: 8, maxPoints: 10, passed: true, detail: 'Phiên London mở cửa, thanh khoản cao' },
  { id: 'rr', label: 'Tỉ lệ RR', points: 13, maxPoints: 15, passed: true, detail: 'RR tới TP1 = 1.0, TP2 = 2.06' },
  { id: 'spread', label: 'Spread trong ngưỡng', points: 8, maxPoints: 10, passed: true, detail: 'Spread 1.4 pips < ngưỡng 2.0' },
  { id: 'news', label: 'Lọc tin tức', points: 8, maxPoints: 10, passed: true, detail: 'Không có tin HIGH trong cửa sổ tin' },
];

const SCORE_EURUSD: ScoreFactor[] = [
  { id: 'cau_truc', label: 'Cấu trúc BOS/CHoCH', points: 15, maxPoints: 20, passed: true, detail: 'Phá vỡ đáy phụ, cấu trúc giảm xác nhận' },
  { id: 'ob_fvg', label: 'Order Block / FVG', points: 14, maxPoints: 20, passed: true, detail: 'Giá hồi về vùng cung, chưa chạm OB mạnh' },
  { id: 'nen', label: 'Nến xác nhận', points: 11, maxPoints: 15, passed: true, detail: 'Nến từ chối tăng thân trung bình' },
  { id: 'phien', label: 'Phiên giao dịch', points: 7, maxPoints: 10, passed: true, detail: 'Cuối phiên London, thanh khoản vừa' },
  { id: 'rr', label: 'Tỉ lệ RR', points: 11, maxPoints: 15, passed: true, detail: 'RR tới TP1 = 1.0, TP2 = 2.0' },
  { id: 'spread', label: 'Spread trong ngưỡng', points: 7, maxPoints: 10, passed: true, detail: 'Spread 0.8 pips < ngưỡng 2.0' },
  { id: 'news', label: 'Lọc tin tức', points: 7, maxPoints: 10, passed: true, detail: 'Tin EUR MED 15:00 — ngoài cửa sổ vào lệnh' },
];

const SCORE_BTCUSD: ScoreFactor[] = [
  { id: 'cau_truc', label: 'Cấu trúc BOS/CHoCH', points: 19, maxPoints: 20, passed: true, detail: 'Quét đáy phiên Á + BOS tăng H4 rõ ràng' },
  { id: 'ob_fvg', label: 'Order Block / FVG', points: 18, maxPoints: 20, passed: true, detail: 'Phản ứng mạnh tại Demand OB H4' },
  { id: 'nen', label: 'Nến xác nhận', points: 13, maxPoints: 15, passed: true, detail: 'Nến nhấn chìm tăng trên H1' },
  { id: 'phien', label: 'Phiên giao dịch', points: 9, maxPoints: 10, passed: true, detail: 'Phiên Mỹ mở cửa, biến động thuận lợi' },
  { id: 'rr', label: 'Tỉ lệ RR', points: 13, maxPoints: 15, passed: true, detail: 'RR tới TP1 = 1.5, TP2 = 3.25' },
  { id: 'spread', label: 'Spread trong ngưỡng', points: 8, maxPoints: 10, passed: true, detail: 'Spread 12.0 trong ngưỡng crypto' },
  { id: 'news', label: 'Lọc tin tức', points: 8, maxPoints: 10, passed: true, detail: 'Không có tin HIGH trong cửa sổ tin' },
];

export const INITIAL_ASSETS: Asset[] = [
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'Metals', price: 2652.40, change24h: 1.25, spread: 1.4, trendH1: 'BULL', signalDir: 'BUY', quality: 'Q5', digits: 2 },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex', price: 1.0845, change24h: -0.32, spread: 0.8, trendH1: 'BEAR', signalDir: 'SELL', quality: 'Q4', digits: 5 },
  { symbol: 'GBPUSD', name: 'Great Britain Pound', category: 'Forex', price: 1.2982, change24h: 0.45, spread: 1.1, trendH1: 'BULL', signalDir: 'BUY', quality: 'Q4', digits: 5 },
  { symbol: 'USDJPY', name: 'US Dollar / Yen', category: 'Forex', price: 152.65, change24h: 0.80, spread: 1.0, trendH1: 'BULL', signalDir: 'FLAT', quality: 'Q3', digits: 3 },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'Crypto', price: 67450.00, change24h: 3.80, spread: 12.0, trendH1: 'BULL', signalDir: 'BUY', quality: 'Q5', digits: 2 },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', category: 'Crypto', price: 2680.50, change24h: 2.10, spread: 2.5, trendH1: 'BULL', signalDir: 'FLAT', quality: 'Q3', digits: 2 },
  { symbol: 'AUDUSD', name: 'Aussie / US Dollar', category: 'Forex', price: 0.6580, change24h: -0.15, spread: 0.9, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 5 },
  { symbol: 'NZDUSD', name: 'Kiwi / US Dollar', category: 'Forex', price: 0.5980, change24h: 0.10, spread: 1.0, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 5 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian', category: 'Forex', price: 1.3850, change24h: 0.20, spread: 1.2, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 5 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'Forex', price: 0.8950, change24h: -0.10, spread: 1.1, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 5 },
  { symbol: 'EURJPY', name: 'Euro / Yen', category: 'Forex', price: 171.50, change24h: 0.30, spread: 1.3, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 3 },
  { symbol: 'GBPJPY', name: 'Pound / Yen', category: 'Forex', price: 199.80, change24h: 0.40, spread: 1.5, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 3 },
  { symbol: 'EURGBP', name: 'Euro / Pound', category: 'Forex', price: 0.8450, change24h: -0.05, spread: 0.9, trendH1: 'FLAT', signalDir: 'FLAT', quality: 'Q2', digits: 5 },
  { symbol: 'US30', name: 'Dow Jones Industrial', category: 'Indices', price: 42800.00, change24h: 0.65, spread: 3.0, trendH1: 'BULL', signalDir: 'BUY', quality: 'Q4', digits: 1 }
];

export const INITIAL_SIGNALS: Record<string, Signal> = {
  XAUUSD: {
    id: 'sig-xau-1',
    symbol: 'XAUUSD',
    timeframe: 'M15',
    direction: 'BUY',
    engine: 'SMC',
    engineName: 'SMC ICT Alpha',
    entryPrice: 2650.50,
    stopLoss: 2642.00,
    tp1: 2659.00,
    tp2: 2668.00,
    tp3: 2682.00,
    quality: 'Q5',
    pipsSL: 85.0,
    pipsTP1: 85.0,
    pipsTP2: 175.0,
    pipsTP3: 315.0,
    suggestedLot: 0.50,
    rationale: 'SMC Mitigation: FVG Retest + Bullish Pinbar + Phá vỡ cấu trúc đỉnh phụ (BOS)',
    isHeadsUp: false,
    timestamp: 'Vừa kích hoạt',
    scoreBreakdown: SCORE_XAUUSD,
    verdict: 'MANH'
  },
  EURUSD: {
    id: 'sig-eur-1',
    symbol: 'EURUSD',
    timeframe: 'M15',
    direction: 'SELL',
    engine: 'TREND',
    engineName: 'Trend Ribbon Pro',
    entryPrice: 1.0850,
    stopLoss: 1.0880,
    tp1: 1.0820,
    tp2: 1.0790,
    tp3: 1.0740,
    quality: 'Q4',
    pipsSL: 30.0,
    pipsTP1: 30.0,
    pipsTP2: 60.0,
    pipsTP3: 110.0,
    suggestedLot: 1.20,
    rationale: 'Trend Pullback: Giá hồi về dải EMA Ribbon 21-50 và đóng nến từ chối giảm',
    isHeadsUp: false,
    timestamp: '15 phút trước',
    scoreBreakdown: SCORE_EURUSD,
    verdict: 'TRUNG_BINH'
  },
  BTCUSD: {
    id: 'sig-btc-1',
    symbol: 'BTCUSD',
    timeframe: 'H1',
    direction: 'BUY',
    engine: 'SMC',
    engineName: 'SMC ICT Alpha',
    entryPrice: 67200.00,
    stopLoss: 66400.00,
    tp1: 68400.00,
    tp2: 69800.00,
    tp3: 72000.00,
    quality: 'Q5',
    pipsSL: 800.0,
    pipsTP1: 1200.0,
    pipsTP2: 2600.0,
    pipsTP3: 4800.0,
    suggestedLot: 0.15,
    rationale: 'Liquidity Sweep: Quét đáy phiên Á + Phản ứng Order Block tăng trưởng H4',
    isHeadsUp: false,
    timestamp: '42 phút trước',
    scoreBreakdown: SCORE_BTCUSD,
    verdict: 'MANH'
  }
};

export const INITIAL_MARKET_CONTEXT: MarketContextState = {
  trendM15: 'BULL',
  trendH1: 'BULL',
  trendH4: 'BULL',
  trendD1: 'BULL',
  atr: 14.85,
  spread: 1.4,
  candleRemainingSec: 412,
  sessions: {
    sydney: false,
    tokyo: true,
    london: true,
    newYork: false
  },
  csm: [
    { currency: 'USD', score: 78 },
    { currency: 'EUR', score: 42 },
    { currency: 'GBP', score: 68 },
    { currency: 'JPY', score: 28 },
    { currency: 'AUD', score: 55 },
    { currency: 'CAD', score: 50 },
    { currency: 'CHF', score: 45 },
    { currency: 'NZD', score: 38 }
  ]
};

export const INITIAL_ACCOUNT: AccountState = {
  balance: 100000.00,
  equity: 101420.50,
  dailyStartingEquity: 100000.00,
  dailyDrawdownPct: 0.85,
  maxDailyLossPct: 4.0,
  isPropFirmLocked: false,
  leverage: 100,
  riskPct: 1.0
};

export const INITIAL_NEWS: NewsEvent[] = [
  { id: 'n1', time: '19:30', currency: 'USD', impact: 'HIGH', title: 'US Core CPI Inflation m/m', forecast: '0.3%', previous: '0.3%', inWindow: false },
  { id: 'n2', time: '21:00', currency: 'USD', impact: 'HIGH', title: 'FOMC Member Williams Speech', forecast: '-', previous: '-', inWindow: false },
  { id: 'n3', time: '15:00', currency: 'EUR', impact: 'MED', title: 'ECB Economic Bulletin', forecast: '-', previous: '-', inWindow: false },
  { id: 'n4', time: '13:00', currency: 'GBP', impact: 'MED', title: 'UK GDP Monthly Estimate', forecast: '0.2%', previous: '0.1%', inWindow: false },
  { id: 'n5', time: '08:30', currency: 'AUD', impact: 'HIGH', title: 'RBA Interest Rate Decision', forecast: '4.35%', previous: '4.35%', actual: '4.35%', inWindow: false }
];
