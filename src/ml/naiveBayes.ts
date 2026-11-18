import { ExtractedFeatures, FeatureContribution } from './types';

interface ClassStats {
  docCount: number;
  totalWeightedTerms: number;
  termCounts: Map<string, number>;
}

export class MultinomialNaiveBayes {
  private alpha: number;
  private byteNgramWeight: number;
  private vocab: Set<string> = new Set();
  private phishingStats: ClassStats = {
    docCount: 0,
    totalWeightedTerms: 0,
    termCounts: new Map(),
  };
  private legitStats: ClassStats = {
    docCount: 0,
    totalWeightedTerms: 0,
    termCounts: new Map(),
  };

  constructor(alpha = 1.0, byteNgramWeight = 0.65) {
    this.alpha = Math.max(0.05, alpha);
    this.byteNgramWeight = Math.max(0, byteNgramWeight);
  }

  public fit(samples: { features: ExtractedFeatures; label: 'phishing' | 'legitimate' }[]): void {
    this.vocab.clear();
    this.phishingStats = { docCount: 0, totalWeightedTerms: 0, termCounts: new Map() };
    this.legitStats = { docCount: 0, totalWeightedTerms: 0, termCounts: new Map() };

    for (const sample of samples) {
      const target = sample.label === 'phishing' ? this.phishingStats : this.legitStats;
      target.docCount += 1;

      for (const tok of sample.features.tokens) {
        const key = `t:${tok}`;
        this.vocab.add(key);
        target.termCounts.set(key, (target.termCounts.get(key) ?? 0) + 1);
        target.totalWeightedTerms += 1;
      }

      if (this.byteNgramWeight > 0) {
        for (const bg of sample.features.byteNgrams) {
          this.vocab.add(bg);
          target.termCounts.set(bg, (target.termCounts.get(bg) ?? 0) + this.byteNgramWeight);
          target.totalWeightedTerms += this.byteNgramWeight;
        }
      }
    }
  }

  public predict(features: ExtractedFeatures): {
    phishingProbability: number;
    logOdds: number;
    topContributions: FeatureContribution[];
    topTokenContributions: FeatureContribution[];
    topByteContributions: FeatureContribution[];
  } {
    const totalDocs = this.phishingStats.docCount + this.legitStats.docCount;
    if (totalDocs === 0 || this.vocab.size === 0) {
      return {
        phishingProbability: 0.5,
        logOdds: 0,
        topContributions: [],
        topTokenContributions: [],
        topByteContributions: [],
      };
    }

    const logPriorPhish = Math.log((this.phishingStats.docCount + 0.5) / (totalDocs + 1));
    const logPriorLegit = Math.log((this.legitStats.docCount + 0.5) / (totalDocs + 1));

    const vocabSize = this.vocab.size;
    const denomPhish = this.phishingStats.totalWeightedTerms + this.alpha * vocabSize;
    const denomLegit = this.legitStats.totalWeightedTerms + this.alpha * vocabSize;

    // Aggregate per-feature occurrences in this email
    const featureWeights = new Map<string, { count: number; kind: 'token' | 'byte_ngram'; display: string }>();
    for (const tok of features.tokens) {
      const key = `t:${tok}`;
      const existing = featureWeights.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        featureWeights.set(key, { count: 1, kind: 'token', display: tok });
      }
    }

    if (this.byteNgramWeight > 0) {
      for (const bg of features.byteNgrams) {
        const existing = featureWeights.get(bg);
        if (existing) {
          existing.count += this.byteNgramWeight;
        } else {
          featureWeights.set(bg, { count: this.byteNgramWeight, kind: 'byte_ngram', display: bg });
        }
      }
    }

    let logLikelihoodDiff = logPriorPhish - logPriorLegit;
    const contributions: FeatureContribution[] = [];

    for (const [key, entry] of featureWeights.entries()) {
      const phishCount = this.phishingStats.termCounts.get(key) ?? 0;
      const legitCount = this.legitStats.termCounts.get(key) ?? 0;

      if (phishCount === 0 && legitCount === 0) continue;

      const logPPhish = Math.log((phishCount + this.alpha) / denomPhish);
      const logPLegit = Math.log((legitCount + this.alpha) / denomLegit);
      const unitLogOdds = logPPhish - logPLegit;

      const effectiveCount = 1 + Math.log1p(entry.count - 1 > 0 ? entry.count - 1 : 0);
      const totalDelta = unitLogOdds * effectiveCount;
      logLikelihoodDiff += totalDelta;

      if (Math.abs(totalDelta) > 0.1) {
        contributions.push({
          feature: entry.display,
          kind: entry.kind,
          weight: totalDelta,
          direction: totalDelta >= 0 ? 'phishing' : 'legitimate',
          detail:
            entry.kind === 'byte_ngram'
              ? totalDelta >= 0
                ? 'Byte pattern often appears in phishing links or disguised words'
                : 'Byte pattern is common in normal business messages'
              : totalDelta >= 0
              ? 'Keyword frequently used in phishing requests'
              : 'Keyword commonly appears in safe emails',
        });
      }
    }

    const temperature = 0.22;
    const clampedLogit = Math.max(-24, Math.min(24, logLikelihoodDiff * temperature));
    const phishingProbability = 1 / (1 + Math.exp(-clampedLogit));

    contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    const topTokenContributions = contributions
      .filter((c) => c.kind === 'token')
      .slice(0, 6);
    const topByteContributions = contributions
      .filter((c) => c.kind === 'byte_ngram')
      .slice(0, 6);

    return {
      phishingProbability,
      logOdds: logLikelihoodDiff,
      topContributions: contributions.slice(0, 10),
      topTokenContributions,
      topByteContributions,
    };
  }
}
