export type EmailLabel = 'phishing' | 'legitimate';

export type AuthStatus = 'pass' | 'fail' | 'none';

export interface EmailRecord {
  id: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  subject: string;
  body: string;
  spf: AuthStatus;
  dkim: AuthStatus;
  dmarc: AuthStatus;
  receivedAt: string;
  label: EmailLabel;
  category:
    | 'credential_harvest'
    | 'spear_phishing'
    | 'byte_obfuscation'
    | 'invoice_fraud'
    | 'hard_negative_legit'
    | 'operational_legit';
  notes?: string;
}

export interface EmailInput {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  subject: string;
  body: string;
  spf: AuthStatus;
  dkim: AuthStatus;
  dmarc: AuthStatus;
}

export interface StructuralFeatureVector {
  hasIpUrl: number;
  suspiciousTldRatio: number;
  urlCountNorm: number;
  urlObfuscationScore: number;
  domainMismatch: number;
  authFailScore: number;
  urgencyDensity: number;
  credentialAskDensity: number;
  uppercaseRatio: number;
  nonAsciiByteRatio: number;
  digitSubstitutionScore: number;
  htmlOrScriptSignal: number;
  byteEntropyNorm: number;
  legitHeaderTrust: number;
}

export const STRUCTURAL_FEATURE_NAMES: (keyof StructuralFeatureVector)[] = [
  'hasIpUrl',
  'suspiciousTldRatio',
  'urlCountNorm',
  'urlObfuscationScore',
  'domainMismatch',
  'authFailScore',
  'urgencyDensity',
  'credentialAskDensity',
  'uppercaseRatio',
  'nonAsciiByteRatio',
  'digitSubstitutionScore',
  'htmlOrScriptSignal',
  'byteEntropyNorm',
  'legitHeaderTrust',
];

export const STRUCTURAL_FEATURE_LABELS: Record<keyof StructuralFeatureVector, string> = {
  hasIpUrl: 'IPv4 Literal URL',
  suspiciousTldRatio: 'High-Risk TLD Ratio',
  urlCountNorm: 'External Link Density',
  urlObfuscationScore: 'URL Obfuscation & Encoding',
  domainMismatch: 'Sender / Reply-To Mismatch',
  authFailScore: 'SPF / DKIM / DMARC Failure',
  urgencyDensity: 'Urgency & Coercion Lexicon',
  credentialAskDensity: 'Credential / Wire Request Terms',
  uppercaseRatio: 'Uppercase Shouting Ratio',
  nonAsciiByteRatio: 'Non-ASCII / Homoglyph Bytes',
  digitSubstitutionScore: 'Leetspeak Digit Substitution',
  htmlOrScriptSignal: 'HTML Form / Script Payload',
  byteEntropyNorm: 'URL & Payload Byte Entropy',
  legitHeaderTrust: 'Authenticated Domain Trust',
};

export interface ExtractedFeatures {
  tokens: string[];
  byteNgrams: string[];
  urls: string[];
  structural: StructuralFeatureVector;
  structuralArray: number[];
  byteLength: number;
}

export interface FeatureContribution {
  feature: string;
  kind: 'byte_ngram' | 'token' | 'structural';
  weight: number;
  direction: 'phishing' | 'legitimate';
  detail: string;
}

export interface SingleModelScore {
  modelId: 'naive_bayes' | 'logistic_regression' | 'decision_forest' | 'ensemble';
  modelName: string;
  phishingProbability: number;
  predictedLabel: EmailLabel;
}

export interface ClassificationResult {
  verdict: EmailLabel;
  phishingProbability: number;
  threshold: number;
  confidenceMargin: number;
  falsePositiveSavedByEnsemble: boolean;
  models: {
    naiveBayes: SingleModelScore;
    logisticRegression: SingleModelScore;
    decisionForest: SingleModelScore;
    ensemble: SingleModelScore;
  };
  topContributions: FeatureContribution[];
  explainability: {
    summaryText: string;
    topKeywords: FeatureContribution[];
    topByteSequences: FeatureContribution[];
    topStructuralChecks: FeatureContribution[];
  };
  extracted: ExtractedFeatures;
  suspiciousSpans: string[];
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface EvaluationMetrics {
  modelId: 'naive_bayes' | 'logistic_regression' | 'decision_forest' | 'ensemble';
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  specificity: number;
  rocAuc: number;
  confusionMatrix: ConfusionMatrix;
}

export interface RocPoint {
  threshold: number;
  fpr: number;
  tpr: number;
  precision: number;
}

export interface TrainingConfig {
  laplaceAlpha: number;
  byteNgramWeight: number;
  testSplitRatio: number;
  decisionThreshold: number;
  weights: {
    naiveBayes: number;
    logisticRegression: number;
    decisionForest: number;
  };
}

export interface EvaluatedRecord {
  record: EmailRecord;
  split: 'train' | 'test';
  result: ClassificationResult;
  isCorrect: boolean;
  isFalsePositive: boolean;
  nbFalsePositiveAvoided: boolean;
}

export interface PipelineEvaluationSummary {
  config: TrainingConfig;
  trainCount: number;
  testCount: number;
  fpSavedCount: number;
  metricsByModel: EvaluationMetrics[];
  rocCurves: {
    naiveBayes: RocPoint[];
    ensemble: RocPoint[];
  };
  evaluatedRecords: EvaluatedRecord[];
}
