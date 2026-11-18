import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import {
  AuthStatus,
  EmailLabel,
  EmailRecord,
  EvaluationMetrics,
  PipelineEvaluationSummary,
  TrainingConfig,
} from '../ml/types';

interface EvaluationLabViewProps {
  summary: PipelineEvaluationSummary;
  onThresholdChange: (threshold: number) => void;
  onOptimizeLowFpr: (maxFpr: number) => void;
  onRetrain: (config: TrainingConfig) => void;
  onResetDefaults: () => void;
  onAddCorpusRecord: (record: Omit<EmailRecord, 'id' | 'receivedAt'>) => void;
}

const ConfusionMatrixGrid: React.FC<{ metrics: EvaluationMetrics }> = ({ metrics }) => {
  const { tp, fp, tn, fn } = metrics.confusionMatrix;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold pl-text">{metrics.modelName}</span>
        <span className="font-mono tabular-nums pl-muted">
          Accuracy {(metrics.accuracy * 100).toFixed(1)}% · False Alarms{' '}
          <span
            className={
              metrics.falsePositiveRate === 0
                ? 'text-emerald-700 font-semibold'
                : 'text-amber-700 font-semibold'
            }
          >
            {(metrics.falsePositiveRate * 100).toFixed(1)}%
          </span>
        </span>
      </div>

      <div className="border pl-border rounded-md overflow-hidden font-mono tabular-nums text-xs">
        <div className="grid grid-cols-2 divide-x pl-border border-b pl-border">
          <div className="p-3 pl-surface">
            <div className="font-sans text-[11px] text-emerald-700 font-medium">
              Phishing Caught
            </div>
            <div className="text-xl font-bold pl-text mt-1">{tp}</div>
          </div>
          <div className="p-3 pl-surface">
            <div className="font-sans text-[11px] text-red-700 font-medium">
              False Alarms (Safe Flagged)
            </div>
            <div className="text-xl font-bold text-red-700 mt-1">{fp}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x pl-border">
          <div className="p-3 pl-subtle/60">
            <div className="font-sans text-[11px] text-amber-700 font-medium">
              Missed Phishing
            </div>
            <div className="text-xl font-bold text-amber-700 mt-1">{fn}</div>
          </div>
          <div className="p-3 pl-subtle/60">
            <div className="font-sans text-[11px] pl-muted font-medium">
              Safe Emails Cleared
            </div>
            <div className="text-xl font-bold pl-text mt-1">{tn}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EvaluationLabView: React.FC<EvaluationLabViewProps> = ({
  summary,
  onThresholdChange,
  onOptimizeLowFpr,
  onRetrain,
  onResetDefaults,
  onAddCorpusRecord,
}) => {
  const [draftConfig, setDraftConfig] = useState<TrainingConfig>(summary.config);
  const [retrainNotice, setRetrainNotice] = useState<string | null>(null);

  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newAuth, setNewAuth] = useState<AuthStatus>('fail');
  const [newLabel, setNewLabel] = useState<EmailLabel>('phishing');
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleAddedMsg, setSampleAddedMsg] = useState<string | null>(null);

  const ensembleMetrics = summary.metricsByModel.find((m) => m.modelId === 'ensemble')!;
  const nbMetrics = summary.metricsByModel.find((m) => m.modelId === 'naive_bayes')!;

  const handleApplyHyperparams = (e: React.FormEvent) => {
    e.preventDefault();
    onRetrain({
      ...draftConfig,
      decisionThreshold: summary.config.decisionThreshold,
    });
    setRetrainNotice('Models retrained with your updated settings.');
  };

  const handleReset = () => {
    onResetDefaults();
    setRetrainNotice('Restored default model settings.');
  };

  const handleAddSample = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim() || !newSubject.trim() || !newBody.trim()) {
      setSampleError('Please fill in the sender email, subject, and message text.');
      setSampleAddedMsg(null);
      return;
    }
    setSampleError(null);
    onAddCorpusRecord({
      senderName: newSenderEmail.split('@')[0] || 'Custom Sender',
      senderEmail: newSenderEmail.trim(),
      replyToEmail: newSenderEmail.trim(),
      subject: newSubject.trim(),
      body: newBody.trim(),
      spf: newAuth,
      dkim: newAuth,
      dmarc: newAuth,
      label: newLabel,
      category: newLabel === 'phishing' ? 'credential_harvest' : 'hard_negative_legit',
    });
    setNewSenderEmail('');
    setNewSubject('');
    setNewBody('');
    setSampleAddedMsg('Added your email example and retrained the models.');
  };

  return (
    <div className="space-y-6">
      {/* Threshold Calibration & Confusion Matrices */}
      <section className="pl-surface border pl-border rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b pl-border">
          <div>
            <h2 className="text-sm font-semibold pl-text">
              Sensitivity & False Alarm Controls
            </h2>
            <p className="text-xs pl-muted mt-0.5">
              Raise the risk cutoff to prevent blocking real emails, or pick a quick preset below
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onThresholdChange(0.5)}
              className="px-3 py-1.5 text-xs font-medium pl-text pl-subtle hover:opacity-85 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              Balanced (0.50)
            </button>
            <button
              type="button"
              onClick={() => onOptimizeLowFpr(0.02)}
              className="px-3 py-1.5 text-xs font-medium rounded-md pl-accent-bg hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Low False Alarms (≤ 2%)
            </button>
            <button
              type="button"
              onClick={() => onOptimizeLowFpr(0.0)}
              className="px-3 py-1.5 text-xs font-medium pl-text border pl-border hover:pl-subtle rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              Zero False Alarms (0%)
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <label htmlFor="threshold-slider" className="font-medium pl-text">
              Risk Cutoff (τ)
            </label>
            <span className="font-mono tabular-nums font-semibold pl-text">
              τ = {summary.config.decisionThreshold.toFixed(2)} (
              {(summary.config.decisionThreshold * 100).toFixed(0)}%)
            </span>
          </div>
          <input
            id="threshold-slider"
            type="range"
            min="0.20"
            max="0.90"
            step="0.01"
            value={summary.config.decisionThreshold}
            onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
            className="w-full accent-amber-800 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] pl-muted font-mono mt-1 whitespace-nowrap">
            <span>0.20 Catch More</span>
            <span>0.50 Balanced</span>
            <span>0.90 Fewer False Alarms</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t pl-border">
          <ConfusionMatrixGrid metrics={ensembleMetrics} />
          <ConfusionMatrixGrid metrics={nbMetrics} />
        </div>
      </section>

      {/* Hyperparameter Tuning & Add Corpus Sample */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 pl-surface border pl-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 pb-3 border-b pl-border">
            <div>
              <h3 className="text-sm font-semibold pl-text">
                Model Training Settings
              </h3>
              <p className="text-xs pl-muted mt-0.5">
                Tune Naive Bayes smoothing, byte weight, and how the three models vote together
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs pl-muted hover:pl-text whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          <form onSubmit={handleApplyHyperparams} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="alpha-input" className="block text-xs font-medium pl-text mb-1">
                  Smoothing (α)
                </label>
                <input
                  id="alpha-input"
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.05"
                  value={draftConfig.laplaceAlpha}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      laplaceAlpha: Math.max(0.1, parseFloat(e.target.value) || 0.85),
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                />
              </div>

              <div>
                <label htmlFor="byte-weight-input" className="block text-xs font-medium pl-text mb-1">
                  Byte Sequence Weight
                </label>
                <input
                  id="byte-weight-input"
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draftConfig.byteNgramWeight}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      byteNgramWeight: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                />
              </div>

              <div>
                <label htmlFor="split-ratio-input" className="block text-xs font-medium pl-text mb-1">
                  Test Share
                </label>
                <input
                  id="split-ratio-input"
                  type="number"
                  min="0.15"
                  max="0.50"
                  step="0.05"
                  value={draftConfig.testSplitRatio}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      testSplitRatio: Math.min(
                        0.5,
                        Math.max(0.15, parseFloat(e.target.value) || 0.35)
                      ),
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t pl-border">
              <div className="text-xs font-medium pl-text">
                Voting Weights for Combined Model
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="w-nb" className="block text-[11px] pl-muted mb-1">
                    Naive Bayes
                  </label>
                  <input
                    id="w-nb"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={draftConfig.weights.naiveBayes}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        weights: {
                          ...draftConfig.weights,
                          naiveBayes: Math.max(0, parseFloat(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="w-lr" className="block text-[11px] pl-muted mb-1">
                    Link Checker
                  </label>
                  <input
                    id="w-lr"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={draftConfig.weights.logisticRegression}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        weights: {
                          ...draftConfig.weights,
                          logisticRegression: Math.max(0, parseFloat(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="w-df" className="block text-[11px] pl-muted mb-1">
                    Rule Trees
                  </label>
                  <input
                    id="w-df"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={draftConfig.weights.decisionForest}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        weights: {
                          ...draftConfig.weights,
                          decisionForest: Math.max(0, parseFloat(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                  />
                </div>
              </div>
            </div>

            {retrainNotice && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{retrainNotice}</span>
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md pl-accent-bg hover:opacity-90 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retrain Models</span>
            </button>
          </form>
        </section>

        {/* Add Training Sample */}
        <section className="lg:col-span-6 pl-surface border pl-border rounded-lg p-5">
          <div className="pb-3 border-b pl-border">
            <h3 className="text-sm font-semibold pl-text">
              Add a New Training Example
            </h3>
            <p className="text-xs pl-muted mt-0.5">
              Teach the models with a new phishing or safe email ({summary.trainCount} training /{' '}
              {summary.testCount} testing)
            </p>
          </div>

          <form onSubmit={handleAddSample} className="mt-4 space-y-3" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label htmlFor="corpus-label" className="block text-xs font-medium pl-text mb-1">
                  Email Type
                </label>
                <select
                  id="corpus-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value as EmailLabel)}
                  className="w-full px-2.5 py-1.5 text-xs pl-text pl-surface border pl-border rounded-md"
                >
                  <option value="phishing">Phishing</option>
                  <option value="legitimate">Safe</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="corpus-auth" className="block text-xs font-medium pl-text mb-1">
                  Sender Checks
                </label>
                <select
                  id="corpus-auth"
                  value={newAuth}
                  onChange={(e) => setNewAuth(e.target.value as AuthStatus)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                >
                  <option value="fail">FAIL</option>
                  <option value="none">NONE</option>
                  <option value="pass">PASS</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="corpus-sender" className="block text-xs font-medium pl-text mb-1">
                  Sender Email
                </label>
                <input
                  id="corpus-sender"
                  type="email"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  placeholder="sender@domain.com"
                  className="w-full px-2.5 py-1.5 text-xs font-mono pl-text pl-surface border pl-border rounded-md"
                />
              </div>
            </div>

            <div>
              <label htmlFor="corpus-subject" className="block text-xs font-medium pl-text mb-1">
                Subject Line
              </label>
              <input
                id="corpus-subject"
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Subject line..."
                className="w-full px-3 py-1.5 text-xs pl-text pl-surface border pl-border rounded-md"
              />
            </div>

            <div>
              <label htmlFor="corpus-body" className="block text-xs font-medium pl-text mb-1">
                Message Text
              </label>
              <textarea
                id="corpus-body"
                rows={3}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Body text and links..."
                className="w-full px-3 py-1.5 text-xs pl-text pl-surface border pl-border rounded-md"
              />
            </div>

            {sampleError && (
              <div
                role="alert"
                className="flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{sampleError}</span>
              </div>
            )}

            {sampleAddedMsg && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{sampleAddedMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium pl-text border pl-border pl-surface hover:pl-subtle rounded-md whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Example & Retrain</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
