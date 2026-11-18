import React from 'react';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';

export interface DemoTourStep {
  id: string;
  title: string;
  description: string;
  actionHint: string;
}

export const DEMO_TOUR_STEPS: DemoTourStep[] = [
  {
    id: 'overview',
    title: 'Overview & Accuracy Report',
    description:
      'Start here to compare how accurate the Combined Model (Ensemble) is against a standalone Naive Bayes word scanner. Notice how the Ensemble keeps false alarms at 0% while catching phishing.',
    actionHint: 'Look at the Accuracy and False Alarm Rate cards above.',
  },
  {
    id: 'inspector_phish',
    title: 'Checking a Disguised Phishing Email',
    description:
      'We loaded a fake PayPal alert that swaps letters for numbers ("p4ypal") and hides an IP address link. All four machine learning models agree this message is phishing.',
    actionHint: 'See the Email Input on the left and Risk Score on the right.',
  },
  {
    id: 'inspector_explainability',
    title: 'Explainability: Keywords & Byte Patterns',
    description:
      'The Explainability section breaks down the exact words (like "password" and "verify") and tiny byte sequences (like "4yp" and ".xy") that pushed the score toward Phishing.',
    actionHint: 'Review Top Keywords and Top Byte Sequences below the Risk Score.',
  },
  {
    id: 'inspector_safe',
    title: 'Stopping False Alarms on Safe Alerts',
    description:
      'Now we loaded a real IT password reminder. A simple word scanner (Naive Bayes) panics over words like "password" and "expire", but the Combined Model sees verified sender checks and marks it Safe.',
    actionHint: 'Look at the green False Alarm Prevented notice.',
  },
  {
    id: 'queue_and_settings',
    title: 'Reviewing Emails & Adjusting Controls',
    description:
      'Use Message Queue to search and filter all incoming emails, Evaluation Lab to adjust false-alarm sensitivity, or Edit Theme in the sidebar to customize this Beige theme.',
    actionHint: 'Try filtering messages or clicking Edit Theme whenever you want.',
  },
];

interface DemoTourProps {
  active: boolean;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const DemoTour: React.FC<DemoTourProps> = ({
  active,
  stepIndex,
  onNext,
  onPrev,
  onClose,
}) => {
  if (!active) return null;
  const step = DEMO_TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === DEMO_TOUR_STEPS.length - 1;

  return (
    <aside
      aria-label="Guided Demo Tour"
      className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-md pl-surface border pl-border rounded-lg shadow-xl p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium pl-accent-text">
          <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="font-mono tabular-nums">
            Demo Tour · Step {stepIndex + 1} of {DEMO_TOUR_STEPS.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close demo tour"
          className="p-1 rounded pl-muted hover:pl-text cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h3 className="text-sm font-semibold pl-text mt-2">{step.title}</h3>
      <p className="text-xs pl-text opacity-85 mt-1.5 leading-relaxed">{step.description}</p>
      <p className="text-[11px] pl-muted mt-2 font-medium">{step.actionHint}</p>

      <div className="mt-4 pt-3 border-t pl-border flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs pl-muted hover:pl-text cursor-pointer"
        >
          Exit Tour
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border pl-border rounded-md pl-surface pl-text disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={isLast ? onClose : onNext}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium rounded-md pl-accent-bg cursor-pointer"
          >
            <span>{isLast ? 'Finish Tour' : 'Next'}</span>
            {!isLast && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
