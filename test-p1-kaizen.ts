// test-p1-kaizen.ts — regression P1 (16/10/2026): giam trong so 5 factor chet + chuan hoa diem.
// Chay: node test-p1-kaizen.ts
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
  // P1: 5 factor chet giam 50% maxPoints
  ok('bien_dong maxPoints 8', byId['bien_dong']?.maxPoints === 8);
  ok('phien maxPoints 5', byId['phien']?.maxPoints === 5);
  ok('rsi maxPoints 8', byId['rsi']?.maxPoints === 8);
  ok('spread maxPoints 5', byId['spread']?.maxPoints === 5);
  ok('tin_tuc maxPoints 5', byId['tin_tuc']?.maxPoints === 5);
  // 2 factor tot giu nguyen
  ok('xu_huong maxPoints 20', byId['xu_huong']?.maxPoints === 20);
  ok('dong_luong maxPoints 20', byId['dong_luong']?.maxPoints === 20);
  ok('tong max = 71', maxScore(bd) === 71);
  // diem chuan hoa ve thang 0-100
  const raw = totalScore(bd);
  const expected = Math.round((raw / 71) * 100);
  ok(`baseScore chuan hoa 0-100 (raw ${raw} -> ${expected}, got ${signal.baseScore})`, signal.baseScore === expected);
  ok('baseScore trong 0-100', signal.baseScore >= 0 && signal.baseScore <= 100);
  // khong con truong gia pWin/tpOdds
  ok('khong co pWin gia', (signal as any).pWin === undefined);
  ok('khong co tp1Odds gia', (signal as any).tp1Odds === undefined);
  // verdict hop le
  ok('verdict hop le', ['MANH', 'TRUNG_BINH', 'YEU', 'BO_QUA'].includes(signal.verdict as string));
}

console.log(`\n${pass}/${pass + fail} pass`);
if (fail > 0) process.exit(1);
