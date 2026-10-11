import { Assessment, NeuralMode } from './contracts';

/**
 * neural/scorer.ts — Hợp đồng scorer + NotTrainedScorer.
 * Scorer KHÔNG có khả năng gọi order API (skill §8).
 * Chưa có artifact mô hình → status 'not_trained', mọi dự báo null.
 */

export interface ScorerInput {
  setupId: string;
  featureVersion: string;
  predictionAsOf: string;
  /** Giá trị feature đã chuẩn bị (TrainedScorer dùng; NotTrainedScorer bỏ qua). */
  features?: Record<string, number | null>;
}

export interface Scorer {
  readonly name: string;
  readonly modelVersion: string | null;
  score(input: ScorerInput): Assessment;
}

export class NotTrainedScorer implements Scorer {
  readonly name = 'NotTrainedScorer';
  readonly modelVersion: string | null = null;

  score(input: ScorerInput): Assessment {
    return {
      status: 'not_trained',
      mode: 'shadow',
      modelVersion: null,
      predictionAsOf: input.predictionAsOf,
      pNetPositive: null,
      expectedNetR: null,
      uncertainty: null,
      calibrationStatus: 'not_applicable',
      reasonCodes: ['MODEL_NOT_AVAILABLE'],
      featureVersion: input.featureVersion,
      latencyMs: 0,
    };
  }
}

/**
 * Scorer dự phòng khi dữ liệu không đủ — tách khỏi not_trained để UI
 * hiển thị đúng nguyên nhân (skill §8: thứ tự ưu tiên lỗi thống nhất).
 */
export function insufficientDataAssessment(
  mode: NeuralMode,
  predictionAsOf: string,
  featureVersion: string,
  missing: Record<string, string>
): Assessment {
  return {
    status: 'insufficient_data',
    mode,
    modelVersion: null,
    predictionAsOf,
    pNetPositive: null,
    expectedNetR: null,
    uncertainty: null,
    calibrationStatus: 'not_applicable',
    reasonCodes: ['MISSING_REQUIRED_FEATURES', ...Object.keys(missing).map((k) => `MISSING_${k.toUpperCase()}`)],
    featureVersion,
    latencyMs: 0,
  };
}
