// test-p1-kaizen.ts — regression ĐB1-kaizen (16/10/2026, user duyệt):
// BỎ 4 factor nhiễu (bien_dong/rsi/spread/tin_tuc) khỏi công thức —
// chỉ giữ xu_huong 20đ + dong_luong 20đ + phien 5đ = maxScore 45, chuẩn hóa 0-100.
// Chay: node --no-warnings --loader ./ts-resolve-loader.mjs test-p1-kaizen.ts
import { evaluateSignal, PriceHistory } from './src/lib/signalEngine';
import { maxScore, totalScore } from './src/lib/scoring';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name); }
};

const hist = new PriceHistory();
// seed 30 gia gia tang nhe cho XAUUSD
const prices: number[] = [];
let px = 4100;
for (let i = 0; i < 30; i++) { px += (i % 3 === 0 ? -2 : 3); prices.push(px); }
hist.seed('XAUUSD', prices);

const input: any = {
  asset: { symbol: 'XAUUSD', digits: 2, spread: 0.3, category: 'Metals' },
  price: prices[prices.length - 1],
  change24h: 0.5,
  dataSource: 'LIVE',
  sourceName: 'test',
  news: [],
  equity: 1000,
  riskPct: 1,
};

const { signal, snapshot } = evaluateSignal(input, hist);
ok('co tin hieu (du warmup)', !!signal);
if (signal) {
  const bd: any[] = signal.scoreBreakdown || [];
  const byId: Record<string, any> = {};
  for (const f of bd) byId[f.id] = f;
  // ĐB1: chỉ 3 factor, 4 factor nhiễu bị loại khỏi breakdown
  ok('chi 3 factor trong breakdown', bd.length === 3);
  ok('khong con bien_dong', !byId['bien_dong']);
  ok('khong con rsi', !byId['rsi']);
  ok('khong con spread', !byId['spread']);
  ok('khong con tin_tuc', !byId['tin_tuc']);
  // 3 factor giữ lại đúng maxPoints
  ok('xu_huong maxPoints 20', byId['xu_huong']?.maxPoints === 20);
  ok('dong_luong maxPoints 20', byId['dong_luong']?.maxPoints === 20);
  ok('phien maxPoints 5', byId['phien']?.maxPoints === 5);
  ok('tong max = 45', maxScore(bd) === 45);
  // diem chuan hoa ve thang 0-100
  const raw = totalScore(bd);
  const expected = Math.round((raw / 45) * 100);
  ok(`baseScore chuan hoa 0-100 (raw ${raw} -> ${expected}, got ${signal.baseScore})`, signal.baseScore === expected);
  ok('baseScore trong 0-100', signal.baseScore >= 0 && signal.baseScore <= 100);
  // khong con truong gia pWin/tpOdds (P0-kaizen)
  ok('khong co pWin gia', (signal as any).pWin === undefined);
  ok('khong co tp1Odds gia', (signal as any).tp1Odds === undefined);
  // verdict hop le
  ok('verdict hop le', ['MANH', 'TRUNG_BINH', 'YEU', 'BO_QUA'].includes(signal.verdict as string));
}

console.log(`\n${pass}/${pass + fail} pass`);
if (fail > 0) process.exit(1);
