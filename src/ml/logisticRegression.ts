import {
  ExtractedFeatures,
  FeatureContribution,
  STRUCTURAL_FEATURE_LABELS,
  STRUCTURAL_FEATURE_NAMES,
} from './types';

function sigmoid(z: number): number {
  const clamped = Math.max(-30, Math.min(30, z));
  return 1 / (1 + Math.exp(-clamped));
}

export class LogisticRegressionModel {
  private weights: number[];
  private bias: number = 0;
  private readonly l2Lambda: number;
  private readonly learningRate: number;
  private readonly epochs: number;

  constructor(l2Lambda = 0.04, learningRate = 0.35, epochs = 320) {
    this.weights = new Array(STRUCTURAL_FEATURE_NAMES.length).fill(0);
    this.l2Lambda = l2Lambda;
    this.learningRate = learningRate;
    this.epochs = epochs;
  }

  public fit(samples: { features: ExtractedFeatures; label: 'phishing' | 'legitimate' }[]): void {
    const n = samples.length;
    if (n === 0) return;

    const numFeatures = STRUCTURAL_FEATURE_NAMES.length;
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      const gradW = new Array(numFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        const x = samples[i].features.structuralArray;
        const y = samples[i].label === 'phishing' ? 1 : 0;

        let z = this.bias;
        for (let j = 0; j < numFeatures; j++) {
          z += this.weights[j] * x[j];
        }
        const pred = sigmoid(z);
        const err = pred - y;

        gradB += err;
        for (let j = 0; j < numFeatures; j++) {
          gradW[j] += err * x[j];
        }
      }

      this.bias -= this.learningRate * (gradB / n);
      for (let j = 0; j < numFeatures; j++) {
        const reg = this.l2Lambda * this.weights[j];
        this.weights[j] -= this.learningRate * (gradW[j] / n + reg);
      }
    }
  }

  public predict(features: ExtractedFeatures): {
    phishingProbability: number;
    contributions: FeatureContribution[];
  } {
    const x = features.structuralArray;
    let z = this.bias;
    const contributions: FeatureContribution[] = [];

    for (let j = 0; j < x.length; j++) {
      const contrib = this.weights[j] * x[j];
      z += contrib;

      if (x[j] > 0.02 && Math.abs(contrib) > 0.08) {
        const fname = STRUCTURAL_FEATURE_NAMES[j];
        contributions.push({
          feature: STRUCTURAL_FEATURE_LABELS[fname],
          kind: 'structural',
          weight: contrib,
          direction: contrib >= 0 ? 'phishing' : 'legitimate',
          detail: `Value ${x[j].toFixed(2)} × weight ${this.weights[j] >= 0 ? '+' : ''}${this.weights[j].toFixed(2)}`,
        });
      }
    }

    contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    return {
      phishingProbability: sigmoid(z),
      contributions: contributions.slice(0, 6),
    };
  }

  public getWeights(): Record<string, number> {
    const out: Record<string, number> = {};
    STRUCTURAL_FEATURE_NAMES.forEach((name, idx) => {
      out[name] = this.weights[idx];
    });
    return out;
  }
}
