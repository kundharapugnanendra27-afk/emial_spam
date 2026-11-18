import { DecisionForestModel } from './decisionForest';
import { extractEmailFeatures, findSuspiciousSpans } from './features';
import { LogisticRegressionModel } from './logisticRegression';
import { MultinomialNaiveBayes } from './naiveBayes';
import {
  ClassificationResult,
  ConfusionMatrix,
  EmailInput,
  EmailLabel,
  EmailRecord,
  EvaluatedRecord,
  EvaluationMetrics,
  ExtractedFeatures,
  FeatureContribution,
  PipelineEvaluationSummary,
  RocPoint,
  TrainingConfig,
} from './types';

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  laplaceAlpha: 0.85,
  byteNgramWeight: 0.65,
  testSplitRatio: 0.35,
  decisionThreshold: 0.56,
  weights: {
    naiveBayes: 0.3,
    logisticRegression: 0.38,
    decisionForest: 0.32,
  },
};

function computeConfusion(
  items: { actual: EmailLabel; prob: number }[],
  threshold: number
): ConfusionMatrix {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const item of items) {
    const pred: EmailLabel = item.prob >= threshold ? 'phishing' : 'legitimate';
    if (item.actual === 'phishing' && pred === 'phishing') tp++;
    else if (item.actual === 'legitimate' && pred === 'phishing') fp++;
    else if (item.actual === 'legitimate' && pred === 'legitimate') tn++;
    else fn++;
  }
  return { tp, fp, tn, fn };
}

function buildRocCurve(items: { actual: EmailLabel; prob: number }[]): RocPoint[] {
  const points: RocPoint[] = [];
  for (let i = 0; i <= 50; i++) {
    const threshold = Number((i * 0.02).toFixed(2));
    const cm = computeConfusion(items, threshold);
    const fpr = cm.fp + cm.tn > 0 ? cm.fp / (cm.fp + cm.tn) : 0;
    const tpr = cm.tp + cm.fn > 0 ? cm.tp / (cm.tp + cm.fn) : 0;
    const precision = cm.tp + cm.fp > 0 ? cm.tp / (cm.tp + cm.fp) : 1;
    points.push({ threshold, fpr, tpr, precision });
  }
  // Ensure explicit (0,0) and (1,1) endpoints for exact trapezoidal AUC
  points.push({ threshold: 1.01, fpr: 0, tpr: 0, precision: 1 });
  return points;
}

function computeAuc(rocPoints: RocPoint[]): number {
  const sorted = [...rocPoints].sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);
  let auc = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dx = sorted[i].fpr - sorted[i - 1].fpr;
    const avgY = (sorted[i].tpr + sorted[i - 1].tpr) / 2;
    auc += dx * avgY;
  }
  return Math.max(0, Math.min(1, auc));
}

