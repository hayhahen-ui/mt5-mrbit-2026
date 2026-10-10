/**
 * neural/contracts.ts — Hợp đồng dữ liệu cho tích hợp mạng nơ-ron (P0, shadow mode).
 * Ánh xạ từ docs/MRBIT_NEURAL_CODING_01.md §6.
 *
 * Quy tắc trung thực:
 * - Chưa có model → assessment.status = 'not_trained', mọi dự báo null.
 * - Snapshot bất biến sau khi tạo; diễn biến mới tạo bản ghi mới.
 * - Giá trị thiếu dùng null kèm lý do, không tự chuyển thành 0.
 */

export const SCHEMA_VERSION = '1.0';
export const STRATEGY_VERSION = 'nexus-rules-v1';
export const FEATURE_VERSION = 'features-v1';
export const EXECUTION_POLICY_VERSION = 'exec-3tier-tp-v1';

export type NeuralMode = 'off' | 'shadow';

export type AssessmentStatus =
  | 'disabled'
  | 'not_trained'
  | 'insufficient_data'
  | 'invalid_data'
  | 'incompatible_model'
  | 'ready'
  | 'error';

export interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  /** true = bắt buộc, thiếu thì assessment = insufficient_data */
  required: boolean;
}

/** Giá trị feature tại thời điểm cutoff, kèm mask thiếu */
export interface FeatureSet {
  version: string;
  values: Record<string, number | null>;
  /** id feature → lý do thiếu */
  missing: Record<string, string>;
  qualityFlags: string[];
}

export interface DataProvenance {
  source: string;        // 'Kraken' | 'Gold-API' | 'ER-API' | 'SIM' | 'OFFLINE'
  asOf: string;          // RFC3339 UTC — thời điểm chốt input
  availableAt: string;   // lúc app nhận được dữ liệu
  generatedAt: string;   // lúc tạo snapshot
  latencyMs: number;     // thời gian build feature + score (đo thực)
  warmup: string;        // '20/20'
}

/** Snapshot ứng viên setup — bất biến */
export interface SetupSnapshot {
  schemaVersion: string;
  setupId: string;
  dedupKey: string;
  dataOrigin: 'live_observed' | 'synthetic_fixture';
  venue: string;
  instrument: string;
  marketType: 'spot';
  side: 'long' | 'short';
  asOf: string;
  generatedAt: string;
  strategyVersion: string;
  executionPolicyVersion: string;
  rules: {
    eligibility: 'eligible' | 'blocked_news' | 'flat' | 'unknown';
    score: number | null;
    scoreKind: 'heuristic';
    components: { id: string; label: string; points: number; maxPoints: number; passed: boolean }[];
    blockReason?: string;
  };
  features: FeatureSet;
  plan: {
    entry: number;
    stop: number;
    tp1: number;
    tp2: number;
    tp3: number;
    suggestedLot: number;
  };
  provenance: DataProvenance;
}

/** Kết quả đánh giá của scorer */
export interface Assessment {
  status: AssessmentStatus;
  mode: NeuralMode;
  modelVersion: string | null;
  predictionAsOf: string;
  pNetPositive: number | null;
  expectedNetR: number | null;
  uncertainty: number | null;
  calibrationStatus: 'not_applicable' | 'not_evaluated' | string;
  reasonCodes: string[];
  featureVersion: string;
  latencyMs: number;
}

/** Bản ghi đầy đủ trong repository */
export interface NeuralRecord {
  snapshot: SetupSnapshot;
  assessment: Assessment;
  recordedAt: string;
}
