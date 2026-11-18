import React from 'react';
import { ArrowRight, CheckCircle2, Compass, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { PipelineEvaluationSummary } from '../ml/types';
import { RocChart } from './RocChart';

interface OverviewViewProps {
  summary: PipelineEvaluationSummary;
  onNavigate: (tab: 'inspector' | 'queue' | 'evaluation') => void;
  onInspectEmail: (emailId: string) => void;
  onStartTour: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  onNavigate,
  onInspectEmail,
  onStartTour,
}) => {
  const ensemble = summary.metricsByModel.find((m) => m.modelId === 'ensemble')!;
  const naiveBayes = summary.metricsByModel.find((m) => m.modelId === 'naive_bayes')!;

  const fprDeltaPts = (naiveBayes.falsePositiveRate - ensemble.falsePositiveRate) * 100;
  const savedExamples = summary.evaluatedRecords.filter((e) => e.nbFalsePositiveAvoided);

  return (
    <div className="space-y-6">
      {/* Simple Plain-English Intro Strip */}
      <div className="pl-surface border pl-border rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold pl-text">
            Smart Phishing Protection with Fewer False Alarms
          </h2>
          <p className="text-xs pl-muted mt-1 leading-relaxed">
            This system scans email words and byte sequences using Naive Bayes, then double-checks sender headers and links with an Ensemble of models so safe messages are not blocked by mistake.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartTour}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border pl-border pl-subtle pl-text hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 pl-accent-text" aria-hidden="true" />
          <span>Start Demo Tour</span>
        </button>
      </div>

      {/* KPI Strip */}
      <section aria-label="Key Model Results" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="pl-surface border pl-border rounded-lg p-5">
          <div className="text-xs font-medium pl-muted">Overall Accuracy</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight pl-text font-mono tabular-nums">
              {(ensemble.accuracy * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-emerald-700 font-medium tabular-nums">
              F1 {(ensemble.f1Score * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-xs pl-muted">
            Tested on {summary.testCount} unseen emails
          </div>
        </div>

        <div className="pl-surface border pl-border rounded-lg p-5">
          <div className="text-xs font-medium pl-muted">False Alarm Rate</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight pl-text font-mono tabular-nums">
              {(ensemble.falsePositiveRate * 100).toFixed(1)}%
            </span>
            <span className="text-xs pl-muted font-mono tabular-nums">
              Naive Bayes {(naiveBayes.falsePositiveRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-xs pl-muted">
            {fprDeltaPts > 0
              ? `${fprDeltaPts.toFixed(1)}% fewer false alarms than Naive Bayes alone`
              : `${ensemble.confusionMatrix.fp} safe emails flagged at cutoff ${summary.config.decisionThreshold.toFixed(2)}`}
          </div>
        </div>

        <div className="pl-surface border pl-border rounded-lg p-5">
          <div className="text-xs font-medium pl-muted">Detection Score (ROC-AUC)</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight pl-text font-mono tabular-nums">
              {ensemble.rocAuc.toFixed(3)}
            </span>
            <span className="text-xs pl-muted font-mono tabular-nums">
              Caught {(ensemble.recall * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-xs pl-muted">
            Combines words, byte patterns, and sender checks
          </div>
        </div>

        <div className="pl-surface border pl-border rounded-lg p-5">
          <div className="text-xs font-medium pl-muted">False Alarms Prevented</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight pl-text font-mono tabular-nums">
              {summary.fpSavedCount}
            </span>
            <span className="text-xs pl-muted tabular-nums">
              Out of {summary.evaluatedRecords.length} emails
            </span>
          </div>
          <div className="mt-2 text-xs pl-muted">
            Real alerts cleared safely by the combined models
          </div>
        </div>
      </section>

      {/* Primary Split: ROC Chart + Model Benchmark Table */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 pl-surface border pl-border rounded-lg p-5">
          <RocChart
            ensemblePoints={summary.rocCurves.ensemble}
            naiveBayesPoints={summary.rocCurves.naiveBayes}
            currentThreshold={summary.config.decisionThreshold}
            ensembleAuc={ensemble.rocAuc}
            naiveBayesAuc={naiveBayes.rocAuc}
          />
        </div>

        <div className="lg:col-span-7 pl-surface border pl-border rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b pl-border">
            <div>
              <h3 className="text-sm font-semibold pl-text">
                How Each Machine Learning Model Performed
              </h3>
              <p className="text-xs pl-muted mt-0.5">
                Risk cutoff {summary.config.decisionThreshold.toFixed(2)} · Smoothing{' '}
                {summary.config.laplaceAlpha.toFixed(2)} · Byte weight{' '}
                {summary.config.byteNgramWeight.toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('evaluation')}
              className="inline-flex items-center gap-1.5 text-xs font-medium pl-accent-text hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Adjust Sensitivity</span>
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b pl-border pl-muted">
                  <th className="py-2.5 pr-3 font-medium">Model</th>
                  <th className="py-2.5 px-2 font-medium text-right">Accuracy</th>
                  <th className="py-2.5 px-2 font-medium text-right">Precision</th>
                  <th className="py-2.5 px-2 font-medium text-right">Caught</th>
                  <th className="py-2.5 px-2 font-medium text-right">F1</th>
                  <th className="py-2.5 px-2 font-medium text-right">False Alarms</th>
                  <th className="py-2.5 pl-2 font-medium text-right">AUC</th>
                </tr>
              </thead>
              <tbody className="divide-y pl-border font-mono tabular-nums">
                {summary.metricsByModel.map((m) => {
                  const isEnsemble = m.modelId === 'ensemble';
                  return (
                    <tr
                      key={m.modelId}
                      className={isEnsemble ? 'pl-subtle font-medium pl-text' : 'pl-text'}
                    >
                      <td className="py-3 pr-3 font-sans">
                        <span className={isEnsemble ? 'font-semibold pl-text' : 'pl-text'}>
                          {m.modelName}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">{(m.accuracy * 100).toFixed(1)}%</td>
                      <td className="py-3 px-2 text-right">{(m.precision * 100).toFixed(1)}%</td>
                      <td className="py-3 px-2 text-right">{(m.recall * 100).toFixed(1)}%</td>
                      <td className="py-3 px-2 text-right">{(m.f1Score * 100).toFixed(1)}%</td>
                      <td
                        className={`py-3 px-2 text-right ${
                          m.falsePositiveRate === 0
                            ? 'text-emerald-700 font-semibold'
                            : m.falsePositiveRate > 0.08
                            ? 'text-amber-700'
                            : 'pl-text'
                        }`}
                      >
                        {(m.falsePositiveRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 pl-2 text-right">{m.rocAuc.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t pl-border flex flex-wrap items-center justify-between gap-3 text-xs pl-muted">
            <span>
              Model voting mix: Naive Bayes {(summary.config.weights.naiveBayes * 100).toFixed(0)}% ·
              Link Checker {(summary.config.weights.logisticRegression * 100).toFixed(0)}% ·
              Rule Trees {(summary.config.weights.decisionForest * 100).toFixed(0)}%
            </span>
            <button
              type="button"
              onClick={() => onNavigate('inspector')}
              className="inline-flex items-center gap-1.5 font-medium pl-text hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Check Your Own Email</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* False Alarms Prevented */}
      <section className="pl-surface border pl-border rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b pl-border">
          <div>
            <h3 className="text-sm font-semibold pl-text">
              Safe Emails Protected from False Alarms
            </h3>
            <p className="text-xs pl-muted mt-0.5">
              Important real emails that Naive Bayes flagged by mistake, but the Combined Model let through safely
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('queue')}
            className="text-xs font-medium pl-accent-text hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            See All {summary.evaluatedRecords.length} Emails
          </button>
        </div>

        {savedExamples.length === 0 ? (
          <div className="py-6 text-xs pl-muted flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                At the current cutoff ({summary.config.decisionThreshold.toFixed(2)}), both models pass safe emails cleanly. Test an email in the Live Inspector to see how each word is scored.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inspector')}
              className="px-3 py-1.5 text-xs font-medium rounded-md pl-accent-bg whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Inspector
            </button>
          </div>
        ) : (
          <div className="mt-3 divide-y pl-border">
            {savedExamples.slice(0, 4).map((item) => (
              <div
                key={item.record.id}
                className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs pl-muted">
                    <span className="font-mono pl-text">{item.record.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{item.record.senderEmail}</span>
                    <span aria-hidden="true">·</span>
                    <span>SPF {item.record.spf.toUpperCase()} / DKIM {item.record.dkim.toUpperCase()}</span>
                  </div>
                  <div className="text-sm font-medium pl-text mt-0.5 truncate">
                    {item.record.subject}
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0 font-mono text-xs tabular-nums">
                  <div className="text-right">
                    <div className="pl-muted font-sans text-[11px]">Naive Bayes</div>
                    <div className="text-amber-700 font-semibold inline-flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                      {(item.result.models.naiveBayes.phishingProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="pl-muted font-sans text-[11px]">Combined</div>
                    <div className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {(item.result.phishingProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectEmail(item.record.id)}
                    className="px-3 py-1.5 font-sans text-xs font-medium pl-text border pl-border rounded-md hover:pl-subtle whitespace-nowrap cursor-pointer"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
