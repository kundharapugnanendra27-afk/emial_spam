import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  FileSearch,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  Type,
} from 'lucide-react';
import {
  AuthStatus,
  ClassificationResult,
  EmailInput,
  FeatureContribution,
  STRUCTURAL_FEATURE_LABELS,
  STRUCTURAL_FEATURE_NAMES,
} from '../ml/types';

interface InspectorViewProps {
  initialEmail: EmailInput;
  initialResult: ClassificationResult;
  onClassify: (input: EmailInput) => ClassificationResult;
}

export const INSPECTOR_PRESETS: { id: string; label: string; input: EmailInput }[] = [
  {
    id: 'byte_phish',
    label: 'Disguised Phishing Link',
    input: {
      senderName: 'PayPal Security Desk',
      senderEmail: 'verify@p4ypal-account-alert.xyz',
      replyToEmail: 'drop-inbox@secure-claim.ru',
      subject: 'URGENT: Account suspended within 24 hours — Verify credentials',
      body: 'We noticed unauthorized login activity on your PayPal wallet. Confirm your identity and password immediately at http://185.220.101.44/p4ypal/signin?tok=%3D9921 to prevent permanent freeze.',
      spf: 'fail',
      dkim: 'fail',
      dmarc: 'fail',
    },
  },
  {
    id: 'bec_wire',
    label: 'Fake CEO Wire Request',
    input: {
      senderName: 'David Mercer (CEO)',
      senderEmail: 'david.mercer.exec@gmail.com',
      replyToEmail: 'private-desk@proton-mail-box.top',
      subject: 'Confidential urgent wire transfer needed before 3 PM',
      body: 'Are you at your desk? I am stuck in an off-site board meeting. Please process an urgent wire transfer of $28,500 to our acquisition counsel and reply with the bank routing confirmation immediately.',
      spf: 'none',
      dkim: 'none',
      dmarc: 'fail',
    },
  },
  {
    id: 'hard_neg',
    label: 'Safe IT Password Alert',
    input: {
      senderName: 'Acme Corp IT Security',
      senderEmail: 'it-security@acmecorp.com',
      replyToEmail: 'it-security@acmecorp.com',
      subject: 'Reminder: Scheduled corporate password rotation policy (14 days)',
      body: 'Hello team, as part of our annual SOC 2 compliance cycle, your corporate Okta password will expire in 14 days. Rotate it directly inside your local Okta Verify app or System Settings. Never click external links for password resets.',
      spf: 'pass',
      dkim: 'pass',
      dmarc: 'pass',
    },
  },
];

