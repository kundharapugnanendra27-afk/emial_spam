import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_EMAIL_DATASET } from './dataset';
import { DEFAULT_TRAINING_CONFIG, PhishingEnsemblePipeline } from './ensemble';
import { extractByteNgrams, extractEmailFeatures } from './features';

test('feature extractor captures byte n-grams, IP URLs, and leetspeak obfuscation', () => {
  const phishFeatures = extractEmailFeatures({
    senderName: 'PayPal Support',
    senderEmail: 'alert@p4ypal-verify.xyz',
    replyToEmail: 'drop@external-mail.ru',
    subject: 'URGENT: Verify password now',
    body: 'Sign in at http://185.220.101.44/login?tok=%3D123 to unlock your account.',
    spf: 'fail',
    dkim: 'fail',
    dmarc: 'fail',
  });

  assert.equal(phishFeatures.structural.hasIpUrl, 1);
  assert.equal(phishFeatures.structural.domainMismatch, 1);
  assert.equal(phishFeatures.structural.authFailScore, 1);
  assert.ok(phishFeatures.structural.digitSubstitutionScore > 0);
  assert.ok(phishFeatures.byteNgrams.some((g) => g.includes('p4y') || g.includes('4yp')));
});

test('UTF-8 byte n-gram extractor captures non-ASCII homoglyph bytes', () => {
  const grams = extractByteNgrams('alert@mіcrosoft-support.com');
  assert.ok(grams.some((g) => g.startsWith('b3:utf8:') || g.startsWith('b4:utf8:')));
});

test('ensemble pipeline trains and outperforms or matches standalone Naive Bayes with low FPR', () => {
  const pipeline = new PhishingEnsemblePipeline(DEFAULT_TRAINING_CONFIG);
  const summary = pipeline.train(INITIAL_EMAIL_DATASET);

  const ensembleMetrics = summary.metricsByModel.find((m) => m.modelId === 'ensemble');
  const nbMetrics = summary.metricsByModel.find((m) => m.modelId === 'naive_bayes');

  assert.ok(ensembleMetrics);
  assert.ok(nbMetrics);

  assert.ok(
    ensembleMetrics.accuracy >= 0.9,
    `Expected ensemble accuracy >= 0.90, got ${ensembleMetrics.accuracy}`
  );
  assert.ok(
    ensembleMetrics.falsePositiveRate <= nbMetrics.falsePositiveRate,
    `Expected ensemble FPR (${ensembleMetrics.falsePositiveRate}) <= NB FPR (${nbMetrics.falsePositiveRate})`
  );
  assert.ok(
    ensembleMetrics.rocAuc >= 0.92,
    `Expected ensemble ROC-AUC >= 0.92, got ${ensembleMetrics.rocAuc}`
  );
});

test('ensemble clears authenticated legitimate IT security alert (hard negative)', () => {
  const pipeline = new PhishingEnsemblePipeline(DEFAULT_TRAINING_CONFIG);
  pipeline.train(INITIAL_EMAIL_DATASET);

  const result = pipeline.classify({
    senderName: 'Acme Corp IT',
    senderEmail: 'it-security@acmecorp.com',
    replyToEmail: 'it-security@acmecorp.com',
    subject: 'Reminder: Scheduled corporate password rotation policy (14 days)',
    body: 'Your Okta password expires in 14 days. Rotate it directly via your macOS Okta Verify app. Never click external links.',
    spf: 'pass',
    dkim: 'pass',
    dmarc: 'pass',
  });

  assert.equal(result.verdict, 'legitimate');
  assert.ok(result.phishingProbability < DEFAULT_TRAINING_CONFIG.decisionThreshold);
});

test('ensemble flags obfuscated phishing attack with explainable feature contributions', () => {
  const pipeline = new PhishingEnsemblePipeline(DEFAULT_TRAINING_CONFIG);
  pipeline.train(INITIAL_EMAIL_DATASET);

  const result = pipeline.classify({
    senderName: 'Microsoft Security',
    senderEmail: 'alert@micros0ft-auth.xyz',
    replyToEmail: 'harvest@mail-drop.ru',
    subject: 'URGENT: Account suspended in 24 hours — Verify password',
    body: 'Unauthorized sign-in detected. Verify your password immediately at http://194.26.135.12/signin',
    spf: 'fail',
    dkim: 'fail',
    dmarc: 'fail',
  });

  assert.equal(result.verdict, 'phishing');
  assert.ok(result.phishingProbability >= 0.75);
  assert.ok(result.topContributions.length > 0);
  assert.ok(result.explainability.summaryText.length > 10);
  assert.ok(result.explainability.topKeywords.length > 0);
  assert.ok(result.explainability.topByteSequences.length > 0);
  assert.ok(result.suspiciousSpans.length > 0);
});

test('threshold optimization finds threshold meeting strict max FPR target', () => {
  const pipeline = new PhishingEnsemblePipeline(DEFAULT_TRAINING_CONFIG);
  pipeline.train(INITIAL_EMAIL_DATASET);

  const optimalTau = pipeline.findOptimalThresholdForMaxFpr(0.02);
  pipeline.updateThreshold(optimalTau);
  const summary = pipeline.evaluate();
  const ens = summary.metricsByModel.find((m) => m.modelId === 'ensemble');

  assert.ok(ens);
  assert.ok(ens.falsePositiveRate <= 0.02);
});
