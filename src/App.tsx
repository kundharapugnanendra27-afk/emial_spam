import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Compass,
  Inbox,
  Menu,
  Palette,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { INITIAL_EMAIL_DATASET } from './ml/dataset';
import { DEFAULT_TRAINING_CONFIG, PhishingEnsemblePipeline } from './ml/ensemble';
import {
  ClassificationResult,
  EmailInput,
  EmailRecord,
  PipelineEvaluationSummary,
  TrainingConfig,
} from './ml/types';
import { DEMO_TOUR_STEPS, DemoTour } from './components/DemoTour';
import { EvaluationLabView } from './components/EvaluationLabView';
import { INSPECTOR_PRESETS, InspectorView } from './components/InspectorView';
import { OverviewView } from './components/OverviewView';
import { QueueView } from './components/QueueView';
import { ThemeEditorModal } from './components/ThemeEditorModal';
import { DEFAULT_THEME, ThemeSettings, applyThemeCssVars } from './theme';

type NavTab = 'overview' | 'inspector' | 'queue' | 'evaluation';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'inspector', label: 'Live Inspector', icon: SearchCheck },
  { id: 'queue', label: 'Message Queue', icon: Inbox },
  { id: 'evaluation', label: 'Evaluation Lab', icon: SlidersHorizontal },
];

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Overview & Accuracy Report',
  inspector: 'Live Email Check & Explainability',
  queue: 'Incoming Message Queue',
  evaluation: 'Sensitivity & Model Settings',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dataset, setDataset] = useState<EmailRecord[]>(INITIAL_EMAIL_DATASET);

  // Editable Beige Theme state
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);

  // Interactive Demo Tour state (never auto-opens on initial load)
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pl-bg', theme.canvasBg);
    root.style.setProperty('--pl-surface', theme.surfaceBg);
    root.style.setProperty('--pl-subtle', theme.subtleBg);
    root.style.setProperty('--pl-border', theme.borderColor);
    root.style.setProperty('--pl-text', theme.textPrimary);
    root.style.setProperty('--pl-muted', theme.textMuted);
    root.style.setProperty('--pl-accent', theme.accentColor);
  }, [theme]);

  const pipelineRef = useRef<PhishingEnsemblePipeline | null>(null);
  if (!pipelineRef.current) {
    pipelineRef.current = new PhishingEnsemblePipeline(DEFAULT_TRAINING_CONFIG);
    pipelineRef.current.train(INITIAL_EMAIL_DATASET);
  }

  const [summary, setSummary] = useState<PipelineEvaluationSummary>(() =>
    pipelineRef.current!.evaluate()
  );

  const defaultInspectorEmail: EmailInput = useMemo(() => {
    const rec = INITIAL_EMAIL_DATASET[0];
    return {
      senderName: rec.senderName,
      senderEmail: rec.senderEmail,
      replyToEmail: rec.replyToEmail,
      subject: rec.subject,
      body: rec.body,
      spf: rec.spf,
      dkim: rec.dkim,
      dmarc: rec.dmarc,
    };
  }, []);

  const [inspectorInput, setInspectorInput] = useState<EmailInput>(defaultInspectorEmail);
  const [inspectorResult, setInspectorResult] = useState<ClassificationResult>(() =>
    pipelineRef.current!.classify(defaultInspectorEmail)
  );

  const handleClassify = (input: EmailInput): ClassificationResult => {
    const res = pipelineRef.current!.classify(input);
    setInspectorInput(input);
    setInspectorResult(res);
    return res;
  };

  const handleInspectRecord = (recordId: string) => {
    const found = dataset.find((d) => d.id === recordId);
    if (!found) return;
    const input: EmailInput = {
      senderName: found.senderName,
      senderEmail: found.senderEmail,
      replyToEmail: found.replyToEmail,
      subject: found.subject,
      body: found.body,
      spf: found.spf,
      dkim: found.dkim,
      dmarc: found.dmarc,
    };
    setInspectorInput(input);
    setInspectorResult(pipelineRef.current!.classify(input));
    setActiveTab('inspector');
    setMobileNavOpen(false);
  };

  const handleThresholdChange = (threshold: number) => {
    pipelineRef.current!.updateThreshold(threshold);
    setSummary(pipelineRef.current!.evaluate());
    setInspectorResult(pipelineRef.current!.classify(inspectorInput));
  };

  const handleOptimizeLowFpr = (maxFpr: number) => {
    const optimalTau = pipelineRef.current!.findOptimalThresholdForMaxFpr(maxFpr);
    handleThresholdChange(optimalTau);
  };

  const handleRetrain = (config: TrainingConfig) => {
    const nextSummary = pipelineRef.current!.train(dataset, config);
    setSummary(nextSummary);
    setInspectorResult(pipelineRef.current!.classify(inspectorInput));
  };

  const handleResetDefaults = () => {
    const nextSummary = pipelineRef.current!.train(dataset, DEFAULT_TRAINING_CONFIG);
    setSummary(nextSummary);
    setInspectorResult(pipelineRef.current!.classify(inspectorInput));
  };

  const handleAddCorpusRecord = (newItem: Omit<EmailRecord, 'id' | 'receivedAt'>) => {
    const nextId = `EM-${400 + dataset.length + 1}`;
    const record: EmailRecord = {
      ...newItem,
      id: nextId,
      receivedAt: '2026-11-18 09:00',
    };
    const nextDataset = [record, ...dataset];
    setDataset(nextDataset);
    const nextSummary = pipelineRef.current!.train(nextDataset);
    setSummary(nextSummary);
    setInspectorResult(pipelineRef.current!.classify(inspectorInput));
  };

  const syncTourStepView = (idx: number) => {
    const stepId = DEMO_TOUR_STEPS[idx]?.id;
    if (stepId === 'overview') {
      setActiveTab('overview');
    } else if (stepId === 'inspector_phish' || stepId === 'inspector_explainability') {
      const phishPreset = INSPECTOR_PRESETS[0].input;
      setInspectorInput(phishPreset);
      setInspectorResult(pipelineRef.current!.classify(phishPreset));
      setActiveTab('inspector');
    } else if (stepId === 'inspector_safe') {
      const safePreset = INSPECTOR_PRESETS[2].input;
      setInspectorInput(safePreset);
      setInspectorResult(pipelineRef.current!.classify(safePreset));
      setActiveTab('inspector');
    } else if (stepId === 'queue_and_settings') {
      setActiveTab('queue');
    }
  };

  const handleStartTour = () => {
    setTourStep(0);
    setTourActive(true);
    syncTourStepView(0);
    setMobileNavOpen(false);
  };

  const handleTourNext = () => {
    const nextIdx = Math.min(DEMO_TOUR_STEPS.length - 1, tourStep + 1);
    setTourStep(nextIdx);
    syncTourStepView(nextIdx);
  };

  const handleTourPrev = () => {
    const prevIdx = Math.max(0, tourStep - 1);
    setTourStep(prevIdx);
    syncTourStepView(prevIdx);
  };

  const ensembleMetrics = summary.metricsByModel.find((m) => m.modelId === 'ensemble')!;
  const themeStyle = applyThemeCssVars(theme);

  return (
    <div style={themeStyle} className="min-h-screen flex pl-bg pl-text">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-[252px] md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen pl-surface border-r pl-border">
        <div className="h-14 px-5 flex items-center gap-2.5 border-b pl-border">
          <ShieldCheck className="w-5 h-5 pl-accent-text shrink-0" aria-hidden="true" />
          <span className="font-display text-base font-bold tracking-tight pl-text whitespace-nowrap">
            PhishLens
          </span>
        </div>

        <nav aria-label="Primary Navigation" className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active ? 'pl-accent-bg font-medium' : 'pl-muted hover:pl-text hover:pl-subtle'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t pl-border space-y-3">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleStartTour}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium pl-text pl-subtle hover:opacity-85 rounded-md whitespace-nowrap cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 pl-accent-text shrink-0" aria-hidden="true" />
              <span>Start Demo Tour</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeEditorOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium pl-text border pl-border pl-surface hover:pl-subtle rounded-md whitespace-nowrap cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 pl-accent-text shrink-0" aria-hidden="true" />
              <span>Edit Theme</span>
            </button>
          </div>

          <div className="pt-3 border-t pl-border text-xs pl-muted space-y-1 font-mono tabular-nums">
            <div className="font-sans text-[11px] font-medium pl-muted">Current Model Stats</div>
            <div className="flex justify-between">
              <span className="font-sans">Accuracy</span>
              <span className="pl-text font-semibold">
                {(ensembleMetrics.accuracy * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans">False Alarms</span>
              <span className="text-emerald-700 font-semibold">
                {(ensembleMetrics.falsePositiveRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans">Cutoff τ</span>
              <span className="pl-text">{summary.config.decisionThreshold.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-full pl-surface h-full border-r pl-border flex flex-col z-50">
            <div className="h-14 px-4 flex items-center justify-between border-b pl-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 pl-accent-text" aria-hidden="true" />
                <span className="font-display text-base font-bold pl-text">PhishLens</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 pl-muted hover:pl-text cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav aria-label="Mobile Navigation" className="p-3 space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-md whitespace-nowrap cursor-pointer ${
                      active ? 'pl-accent-bg font-medium' : 'pl-muted hover:pl-text hover:pl-subtle'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t pl-border space-y-2">
              <button
                type="button"
                onClick={handleStartTour}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium pl-text pl-subtle rounded-md cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 pl-accent-text" aria-hidden="true" />
                <span>Start Demo Tour</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setThemeEditorOpen(true);
                  setMobileNavOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium pl-text border pl-border rounded-md cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 pl-accent-text" aria-hidden="true" />
                <span>Edit Theme</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-14 pl-surface border-b pl-border px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden p-1.5 pl-muted hover:pl-text rounded cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-medium pl-muted hidden sm:inline">PhishLens</span>
              <span className="pl-muted opacity-50 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold pl-text truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md pl-accent-bg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              Check Email
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              summary={summary}
              onNavigate={setActiveTab}
              onInspectEmail={handleInspectRecord}
              onStartTour={handleStartTour}
            />
          )}

          {activeTab === 'inspector' && (
            <InspectorView
              initialEmail={inspectorInput}
              initialResult={inspectorResult}
              onClassify={handleClassify}
            />
          )}

          {activeTab === 'queue' && (
            <QueueView
              records={summary.evaluatedRecords}
              onInspectRecord={handleInspectRecord}
            />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationLabView
              summary={summary}
              onThresholdChange={handleThresholdChange}
              onOptimizeLowFpr={handleOptimizeLowFpr}
              onRetrain={handleRetrain}
              onResetDefaults={handleResetDefaults}
              onAddCorpusRecord={handleAddCorpusRecord}
            />
          )}
        </main>
      </div>

      {/* Theme Editor & Guided Demo Tour */}
      <ThemeEditorModal
        open={themeEditorOpen}
        theme={theme}
        onChange={setTheme}
        onClose={() => setThemeEditorOpen(false)}
      />

      <DemoTour
        active={tourActive}
        stepIndex={tourStep}
        onNext={handleTourNext}
        onPrev={handleTourPrev}
        onClose={() => setTourActive(false)}
      />
    </div>
  );
}
