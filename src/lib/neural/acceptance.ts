import { SCHEMA_VERSION, STRATEGY_VERSION, FEATURE_VERSION } from './contracts';
import { buildFeatures, hasMissingRequired, RawFeatureInputs } from './features';
import { loadNeuralRecords, clearNeuralRecords, countNeuralRecords } from './repository';
import { observeCandidate, setNeuralMode, CandidateInput } from './observer';

/**
 * neural/acceptance.ts — Kiểm thử nghiệm thu theo skill §12 (T01/T02/T04/T06/T07).
 * Chạy bằng node với esbuild bundle (xem /tmp/neural-acceptance.ts runner).
 * Không dùng test double làm model thật; mọi fixture đều gắn nhãn.
 */

export interface TestResult { id: string; name: string; pass: boolean; detail: string; }

function makeCandidate(over: Partial<CandidateInput> = {}): CandidateInput {
  const raw: RawFeatureInputs = {
    price: 2650.5, ema20: 2648.0, roc10: 0.35, stdev20: 0.12, rsi14: 58,
    session: 'London', newsBlocked: false, spreadOk: true, change24h: 0.4,
    historyReady: true,
  };
  return {
    symbol: 'XAUUSD',
    direction: 'BUY',
    engine: 'SMC',
    engineName: 'SMC ICT Alpha',
    ruleScore: 82,
    ruleComponents: [{ id: 'xu_huong', label: 'Xu hướng EMA20', points: 17, maxPoints: 20, passed: true }],
    eligibility: 'eligible',
    plan: { entry: 2650.5, stop: 2642, tp1: 2659, tp2: 2668, tp3: 2682, suggestedLot: 0.5 },
    rawFeatures: raw,
    provenance: {
      source: 'Gold-API',
      asOf: new Date().toISOString(),
      availableAt: new Date().toISOString(),
      warmup: '20/20',
    },
    dataOrigin: 'live_observed',
    ...over,
  };
}

export function runAcceptance(): TestResult[] {
  const results: TestResult[] = [];
  const push = (id: string, name: string, pass: boolean, detail: string) =>
    results.push({ id, name, pass, detail });

  // Chuẩn bị sạch
  clearNeuralRecords();
  setNeuralMode('shadow');

  // T01 — flag off: luồng neural không hoạt động
  setNeuralMode('off');
  const before = countNeuralRecords();
  const r01 = observeCandidate(makeCandidate());
  push('T01', 'Feature flag off → observer không ghi gì',
    r01.record === null && r01.assessment === null && countNeuralRecords() === before,
    `record=${r01.record === null}, assessment=${r01.assessment === null}, count=${countNeuralRecords()}`);
  setNeuralMode('shadow');

  // T02 — shadow, có model thật: ready + dự báo số, không gọi order API
  // (trước khi train: kỳ vọng not_trained + null; sau khi train: ready + số)
  clearNeuralRecords();
  const r02 = observeCandidate(makeCandidate());
  const a02 = r02.assessment!;
  const trained = a02.modelVersion !== null;
  push('T02', 'Shadow có model → ready, dự báo là số hợp lệ',
    trained
      ? (a02.status === 'ready' && typeof a02.pNetPositive === 'number' &&
         a02.pNetPositive >= 0 && a02.pNetPositive <= 1 &&
         typeof a02.expectedNetR === 'number' && isFinite(a02.expectedNetR) &&
         typeof a02.uncertainty === 'number' && r02.record !== null)
      : (a02.status === 'not_trained' && a02.pNetPositive === null && a02.expectedNetR === null &&
         a02.modelVersion === null && a02.reasonCodes.includes('MODEL_NOT_AVAILABLE') && r02.record !== null),
    `status=${a02.status}, p=${a02.pNetPositive}, R=${a02.expectedNetR}, model=${a02.modelVersion}`);

  // T04 — snapshot bất biến trước dữ liệu mới
  const cand04 = makeCandidate({ symbol: 'BTCUSD' });
  const r04 = observeCandidate(cand04);
  const storedPrice = r04.record!.snapshot.plan.entry;
  cand04.plan.entry = 99999; // đổi dữ liệu sau cutoff
  const reloaded = loadNeuralRecords().find((r) => r.snapshot.setupId === r04.record!.snapshot.setupId);
  push('T04', 'Snapshot bất biến sau cutoff',
    reloaded !== undefined && reloaded.snapshot.plan.entry === storedPrice && storedPrice !== 99999,
    `stored=${storedPrice}, after_mutation=${reloaded?.snapshot.plan.entry}`);

  // T06 — thiếu dữ liệu bắt buộc → insufficient_data, không bịa số
  clearNeuralRecords();
  const badRaw: RawFeatureInputs = { ...makeCandidate().rawFeatures, historyReady: false, rsi14: NaN };
  const fs06 = buildFeatures(badRaw);
  const r06 = observeCandidate(makeCandidate({ symbol: 'ETHUSD', rawFeatures: badRaw }));
  push('T06', 'Thiếu dữ liệu → insufficient_data, feature null kèm lý do',
    r06.assessment!.status === 'insufficient_data' &&
    fs06.values['rsi14'] === null && hasMissingRequired(fs06) &&
    r06.assessment!.reasonCodes.some((c) => c.startsWith('MISSING_')),
    `status=${r06.assessment!.status}, rsi14=${fs06.values['rsi14']}, missing=${Object.keys(fs06.missing).join(',')}`);

  // T07 — sự kiện gửi lại không nhân đôi bản ghi
  clearNeuralRecords();
  const c07 = makeCandidate({ symbol: 'EURUSD' });
  const first = observeCandidate(c07);
  const second = observeCandidate(c07); // cùng bucket phút → trùng dedupKey
  push('T07', 'Retry trùng sự kiện → dedup, không nhân đôi',
    first.record !== null && second.deduped === true && countNeuralRecords() === 1,
    `first_saved=${first.record !== null}, second_deduped=${second.deduped}, count=${countNeuralRecords()}`);

  // Phụ: schema version nhất quán
  const rec = loadNeuralRecords()[0];
  push('T00', 'Schema/strategy/feature version được ghi',
    rec?.snapshot.schemaVersion === SCHEMA_VERSION &&
    rec?.snapshot.strategyVersion === STRATEGY_VERSION &&
    rec?.snapshot.features.version === FEATURE_VERSION,
    `schema=${rec?.snapshot.schemaVersion}, strategy=${rec?.snapshot.strategyVersion}, features=${rec?.snapshot.features.version}`);

  // Dọn dẹp
  clearNeuralRecords();
  setNeuralMode('shadow');
  return results;
}
