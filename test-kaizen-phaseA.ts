// test-kaizen-phaseA.ts — test logic Phase A (kaizenEngine + knowledge). Chạy: node test-kaizen-phaseA.ts
import { generateFindings, KAIZEN_MIN_TRADES } from './src/lib/kaizenEngine.ts';
import {
  evalCondition, entryMatches, matchRules, promoteFinding,
} from './src/lib/knowledge.ts';
import type { EngineInput } from './src/lib/kaizenEngine.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name); }
};
const sys = (o: Partial<any> = {}) => ({
  total: 50, winRate: 30, avgR: 0.1, profitFactor: 1.2, maxDrawdownR: 3, hasR: true, ...o,
});
const input = (s: any, b: any[] = []): EngineInput => ({ system: { stats: sys(s) }, benchmarks: b });

// 1. benchmark hơn win rate ≥10đ với đủ mẫu → finding
{
  const f = generateFindings(input({}, [{ name: 'Vantage X', stats: sys({ total: 40, winRate: 55, profitFactor: 2.0 }) }]));
  ok('R1 benchmark WR gap → finding', f.some((x) => x.area === 'benchmark' && x.metric === 'win-rate'));
}
// 2. benchmark hơn PF ≥0.5 → finding
{
  const f = generateFindings(input({}, [{ name: 'Vantage X', stats: sys({ total: 40, winRate: 32, profitFactor: 2.0 }) }]));
  ok('R1b benchmark PF gap → finding', f.some((x) => x.area === 'benchmark' && x.metric === 'profit-factor'));
}
// 3. thiếu mẫu benchmark → KHÔNG finding (không bịa)
{
  const f = generateFindings(input({ total: 5 }, [{ name: 'Vantage X', stats: sys({ total: 40, winRate: 80 }) }]));
  ok('thiếu mẫu → không finding benchmark', !f.some((x) => x.area === 'benchmark'));
}
// 4. phiên yếu
{
  const f = generateFindings({ system: { stats: sys(), bySession: [{ session: '19h', closed: 12, winRate: 20, avgR: -0.5 }] }, benchmarks: [] });
  ok('R2 phiên yếu → finding', f.some((x) => x.area === 'phien' && x.title.includes('19h')));
}
// 5. phiên ít mẫu → không finding
{
  const f = generateFindings({ system: { stats: sys(), bySession: [{ session: '19h', closed: 3, winRate: 0, avgR: -1 }] }, benchmarks: [] });
  ok('phiên thiếu mẫu → im lặng', !f.some((x) => x.area === 'phien'));
}
// 6. factor nhiễu
{
  const f = generateFindings({ system: { stats: sys(), factors: [{ factorId: 'f1', label: 'RSI quá mua', closedWithPass: 20, winRateWhenPassed: 25, avgRWhenPassed: -0.2 }] }, benchmarks: [] });
  ok('R3 factor nhiễu → finding', f.some((x) => x.area === 'factor'));
}
// 7. verdict MẠNH avgR âm
{
  const f = generateFindings({ system: { stats: sys(), verdicts: [{ verdict: 'MẠNH', closed: 15, winRate: 40, avgR: -0.1 }] }, benchmarks: [] });
  ok('R4 verdict MẠNH âm → finding severity cao', f.some((x) => x.area === 'verdict' && x.severity === 'cao'));
}
// 8. drawdown sâu
{
  const f = generateFindings(input({ maxDrawdownR: 10 }));
  ok('R5 drawdown sâu → finding', f.some((x) => x.area === 'drawdown'));
}
// 9. drawdown nông → không finding
{
  const f = generateFindings(input({ maxDrawdownR: 3 }));
  ok('drawdown nông → im lặng', !f.some((x) => x.area === 'drawdown'));
}
// 10. mã yếu
{
  const f = generateFindings({ system: { stats: sys({ winRate: 45 }), bySymbol: { BTCUSD: sys({ total: 15, winRate: 10 }) } }, benchmarks: [] });
  ok('R6 mã yếu → finding', f.some((x) => x.area === 'symbol' && x.title.includes('BTCUSD')));
}
// 11. dữ liệu rỗng → mảng rỗng, không crash
{
  const f = generateFindings({ system: { stats: sys({ total: 0 }) }, benchmarks: [] });
  ok('rỗng → []', Array.isArray(f) && f.length === 0);
}
// 12. finding mặc định là de-xuat/moi
{
  const f = generateFindings(input({ maxDrawdownR: 10 }));
  ok('mặc định de-xuat/moi', f.every((x) => x.kind === 'de-xuat' && x.status === 'moi'));
}
// 13. evidence không rỗng, có số
{
  const f = generateFindings(input({ maxDrawdownR: 10 }));
  ok('evidence có nội dung', f.every((x) => x.evidence.length > 10 && x.action.length > 5 && x.hypothesis.length > 5));
}
// knowledge: evalCondition
ok('eval eq', evalCondition({ field: 'a', op: 'eq', value: 1 }, { a: 1 }));
ok('eval neq', evalCondition({ field: 'a', op: 'neq', value: 1 }, { a: 2 }));
ok('eval in', evalCondition({ field: 's', op: 'in', value: ['x', 'y'] }, { s: 'y' }));
ok('eval gte', evalCondition({ field: 'n', op: 'gte', value: 80 }, { n: 85 }));
ok('eval lte false', !evalCondition({ field: 'n', op: 'lte', value: 80 }, { n: 85 }));
ok('unknown field → false (an toàn)', !evalCondition({ field: 'zzz', op: 'eq', value: 1 }, { a: 1 }));
// entryMatches + matchRules
{
  const e: any = { id: 'k1', active: true, conditions: [{ field: 'newsHigh', op: 'eq', value: true }] };
  ok('entryMatches true', entryMatches(e, { newsHigh: true }));
  ok('entryMatches false', !entryMatches(e, { newsHigh: false }));
  ok('inactive → không khớp', !entryMatches({ ...e, active: false }, { newsHigh: true }));
  ok('matchRules lọc', matchRules({ newsHigh: true }, [e, { ...e, id: 'k2', active: false }]).length === 1);
}
// promoteFinding
{
  const f = generateFindings(input({ maxDrawdownR: 10 }))[0];
  const k = promoteFinding(f);
  ok('promote giữ action thành rule', k.rule === f.action && k.source === f.id && k.active);
  ok('promote mặc định SUY_LUAN', k.label === 'SUY_LUAN');
  ok('promote sampleSize theo finding', k.sampleSize === f.sampleSize);
}

console.log(`\n${pass}/${pass + fail} pass${fail ? `, ${fail} FAIL` : ''}`);
process.exit(fail ? 1 : 0);