const ContributionList: React.FC<{
  items: FeatureContribution[];
  emptyMessage: string;
  formatLabel?: (raw: string) => string;
}> = ({ items, emptyMessage, formatLabel }) => {
  if (items.length === 0) {
    return <p className="text-xs pl-muted py-3">{emptyMessage}</p>;
  }

  const maxAbs = Math.max(0.5, ...items.map((i) => Math.abs(i.weight)));

  return (
    <div className="space-y-2.5 mt-2">
      {items.map((item, idx) => {
        const isRisk = item.direction === 'phishing';
        const pct = Math.min(100, Math.max(8, (Math.abs(item.weight) / maxAbs) * 100));
        const label = formatLabel ? formatLabel(item.feature) : item.feature;
        return (
          <div key={`${item.feature}-${idx}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono font-medium pl-text truncate" title={item.feature}>
                {label}
              </span>
              <span
                className={`font-mono tabular-nums shrink-0 font-medium ${
                  isRisk ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {item.weight >= 0 ? '+' : ''}
                {item.weight.toFixed(2)} · {isRisk ? 'Risk' : 'Safe'}
              </span>
            </div>
            <div className="h-1.5 w-full pl-subtle rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm ${isRisk ? 'bg-red-600' : 'bg-emerald-700'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[11px] pl-muted">{item.detail}</div>
          </div>
        );
      })}
    </div>
  );
};

export const InspectorView: React.FC<InspectorViewProps> = ({
  initialEmail,
  initialResult,
  onClassify,
}) => {
  const [form, setForm] = useState<EmailInput>(initialEmail);
  const [result, setResult] = useState<ClassificationResult>(initialResult);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialEmail);
    setResult(initialResult);
    setValidationError(null);
  }, [initialEmail, initialResult]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senderEmail.trim()) {
      setValidationError('Please enter a sender email address before checking.');
      return;
    }
    if (!form.subject.trim() && !form.body.trim()) {
      setValidationError('Please enter a subject line or email body to check.');
      return;
    }
    setValidationError(null);
    const next = onClassify(form);
    setResult(next);
  };

  const applyPreset = (presetInput: EmailInput) => {
    setForm(presetInput);
    setValidationError(null);
    setResult(onClassify(presetInput));
  };

  const handleClear = () => {
    setForm({
      senderName: '',
      senderEmail: '',
      replyToEmail: '',
      subject: '',
      body: '',
      spf: 'pass',
      dkim: 'pass',
      dmarc: 'pass',
    });
    setValidationError(null);
  };

  const isPhishing = result.verdict === 'phishing';
  const modelList = [
    result.models.ensemble,
    result.models.naiveBayes,
    result.models.logisticRegression,
    result.models.decisionForest,
  ];

  const formatByteLabel = (raw: string) => {
    const cleaned = raw.replace(/^b(\d):(utf8:)?/, '');
    const sizeMatch = raw.match(/^b(\d):/);
    const size = sizeMatch ? `${sizeMatch[1]}-byte` : 'byte';
    return `"${cleaned}" (${size})`;
  };

  return (
    <div className="space-y-6">
      {/* Top Split: Email Input + Score Verdict */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Message Composer & Headers */}
        <section className="xl:col-span-6 pl-surface border pl-border rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b pl-border">
            <div>
              <h2 className="text-sm font-semibold pl-text">Check an Email</h2>
              <p className="text-xs pl-muted mt-0.5">
                Pick a sample below or paste any email to test how the models score it
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 text-xs font-medium pl-muted hover:pl-text whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>

          {/* Preset scenario buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs pl-muted mr-1">Try sample:</span>
            {INSPECTOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.input)}
                className="px-2.5 py-1.5 text-xs font-medium pl-text pl-subtle hover:opacity-85 rounded-md transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sender-name" className="block text-xs font-medium pl-text mb-1">
                  Sender Name
                </label>
                <input
                  id="sender-name"
                  type="text"
                  value={form.senderName}
                  onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                  placeholder="e.g. Microsoft 365 Security"
                  className="w-full px-3 py-2 text-sm pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>

              <div>
                <label htmlFor="sender-email" className="block text-xs font-medium pl-text mb-1">
                  From Email
                </label>
                <input
                  id="sender-email"
                  type="email"
                  value={form.senderEmail}
                  onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                  placeholder="e.g. alert@domain.com"
                  className="w-full px-3 py-2 text-sm font-mono pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-3">
                <label htmlFor="reply-to" className="block text-xs font-medium pl-text mb-1">
                  Reply-To Email
                </label>
                <input
                  id="reply-to"
                  type="email"
                  value={form.replyToEmail}
                  onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })}
                  placeholder="Optional reply-to address"
                  className="w-full px-3 py-2 text-xs font-mono pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>
              <div>
                <label htmlFor="spf-select" className="block text-xs font-medium pl-text mb-1">
                  SPF
                </label>
                <select
                  id="spf-select"
                  value={form.spf}
                  onChange={(e) => setForm({ ...form, spf: e.target.value as AuthStatus })}
                  className="w-full px-2 py-2 text-xs font-mono pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                >
                  <option value="pass">PASS</option>
                  <option value="fail">FAIL</option>
                  <option value="none">NONE</option>
                </select>
              </div>
              <div>
                <label htmlFor="dkim-select" className="block text-xs font-medium pl-text mb-1">
                  DKIM
                </label>
                <select
                  id="dkim-select"
                  value={form.dkim}
                  onChange={(e) => setForm({ ...form, dkim: e.target.value as AuthStatus })}
                  className="w-full px-2 py-2 text-xs font-mono pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                >
                  <option value="pass">PASS</option>
                  <option value="fail">FAIL</option>
                  <option value="none">NONE</option>
                </select>
              </div>
              <div>
                <label htmlFor="dmarc-select" className="block text-xs font-medium pl-text mb-1">
                  DMARC
                </label>
                <select
                  id="dmarc-select"
                  value={form.dmarc}
                  onChange={(e) => setForm({ ...form, dmarc: e.target.value as AuthStatus })}
                  className="w-full px-2 py-2 text-xs font-mono pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                >
                  <option value="pass">PASS</option>
                  <option value="fail">FAIL</option>
                  <option value="none">NONE</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="email-subject" className="block text-xs font-medium pl-text mb-1">
                Subject Line
              </label>
              <input
                id="email-subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Enter email subject..."
                className="w-full px-3 py-2 text-sm pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>

            <div>
              <label htmlFor="email-body" className="block text-xs font-medium pl-text mb-1">
                Message Text & Links
              </label>
              <textarea
                id="email-body"
                rows={6}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Paste the email text and any links..."
                className="w-full px-3 py-2 text-sm pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40 leading-relaxed"
              />
            </div>

            {validationError && (
              <div
                role="alert"
                className="flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-xs pl-muted font-mono tabular-nums">
                {result.extracted.byteLength} bytes · {result.extracted.tokens.length} words ·{' '}
                {result.extracted.byteNgrams.length} byte pieces
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md pl-accent-bg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SearchCheck className="w-4 h-4" aria-hidden="true" />
                <span>Check Email</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right: Verdict & Model Scores */}
        <section className="xl:col-span-6 space-y-6">
          <div className="pl-surface border pl-border rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b pl-border">
              <div>
                <div className="text-xs font-medium pl-muted">Final Result</div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  {isPhishing ? (
                    <ShieldAlert className="w-6 h-6 text-red-700 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" aria-hidden="true" />
                  )}
                  <h2
                    className={`text-xl font-bold tracking-tight ${
                      isPhishing ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {isPhishing ? 'Phishing Detected' : 'Safe Email'}
                  </h2>
                </div>
              </div>

              <div className="text-right font-mono tabular-nums">
                <div className="text-xs font-sans pl-muted">Phishing Risk Score</div>
                <div className="text-2xl font-bold pl-text mt-0.5">
                  {(result.phishingProbability * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] pl-muted">
                  Cutoff τ = {(result.threshold * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {result.falsePositiveSavedByEnsemble && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-md px-3.5 py-2.5 text-xs text-emerald-900 leading-relaxed">
                <span className="font-semibold">False Alarm Prevented:</span> The Naive Bayes word scanner alone scored this email at{' '}
                <span className="font-mono font-semibold">
                  {(result.models.naiveBayes.phishingProbability * 100).toFixed(1)}%
                </span>{' '}
                because of urgent words, but the Combined Model lowered the score to{' '}
                <span className="font-mono font-semibold">
                  {(result.phishingProbability * 100).toFixed(1)}%
                </span>{' '}
                after seeing verified sender checks.
              </div>
            )}

            {/* Individual Model Votes */}
            <div className="mt-4 space-y-3">
              <div className="text-xs font-semibold pl-text">
                How Each Model Voted
              </div>
              {modelList.map((m) => {
                const pct = m.phishingProbability * 100;
                const tauPct = result.threshold * 100;
                const flagged = m.predictedLabel === 'phishing';
                return (
                  <div key={m.modelId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          m.modelId === 'ensemble'
                            ? 'font-semibold pl-text'
                            : 'pl-text opacity-85'
                        }
                      >
                        {m.modelName}
                      </span>
                      <span className="font-mono tabular-nums pl-text">
                        {pct.toFixed(1)}% ·{' '}
                        <span className={flagged ? 'text-red-700 font-medium' : 'text-emerald-700 font-medium'}>
                          {flagged ? 'Phishing' : 'Safe'}
                        </span>
                      </span>
                    </div>
                    <div className="relative h-2 w-full pl-subtle rounded-sm overflow-hidden">
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${Math.min(100, Math.max(2, pct))}%`,
                          backgroundColor: flagged ? '#b91c1c' : 'var(--pl-accent)',
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-black/65"
                        style={{ left: `${tauPct}%` }}
                        title={`Cutoff ${tauPct.toFixed(0)}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Header & Link Signals Summary */}
          <div className="pl-surface border pl-border rounded-lg p-5">
            <h3 className="text-sm font-semibold pl-text pb-3 border-b pl-border">
              Sender & Link Check Results
            </h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {STRUCTURAL_FEATURE_NAMES.filter((k) => result.extracted.structural[k] > 0.05).map(
                (k) => (
                  <div key={k} className="flex items-center justify-between gap-2 py-1 border-b pl-border">
                    <span className="pl-muted truncate">{STRUCTURAL_FEATURE_LABELS[k]}</span>
                    <span className="font-mono tabular-nums pl-text font-semibold">
                      {result.extracted.structural[k].toFixed(2)}
                    </span>
                  </div>
                )
              )}
              {STRUCTURAL_FEATURE_NAMES.every((k) => result.extracted.structural[k] <= 0.05) && (
                <p className="text-xs pl-muted py-2">
                  No unusual link, formatting, or sender header signals were triggered.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Dedicated Explainability Section */}
      <section
        aria-labelledby="explainability-heading"
        className="pl-surface border pl-border rounded-lg p-5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b pl-border">
          <div>
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 pl-accent-text shrink-0" aria-hidden="true" />
              <h2 id="explainability-heading" className="text-base font-semibold pl-text">
                Explainability: Keywords & Byte Sequences Behind This Score
              </h2>
            </div>
            <p className="text-xs pl-muted mt-1 leading-relaxed">
              {result.explainability.summaryText}
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums pl-muted shrink-0">
            Positive (+) raises phishing risk · Negative (-) signals safety
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1: Specific Keywords */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b pl-border">
              <Type className="w-4 h-4 pl-accent-text shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold pl-text">Top Contributing Keywords</h3>
                <p className="text-[11px] pl-muted">
                  Individual words and two-word phrases scored by Naive Bayes
                </p>
              </div>
            </div>
            <ContributionList
              items={result.explainability.topKeywords}
              emptyMessage="No strong single-word signals stood out in this message."
              formatLabel={(w) => w.replace(/_/g, ' ')}
            />
          </div>

          {/* Column 2: Specific Byte Sequences */}
          <div>
            <div className="flex items-center gap-2 pb-2 border-b pl-border">
              <Binary className="w-4 h-4 pl-accent-text shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold pl-text">Top Contributing Byte Sequences</h3>
                <p className="text-[11px] pl-muted">
                  3-byte and 4-byte patterns that catch disguised spelling, homoglyphs, and risky URLs
                </p>
              </div>
            </div>
            <ContributionList
              items={result.explainability.topByteSequences}
              emptyMessage="No strong byte-level patterns were found (increase byte weight in Evaluation Lab if needed)."
              formatLabel={formatByteLabel}
            />
          </div>
        </div>

        {result.suspiciousSpans.length > 0 && (
          <div className="mt-5 pt-4 border-t pl-border">
            <div className="text-xs font-semibold pl-text mb-1.5">
              Specific Words & Links Highlighted in This Email
            </div>
            <div className="text-xs font-mono text-red-700 break-all leading-relaxed pl-subtle border pl-border rounded-md px-3 py-2">
              {result.suspiciousSpans.join(' · ')}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
