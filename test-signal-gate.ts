// test-signal-gate.ts — test Phase C (signalGate). Chạy: node test-signal-gate.ts
import { gateSignal, countBlockRules } from './src/lib/signalGate.ts';
import type { KnowledgeEntry } from './src/lib/knowledge.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name); }
};

const base: KnowledgeEntry = {
  id: 'KN-1', rule: 'Không mở lệnh khi có tin HIGH', conditions: [{ field: 'newsHigh', op: 'eq', value: true }],
  confidence: 'cao', sampleSize: 30, label: 'FACT', effect: 'block',
  source: 'test', createdAt: 1, updatedAt: 1, active: true,
};
const ctx = (o: any = {}) => ({ symbol: 'XAUUSD', direction: 'BUY' as const, ...o });

// 1. luật block khớp → chặn
{
  const r = gateSignal(ctx({ newsHigh: true }), [base]);
  ok('block khi khớp', r.blocked && !r.pass && r.reasons.length === 1 && r.reasons[0].includes('tin HIGH'));
}
// 2. không khớp → qua
{
  const r = gateSignal(ctx({ newsHigh: false }), [base]);
  ok('qua khi không khớp', r.pass && !r.blocked && r.reasons.length === 0);
}
// 3. luật inactive → bỏ qua hoàn toàn
{
  const r = gateSignal(ctx({ newsHigh: true }), [{ ...base, active: false }]);
  ok('inactive → qua', r.pass && !r.blocked);
}
// 4. effect=warn → cảnh báo, vẫn qua
{
  const r = gateSignal(ctx({ newsHigh: true }), [{ ...base, effect: 'warn' as const }]);
  ok('warn → qua + warnings', r.pass && !r.blocked && r.warnings.length === 1);
}
// 5. effect=research → cổng bỏ qua
{
  const r = gateSignal(ctx({ newsHigh: true }), [{ ...base, effect: 'research' as const }]);
  ok('research → bỏ qua', r.pass && r.warnings.length === 0 && r.reasons.length === 0);
}
// 6. nhiều luật block khớp → liệt kê hết
{
  const k2 = { ...base, id: 'KN-2', rule: 'Không mở lệnh phiên Sydney' , conditions: [{ field: 'session', op: 'eq' as const, value: 'Sydney' }] };
  const r = gateSignal(ctx({ newsHigh: true, session: 'Sydney' }), [base, k2]);
  ok('2 luật chặn → 2 lý do', r.blocked && r.reasons.length === 2);
}
// 7. điều kiện theo session
{
  const k = { ...base, id: 'KN-3', rule: 'Tránh Sydney', conditions: [{ field: 'session', op: 'eq' as const, value: 'Sydney' }] };
  ok('session khớp → chặn', gateSignal(ctx({ session: 'Sydney' }), [k]).blocked);
  ok('session khác → qua', gateSignal(ctx({ session: 'Tokyo' }), [k]).pass);
}
// 8. điều kiện theo symbol (in)
{
  const k = { ...base, id: 'KN-4', rule: 'Tạm dừng BTC', conditions: [{ field: 'symbol', op: 'in' as const, value: ['BTCUSD'] }] };
  ok('symbol trong list → chặn', gateSignal(ctx({ symbol: 'BTCUSD' }), [k]).blocked);
  ok('symbol ngoài list → qua', gateSignal(ctx({ symbol: 'XAUUSD' }), [k]).pass);
}
// 9. luật không có conditions → áp mọi tín hiệu
{
  const k = { ...base, id: 'KN-5', rule: 'Tạm dừng toàn bộ', conditions: [] };
  ok('rỗng = mọi trường hợp', gateSignal(ctx(), [k]).blocked);
}
// 10. nnScore đính kèm
{
  const r = gateSignal(ctx(), [], 72);
  ok('nnScore đính kèm', r.pass && r.nnScore === 72);
  const r2 = gateSignal(ctx(), []);
  ok('thiếu nnScore → undefined', r2.nnScore === undefined);
}
// 11. countBlockRules
{
  const ks = [base, { ...base, id: 'KN-x', active: false }, { ...base, id: 'KN-y', effect: 'warn' as const }, { ...base, id: 'KN-z', effect: 'research' as const }];
  ok('đếm đúng luật block hiệu lực', countBlockRules(ks) === 1);
}
// 12. kho rỗng → qua
{
  const r = gateSignal(ctx(), []);
  ok('kho rỗng → qua', r.pass && !r.blocked);
}
// 13. entry thiếu effect (dữ liệu cũ) → an toàn, không chặn bừa
{
  const k = { ...base, id: 'KN-old' } as KnowledgeEntry;
  delete (k as any).effect;
  const r = gateSignal(ctx({ newsHigh: true }), [k]);
  ok('thiếu effect → không chặn', r.pass);
}

console.log(`\n${pass}/${pass + fail} pass${fail ? `, ${fail} FAIL` : ''}`);
process.exit(fail ? 1 : 0);
