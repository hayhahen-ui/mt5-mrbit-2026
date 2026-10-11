/**
 * neural/trainedScorer.ts — Scorer dùng model thật (thay NotTrainedScorer).
 * Model v0: logistic regression (pNetPositive) + ridge (expectedNetR),
 * train bằng numpy trên dữ liệu thị trường thật (xem tools/ml/).
 * Inference chỉ là dot product + sigmoid — nhẹ, chạy được trên trình duyệt.
 *
 * Tương thích ngược: nếu weights không có/không hợp lệ → isTrainedModelAvailable()
 * trả false, observer dùng NotTrainedScorer như cũ.
 */
import { Assessment, NeuralMode, FEATURE_VERSION } from './contracts';
import { Scorer, ScorerInput } from './scorer';
// @ts-ignore — JSON weights do pipeline train sinh ra (tools/ml/model/neural_v0.json)
import WEIGHTS from '../../data/neuralWeights.json';

interface WeightsFile {
  modelVersion: string;
  featureVersion: string;
  features: string[];
  scaler: { mean: number[]; std: number[] };
  pNetPositive: { weights: number[]; bias: number };
  expectedNetR: { weights: number[]; bias: number };
}

function validWeights(w: any): w is WeightsFile {
  return !!w && typeof w.modelVersion === 'string'
    && Array.isArray(w.features) && w.features.length > 0
    && Array.isArray(w.scaler?.mean) && Array.isArray(w.scaler?.std)
    && Array.isArray(w.pNetPositive?.weights) && typeof w.pNetPositive?.bias === 'number'
    && Array.isArray(w.expectedNetR?.weights) && typeof w.expectedNetR?.bias === 'number'
    && w.scaler.mean.length === w.features.length
    && w.pNetPositive.weights.length === w.features.length
    && w.expectedNetR.weights.length === w.features.length;
}

export function isTrainedModelAvailable(): boolean {
  try {
    return validWeights(WEIGHTS);
  } catch {
    return false;
  }
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

export class TrainedScorer implements Scorer {
  readonly name = 'TrainedScorer';
  readonly modelVersion: string | null;

  private w: WeightsFile;

  constructor() {
    if (!validWeights(WEIGHTS)) throw new Error('Weights không hợp lệ.');
    this.w = WEIGHTS;
    this.modelVersion = WEIGHTS.modelVersion;
  }

  score(input: ScorerInput): Assessment {
    const asOf = input.predictionAsOf;
    const mode: NeuralMode = 'shadow'; // observer ghi đè theo mode thực tế
    const fail = (codes: string[]): Assessment => ({
      status: 'incompatible_model',
      mode,
      modelVersion: this.modelVersion,
      predictionAsOf: asOf,
      pNetPositive: null,
      expectedNetR: null,
      uncertainty: null,
      calibrationStatus: 'not_applicable',
      reasonCodes: codes,
      featureVersion: input.featureVersion,
      latencyMs: 0,
    });

    if (input.featureVersion !== this.w.featureVersion) {
      return fail(['FEATURE_VERSION_MISMATCH']);
    }
    const fv = input.features;
    if (!fv) return fail(['FEATURES_NOT_PROVIDED']);

    // Chuẩn hoá + dot product (khớp tools/ml/train.py)
    const xs: number[] = [];
    for (let i = 0; i < this.w.features.length; i++) {
      const id = this.w.features[i];
      const v = fv[id];
      if (typeof v !== 'number' || !isFinite(v)) return fail([`MISSING_FEATURE_${id}`]);
      const sd = this.w.scaler.std[i] || 1;
      xs.push((v - this.w.scaler.mean[i]) / sd);
    }
    const dot = (ws: number[], b: number) => {
      let s = b;
      for (let i = 0; i < ws.length; i++) s += ws[i] * xs[i];
      return s;
    };

    const p = sigmoid(dot(this.w.pNetPositive.weights, this.w.pNetPositive.bias));
    const expR = dot(this.w.expectedNetR.weights, this.w.expectedNetR.bias);
    // uncertainty: càng gần 0.5 càng không chắc (0 = chắc chắn, 1 = mù mờ)
    const uncertainty = Math.max(0, Math.min(1, 1 - 2 * Math.abs(p - 0.5)));

    return {
      status: 'ready',
      mode,
      modelVersion: this.modelVersion,
      predictionAsOf: asOf,
      pNetPositive: Math.round(p * 1000) / 1000,
      expectedNetR: Math.round(expR * 1000) / 1000,
      uncertainty: Math.round(uncertainty * 1000) / 1000,
      calibrationStatus: 'not_evaluated',
      reasonCodes: p >= 0.55 ? ['MODEL_BULLISH'] : p <= 0.45 ? ['MODEL_BEARISH'] : ['MODEL_NEUTRAL'],
      featureVersion: input.featureVersion,
      latencyMs: 0,
    };
  }
}
