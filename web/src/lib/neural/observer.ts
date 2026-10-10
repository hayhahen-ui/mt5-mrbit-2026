import {
  NeuralMode, SetupSnapshot, Assessment, NeuralRecord,
  SCHEMA_VERSION, STRATEGY_VERSION, EXECUTION_POLICY_VERSION, DataProvenance,
} from './contracts';
import { buildFeatures, hasMissingRequired, RawFeatureInputs } from './features';
import { NotTrainedScorer, insufficientDataAssessment } from './scorer';
import { saveNeuralRecord } from './repository';

/**
 * neural/observer.ts — Điều phối shadow (skill §8: handle_candidate).
 * - mode 'off': kết thúc ngay, không làm gì (T01).
 * - mode 'shadow': quan sát + ghi assessment, KHÔNG gọi order router.
 * - Mọi lỗi được bắt và ghi thành assessment 'error' — không chặn luồng tín hiệu gốc.
 */

const MODE_KEY = 'nexuspilot-neural-mode';

export function getNeuralMode(): NeuralMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'off' ? 'off' : 'shadow'; // mặc định: shadow (chế độ đầu tiên theo skill)
  } catch {
    return 'shadow';
  }
}

export function setNeuralMode(mode: NeuralMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch { /* noop */ }
}

export interface CandidateInput {
  symbol: string;
  direction: 'BUY' | 'SELL';
  engine: string;
  engineName: string;
  ruleScore: number | null;
  ruleComponents: { id: string; label: string; points: number; maxPoints: number; passed: boolean }[];
  eligibility: 'eligible' | 'blocked_news' | 'flat' | 'unknown';
  blockReason?: string;
  plan: { entry: number; stop: number; tp1: number; tp2: number; tp3: number; suggestedLot: number };
  rawFeatures: RawFeatureInputs;
  provenance: Omit<DataProvenance, 'generatedAt' | 'latencyMs'>;
  dataOrigin: 'live_observed' | 'synthetic_fixture';
}

export interface ObserveResult {
  record: NeuralRecord | null;
  assessment: Assessment | null;
  deduped: boolean;
}

const scorer = new NotTrainedScorer();

/** Dedup key ổn định: strategy + mã + hướng + engine + bucket phút trigger */
function makeDedupKey(c: CandidateInput, asOf: string): string {
  const bucket = asOf.slice(0, 16); // YYYY-MM-DDTHH:MM
  return [STRATEGY_VERSION, c.symbol, c.direction, c.engine, bucket].join(':');
}

export function observeCandidate(candidate: CandidateInput): ObserveResult {
  const mode = getNeuralMode();
  if (mode === 'off') return { record: null, assessment: null, deduped: false };

  const t0 = performance.now();
  try {
    const asOf = new Date().toISOString();
    const dedupKey = makeDedupKey(candidate, asOf);
    const setupId = `setup-${dedupKey}`;

    const featureSet = buildFeatures(candidate.rawFeatures);

    let assessment: Assessment;
    if (hasMissingRequired(featureSet)) {
      assessment = insufficientDataAssessment(mode, asOf, featureSet.version, featureSet.missing);
    } else {
      assessment = scorer.score({ setupId, featureVersion: featureSet.version, predictionAsOf: asOf });
      assessment.mode = mode;
    }
    assessment.latencyMs = Math.round((performance.now() - t0) * 10) / 10;

    const snapshot: SetupSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      setupId,
      dedupKey,
      dataOrigin: candidate.dataOrigin,
      venue: candidate.provenance.source,
      instrument: candidate.symbol,
      marketType: 'spot',
      side: candidate.direction === 'BUY' ? 'long' : 'short',
      asOf,
      generatedAt: asOf,
      strategyVersion: STRATEGY_VERSION,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      rules: {
        eligibility: candidate.eligibility,
        score: candidate.ruleScore,
        scoreKind: 'heuristic',
        components: candidate.ruleComponents,
        blockReason: candidate.blockReason,
      },
      features: featureSet,
      plan: { ...candidate.plan },
      provenance: {
        ...candidate.provenance,
        generatedAt: asOf,
        latencyMs: assessment.latencyMs,
      },
    };

    const record: NeuralRecord = { snapshot, assessment, recordedAt: asOf };
    const saved = saveNeuralRecord(record);
    return { record: saved ? record : null, assessment, deduped: !saved };
  } catch (err) {
    // Scorer/persistence lỗi → assessment error, không chặn engine gốc (T08)
    const asOf = new Date().toISOString();
    const assessment: Assessment = {
      status: 'error',
      mode,
      modelVersion: null,
      predictionAsOf: asOf,
      pNetPositive: null,
      expectedNetR: null,
      uncertainty: null,
      calibrationStatus: 'not_applicable',
      reasonCodes: ['OBSERVER_EXCEPTION', String(err).slice(0, 120)],
      featureVersion: 'unknown',
      latencyMs: Math.round((performance.now() - t0) * 10) / 10,
    };
    return { record: null, assessment, deduped: false };
  }
}

/** Trạng thái tóm tắt cho UI */
export function neuralStatusText(assessment: Assessment | null, mode: NeuralMode): string {
  if (mode === 'off') return 'Đang tắt';
  if (!assessment) return 'Chưa có đánh giá';
  switch (assessment.status) {
    case 'not_trained': return 'Chưa huấn luyện';
    case 'insufficient_data': return 'Thiếu dữ liệu';
    case 'invalid_data': return 'Lỗi dữ liệu';
    case 'incompatible_model': return 'Model không tương thích';
    case 'ready': return 'Sẵn sàng';
    case 'error': return 'Lỗi quan sát';
    default: return assessment.status;
  }
}
