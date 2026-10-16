// test-benchmark-p3.ts — test P3 (16/10/2026): CSV import + thong ke benchmark (tru doi ung).
// Chay: node test-benchmark-p3.ts
import { parseBenchmarkCsv, calcBenchmarkStats } from './src/lib/benchmark.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name); }
};

// 1. CSV chuan: 3 lenh
const csv = `symbol,direction,openTime,closeTime,openPrice,closePrice,lot,pnlUsd,riskUsd,pips,note
XAUUSD,BUY,2026-10-10,2026-10-10,4100,4110,0.01,10,5,100,win
XAUUSD,SELL,2026-10-11,2026-10-11,4110,4115,0.01,-5,5,-50,loss
EURUSD,BUY,2026-10-12,2026-10-12,1.10,1.11,0.01,8,4,100,win`;
{
  const r = parseBenchmarkCsv(csv);
  ok('parse du 3 trades', r.trades.length === 3);
  ok('khong co loi', r.errors.length === 0);
  const st: any = calcBenchmarkStats(r.trades);
  ok('total=3', st.total === 3);
  ok('winRate=66.7', Math.abs(st.winRate - 66.7) < 0.1);
  ok('profitFactor=4', Math.abs(st.profitFactor - 4) < 0.01);
  ok('totalUsd=13', st.totalUsd === 13);
}
// 2. Dong loi: direction sai + pnl khong phai so
{
  const r = parseBenchmarkCsv('XAUUSD,HOLD,,,,,,abc\n,BUY,,,,,,10');
  ok('dong loi bi bat', r.errors.length === 2 && r.trades.length === 0);
}
// 3. CSV rong
{
  const r = parseBenchmarkCsv('');
  ok('CSV rong -> 0 trade, khong crash', r.trades.length === 0);
}
// 4. Thieu cot option (risk/pips/note) van parse duoc
{
  const r = parseBenchmarkCsv('XAUUSD,BUY,,,,,,10');
  ok('thieu cot option van ok', r.trades.length === 1 && r.trades[0].pnlUsd === 10);
}

console.log(`\n${pass}/${pass + fail} pass`);
if (fail > 0) process.exit(1);
