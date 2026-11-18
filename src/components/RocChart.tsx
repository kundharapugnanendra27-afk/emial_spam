import React, { useState } from 'react';
import { RocPoint } from '../ml/types';

interface RocChartProps {
  ensemblePoints: RocPoint[];
  naiveBayesPoints: RocPoint[];
  currentThreshold: number;
  ensembleAuc: number;
  naiveBayesAuc: number;
}

export const RocChart: React.FC<RocChartProps> = ({
  ensemblePoints,
  naiveBayesPoints,
  currentThreshold,
  ensembleAuc,
  naiveBayesAuc,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 520;
  const height = 270;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toX = (fpr: number) => padLeft + fpr * plotW;
  const toY = (tpr: number) => padTop + (1 - tpr) * plotH;

  const sortRoc = (pts: RocPoint[]) =>
    [...pts].sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);

  const ensSorted = sortRoc(ensemblePoints);
  const nbSorted = sortRoc(naiveBayesPoints);

  const buildPath = (pts: RocPoint[]) =>
    pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.fpr).toFixed(1)} ${toY(p.tpr).toFixed(1)}`)
      .join(' ');

  const findNearestToThreshold = (pts: RocPoint[]) => {
    let best = pts[0];
    let bestDiff = Infinity;
    for (const p of pts) {
      const diff = Math.abs(p.threshold - currentThreshold);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    return best;
  };

  const activeEns = findNearestToThreshold(ensSorted);
  const activeNb = findNearestToThreshold(nbSorted);
  const inspectedPoint = hoveredIdx !== null ? ensSorted[hoveredIdx] : activeEns;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b pl-border">
        <div>
          <h3 className="text-sm font-semibold pl-text">
            Detection vs. False Alarm Curve (ROC)
          </h3>
          <p className="text-xs pl-muted mt-0.5">
            Higher curves mean more phishing caught with fewer false alarms
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs tabular-nums">
          <div className="flex items-center gap-2 pl-text">
            <span
              className="inline-block w-4 h-0.5"
              style={{ backgroundColor: 'var(--pl-accent)' }}
              aria-hidden="true"
            />
            <span>Combined Model {ensembleAuc.toFixed(3)}</span>
          </div>
          <div className="flex items-center gap-2 pl-muted">
            <span
              className="inline-block w-4 h-0.5 border-t-2 border-dashed border-amber-700"
              aria-hidden="true"
            />
            <span>Naive Bayes {naiveBayesAuc.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          role="img"
          aria-label="Chart comparing phishing detection vs false alarm rate for Combined Model and Naive Bayes"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const x = toX(tick);
            const y = toY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--pl-border)"
                  strokeWidth="1"
                />
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke="var(--pl-border)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--pl-muted)"
                  className="text-[10px] font-mono"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
                <text
                  x={x}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  fill="var(--pl-muted)"
                  className="text-[10px] font-mono"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          <text
            x={padLeft + plotW / 2}
            y={height - 4}
            textAnchor="middle"
            fill="var(--pl-muted)"
            className="text-[11px] font-medium"
          >
            False Alarm Rate (Safe emails flagged)
          </text>
          <text
            x={12}
            y={padTop + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${padTop + plotH / 2})`}
            fill="var(--pl-muted)"
            className="text-[11px] font-medium"
          >
            Phishing Caught
          </text>

          <line
            x1={toX(0)}
            y1={toY(0)}
            x2={toX(1)}
            y2={toY(1)}
            stroke="var(--pl-border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          <path
            d={buildPath(nbSorted)}
            fill="none"
            stroke="#b45309"
            strokeWidth="2"
            strokeDasharray="5 4"
          />

          <path
            d={buildPath(ensSorted)}
            fill="none"
            stroke="var(--pl-accent)"
            strokeWidth="2.5"
          />

          {activeNb && (
            <circle
              cx={toX(activeNb.fpr)}
              cy={toY(activeNb.tpr)}
              r={4.5}
              fill="var(--pl-surface)"
              stroke="#b45309"
              strokeWidth="2"
            />
          )}
          {activeEns && (
            <circle
              cx={toX(activeEns.fpr)}
              cy={toY(activeEns.tpr)}
              r={5.5}
              fill="var(--pl-accent)"
              stroke="var(--pl-surface)"
              strokeWidth="2"
            />
          )}

          {ensSorted.map((pt, idx) => (
            <circle
              key={`${pt.threshold}-${idx}`}
              cx={toX(pt.fpr)}
              cy={toY(pt.tpr)}
              r={9}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {inspectedPoint && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs pl-muted pl-subtle border pl-border rounded-md px-3 py-2 font-mono tabular-nums">
            <span>
              {hoveredIdx !== null ? 'Selected' : 'Current'} Cutoff (τ ={' '}
              {inspectedPoint.threshold.toFixed(2)})
            </span>
            <span>
              Caught {(inspectedPoint.tpr * 100).toFixed(1)}% · False Alarms{' '}
              {(inspectedPoint.fpr * 100).toFixed(1)}% · Precision{' '}
              {(inspectedPoint.precision * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