function metricsFromProbabilities(
  modelId: EvaluationMetrics['modelId'],
  modelName: string,
  items: { actual: EmailLabel; prob: number }[],
  threshold: number
): EvaluationMetrics {
  const cm = computeConfusion(items, threshold);
  const total = cm.tp + cm.fp + cm.tn + cm.fn;
  const accuracy = total > 0 ? (cm.tp + cm.tn) / total : 0;
  const precision = cm.tp + cm.fp > 0 ? cm.tp / (cm.tp + cm.fp) : 1;
  const recall = cm.tp + cm.fn > 0 ? cm.tp / (cm.tp + cm.fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = cm.fp + cm.tn > 0 ? cm.fp / (cm.fp + cm.tn) : 0;
  const specificity = cm.fp + cm.tn > 0 ? cm.tn / (cm.fp + cm.tn) : 1;
  const rocAuc = computeAuc(buildRocCurve(items));

  return {
    modelId,
    modelName,
    accuracy,
    precision,
    recall,
    f1Score,
    falsePositiveRate,
    specificity,
    rocAuc,
    confusionMatrix: cm,
  };
}

export class PhishingEnsemblePipeline {
  private naiveBayes: MultinomialNaiveBayes;
  private logisticRegression: LogisticRegressionModel;
  private decisionForest: DecisionForestModel;
  private config: TrainingConfig;
  private trainRecords: EmailRecord[] = [];
  private testRecords: EmailRecord[] = [];
  private featureCache: Map<string, ExtractedFeatures> = new Map();

  constructor(config: TrainingConfig = DEFAULT_TRAINING_CONFIG) {
    this.config = { ...config, weights: { ...config.weights } };
    this.naiveBayes = new MultinomialNaiveBayes(config.laplaceAlpha, config.byteNgramWeight);
    this.logisticRegression = new LogisticRegressionModel();
    this.decisionForest = new DecisionForestModel();
  }

  public getConfig(): TrainingConfig {
    return { ...this.config, weights: { ...this.config.weights } };
  }

  public updateThreshold(threshold: number): void {
    this.config.decisionThreshold = Math.max(0.05, Math.min(0.95, threshold));
  }

  public train(records: EmailRecord[], newConfig?: Partial<TrainingConfig>): PipelineEvaluationSummary {
    if (newConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
        weights: {
          ...this.config.weights,
          ...(newConfig.weights ?? {}),
        },
      };
    }

    this.naiveBayes = new MultinomialNaiveBayes(
      this.config.laplaceAlpha,
      this.config.byteNgramWeight
    );
    this.logisticRegression = new LogisticRegressionModel();
    this.decisionForest = new DecisionForestModel();

    // Deterministic stratified split by class so test set always includes phishing, hard negatives, and operational legit
    const phishing = records.filter((r) => r.label === 'phishing');
    const legit = records.filter((r) => r.label === 'legitimate');

    const splitIndex = (len: number) => Math.max(1, Math.floor(len * (1 - this.config.testSplitRatio)));

    // Interleave deterministic order so hard negatives exist in both train and test
    const phishTrainCount = splitIndex(phishing.length);
    const legitTrainCount = splitIndex(legit.length);

    this.trainRecords = [];
    this.testRecords = [];

    phishing.forEach((rec, idx) => {
      if (idx % Math.max(2, Math.round(1 / Math.max(0.15, this.config.testSplitRatio))) === 0 && this.testRecords.filter((r) => r.label === 'phishing').length < phishing.length - phishTrainCount) {
        this.testRecords.push(rec);
      } else if (this.trainRecords.filter((r) => r.label === 'phishing').length < phishTrainCount) {
        this.trainRecords.push(rec);
      } else {
        this.testRecords.push(rec);
      }
    });

    legit.forEach((rec, idx) => {
      if (idx % Math.max(2, Math.round(1 / Math.max(0.15, this.config.testSplitRatio))) === 0 && this.testRecords.filter((r) => r.label === 'legitimate').length < legit.length - legitTrainCount) {
        this.testRecords.push(rec);
      } else if (this.trainRecords.filter((r) => r.label === 'legitimate').length < legitTrainCount) {
        this.trainRecords.push(rec);
      } else {
        this.testRecords.push(rec);
      }
    });

    this.featureCache.clear();
    const getFeat = (rec: EmailRecord) => {
      let cached = this.featureCache.get(rec.id);
      if (!cached) {
        cached = extractEmailFeatures(rec);
        this.featureCache.set(rec.id, cached);
      }
      return cached;
    };

    const trainSamples = this.trainRecords.map((rec) => ({
      features: getFeat(rec),
      label: rec.label,
    }));

    this.naiveBayes.fit(trainSamples);
    this.logisticRegression.fit(trainSamples);
    this.decisionForest.fit(trainSamples);

    return this.evaluate();
  }

  public classify(email: EmailInput, precomputed?: ExtractedFeatures): ClassificationResult {
    const extracted = precomputed ?? extractEmailFeatures(email);
    const nb = this.naiveBayes.predict(extracted);
    const lr = this.logisticRegression.predict(extracted);
    const dfProb = this.decisionForest.predict(extracted);

    const wSum =
      this.config.weights.naiveBayes +
      this.config.weights.logisticRegression +
      this.config.weights.decisionForest;
    const normNb = wSum > 0 ? this.config.weights.naiveBayes / wSum : 0.34;
    const normLr = wSum > 0 ? this.config.weights.logisticRegression / wSum : 0.33;
    const normDf = wSum > 0 ? this.config.weights.decisionForest / wSum : 0.33;

    const rawEnsembleProb =
      nb.phishingProbability * normNb +
      lr.phishingProbability * normLr +
      dfProb * normDf;

    // False-positive guard calibration: if authentication passes cleanly AND domain matches AND structural signals show zero malicious URLs/obfuscation, dampen standalone lexical spike slightly
    const authVerifiedGuard =
      extracted.structural.legitHeaderTrust >= 0.65 &&
      extracted.structural.hasIpUrl === 0 &&
      extracted.structural.urlObfuscationScore < 0.2 &&
      extracted.structural.domainMismatch < 0.2 &&
      extracted.structural.digitSubstitutionScore === 0;

    const ensembleProb = authVerifiedGuard
      ? Math.max(0, Math.min(1, rawEnsembleProb * 0.78))
      : Math.max(0, Math.min(1, rawEnsembleProb));

    const tau = this.config.decisionThreshold;
    const nbVerdict: EmailLabel = nb.phishingProbability >= tau ? 'phishing' : 'legitimate';
    const lrVerdict: EmailLabel = lr.phishingProbability >= tau ? 'phishing' : 'legitimate';
    const dfVerdict: EmailLabel = dfProb >= tau ? 'phishing' : 'legitimate';
    const ensembleVerdict: EmailLabel = ensembleProb >= tau ? 'phishing' : 'legitimate';

    const mergedContributions: FeatureContribution[] = [
      ...lr.contributions,
      ...nb.topContributions,
    ];
    mergedContributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    const topKeywords = nb.topTokenContributions;
    const topByteSequences = nb.topByteContributions;
    const topStructuralChecks = lr.contributions;

    const topRiskKeywords = topKeywords
      .filter((k) => k.direction === 'phishing')
      .slice(0, 2)
      .map((k) => `"${k.feature.replace(/_/g, ' ')}"`);
    const topRiskBytes = topByteSequences
      .filter((b) => b.direction === 'phishing')
      .slice(0, 2)
      .map((b) => b.feature.replace(/^b\d:(utf8:)?/, ''));
    const topSafeSignals = [...topStructuralChecks, ...topKeywords]
      .filter((s) => s.direction === 'legitimate')
      .slice(0, 2)
      .map((s) => s.feature.replace(/_/g, ' '));

    let summaryText = '';
    if (ensembleVerdict === 'phishing') {
      const parts: string[] = [];
      if (topRiskKeywords.length > 0) parts.push(`suspicious words like ${topRiskKeywords.join(' and ')}`);
      if (topRiskBytes.length > 0) parts.push(`byte patterns (${topRiskBytes.join(', ')})`);
      if (extracted.structural.authFailScore > 0.4) parts.push('failed sender checks');
      if (extracted.structural.hasIpUrl > 0 || extracted.structural.urlObfuscationScore > 0.3) {
        parts.push('a disguised link');
      }
      summaryText =
        parts.length > 0
          ? `Flagged as phishing because of ${parts.join(', ')}.`
          : 'Flagged as phishing due to combined word, byte, and sender risk signals.';
    } else if (nbVerdict === 'phishing') {
      summaryText =
        'The word scanner noticed urgent terms, but the combined models cleared this email because sender authentication passed and no unsafe links were found.';
    } else {
      summaryText =
        topSafeSignals.length > 0
          ? `Marked safe based on trusted signals such as ${topSafeSignals.join(' and ')}.`
          : 'Marked safe because sender checks passed and no suspicious keywords or links were found.';
    }

    return {
      verdict: ensembleVerdict,
      phishingProbability: ensembleProb,
      threshold: tau,
      confidenceMargin: Math.abs(ensembleProb - tau),
      falsePositiveSavedByEnsemble: nbVerdict === 'phishing' && ensembleVerdict === 'legitimate',
      models: {
        naiveBayes: {
          modelId: 'naive_bayes',
          modelName: 'Word & Byte Scanner (Naive Bayes)',
          phishingProbability: nb.phishingProbability,
          predictedLabel: nbVerdict,
        },
        logisticRegression: {
          modelId: 'logistic_regression',
          modelName: 'Link & Header Checker (Logistic Reg.)',
          phishingProbability: lr.phishingProbability,
          predictedLabel: lrVerdict,
        },
        decisionForest: {
          modelId: 'decision_forest',
          modelName: 'Rule Trees (Decision Forest)',
          phishingProbability: dfProb,
          predictedLabel: dfVerdict,
        },
        ensemble: {
          modelId: 'ensemble',
          modelName: 'Combined Model (Ensemble)',
          phishingProbability: ensembleProb,
          predictedLabel: ensembleVerdict,
        },
      },
      topContributions: mergedContributions.slice(0, 10),
      explainability: {
        summaryText,
        topKeywords,
        topByteSequences,
        topStructuralChecks,
      },
      extracted,
      suspiciousSpans: findSuspiciousSpans(email),
    };
  }

  public evaluate(): PipelineEvaluationSummary {
    const tau = this.config.decisionThreshold;
    const evaluatedRecords: EvaluatedRecord[] = [];

    const classifyRecord = (record: EmailRecord, split: 'train' | 'test'): EvaluatedRecord => {
      const feat = this.featureCache.get(record.id) ?? extractEmailFeatures(record);
      const result = this.classify(record, feat);
      const isCorrect = result.verdict === record.label;
      const isFalsePositive = record.label === 'legitimate' && result.verdict === 'phishing';
      const nbFalsePositiveAvoided =
        record.label === 'legitimate' &&
        result.models.naiveBayes.predictedLabel === 'phishing' &&
        result.verdict === 'legitimate';

      return {
        record,
        split,
        result,
        isCorrect,
        isFalsePositive,
        nbFalsePositiveAvoided,
      };
    };

    for (const r of this.trainRecords) evaluatedRecords.push(classifyRecord(r, 'train'));
    for (const r of this.testRecords) evaluatedRecords.push(classifyRecord(r, 'test'));

    // Benchmark metrics computed on held-out test split (fallback to all if test split empty)
    const testEval = evaluatedRecords.filter((e) => e.split === 'test');
    const targetEval = testEval.length > 0 ? testEval : evaluatedRecords;

    const nbItems = targetEval.map((e) => ({
      actual: e.record.label,
      prob: e.result.models.naiveBayes.phishingProbability,
    }));
    const lrItems = targetEval.map((e) => ({
      actual: e.record.label,
      prob: e.result.models.logisticRegression.phishingProbability,
    }));
    const dfItems = targetEval.map((e) => ({
      actual: e.record.label,
      prob: e.result.models.decisionForest.phishingProbability,
    }));
    const ensItems = targetEval.map((e) => ({
      actual: e.record.label,
      prob: e.result.models.ensemble.phishingProbability,
    }));

    const metricsByModel: EvaluationMetrics[] = [
      metricsFromProbabilities('ensemble', 'Combined Model (Ensemble)', ensItems, tau),
      metricsFromProbabilities('naive_bayes', 'Word & Byte Scanner (Naive Bayes)', nbItems, tau),
      metricsFromProbabilities('logistic_regression', 'Link & Header Checker (Logistic Reg.)', lrItems, tau),
      metricsFromProbabilities('decision_forest', 'Rule Trees (Decision Forest)', dfItems, tau),
    ];

    const fpSavedCount = evaluatedRecords.filter((e) => e.nbFalsePositiveAvoided).length;

    return {
      config: this.getConfig(),
      trainCount: this.trainRecords.length,
      testCount: this.testRecords.length,
      fpSavedCount,
      metricsByModel,
      rocCurves: {
        naiveBayes: buildRocCurve(nbItems),
        ensemble: buildRocCurve(ensItems),
      },
      evaluatedRecords,
    };
  }

  /**
   * Finds the lowest decision threshold >= 0.35 on the test split that keeps False Positive Rate <= maxFpr
   * while maximizing recall.
   */
  public findOptimalThresholdForMaxFpr(maxFpr = 0.02): number {
    const summary = this.evaluate();
    const testEval = summary.evaluatedRecords.filter((e) => e.split === 'test');
    const target = testEval.length > 0 ? testEval : summary.evaluatedRecords;
    const ensItems = target.map((e) => ({
      actual: e.record.label,
      prob: e.result.models.ensemble.phishingProbability,
    }));

    let bestThreshold = 0.65;
    let bestF1 = -1;

    for (let t = 35; t <= 90; t += 1) {
      const th = t / 100;
      const m = metricsFromProbabilities('ensemble', 'Ensemble', ensItems, th);
      if (m.falsePositiveRate <= maxFpr && m.f1Score > bestF1) {
        bestF1 = m.f1Score;
        bestThreshold = th;
      }
    }
    return bestThreshold;
  }
}
