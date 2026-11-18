import React, { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { EvaluatedRecord } from '../ml/types';

interface QueueViewProps {
  records: EvaluatedRecord[];
  onInspectRecord: (recordId: string) => void;
}

type QueueFilter = 'all' | 'phishing' | 'legitimate' | 'fp_saved' | 'test_only';

export const QueueView: React.FC<QueueViewProps> = ({ records, onInspectRecord }) => {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(records[0]?.record.id ?? '');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((item) => {
      if (filter === 'phishing' && item.result.verdict !== 'phishing') return false;
      if (filter === 'legitimate' && item.result.verdict !== 'legitimate') return false;
      if (filter === 'fp_saved' && !item.nbFalsePositiveAvoided) return false;
      if (filter === 'test_only' && item.split !== 'test') return false;

      if (q) {
        const hay =
          `${item.record.id} ${item.record.senderName} ${item.record.senderEmail} ${item.record.subject}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filter, searchQuery]);

  const selectedRecord = useMemo(
    () => records.find((r) => r.record.id === selectedId) ?? filtered[0] ?? null,
    [records, selectedId, filtered]
  );

  const filterButtons: { id: QueueFilter; label: string }[] = [
    { id: 'all', label: `All (${records.length})` },
    {
      id: 'phishing',
      label: `Phishing (${records.filter((r) => r.result.verdict === 'phishing').length})`,
    },
    {
      id: 'legitimate',
      label: `Safe (${records.filter((r) => r.result.verdict === 'legitimate').length})`,
    },
    {
      id: 'fp_saved',
      label: `False Alarm Saved (${records.filter((r) => r.nbFalsePositiveAvoided).length})`,
    },
    {
      id: 'test_only',
      label: `Test Set (${records.filter((r) => r.split === 'test').length})`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Search and Filter Bar */}
      <div className="pl-surface border pl-border rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 pl-subtle rounded-md">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === btn.id
                  ? 'pl-surface pl-text shadow-xs font-semibold'
                  : 'pl-muted hover:pl-text'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="w-4 h-4 pl-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="queue-search" className="sr-only">
            Search emails by sender, subject, or ID
          </label>
          <input
            id="queue-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sender, subject, or ID..."
            className="w-full pl-9 pr-3 py-2 text-xs pl-text pl-surface border pl-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/40"
          />
        </div>
      </div>

      {/* Main Split: High-density Message Grid + Selected Message Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 pl-surface border pl-border rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium pl-text">No matching emails found</p>
              <p className="text-xs pl-muted mt-1">
                Try clearing your search box or picking another filter above.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-3.5 py-1.5 text-xs font-medium rounded-md pl-accent-bg cursor-pointer"
              >
                Show All Emails
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b pl-border pl-subtle pl-muted">
                    <th className="py-2.5 pl-4 pr-2 font-medium">ID / Group</th>
                    <th className="py-2.5 px-2 font-medium">Sender & Subject</th>
                    <th className="py-2.5 px-2 font-medium text-right">Naive Bayes</th>
                    <th className="py-2.5 px-2 font-medium text-right">Combined</th>
                    <th className="py-2.5 pl-2 pr-4 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y pl-border">
                  {filtered.map((item) => {
                    const isSelected = selectedRecord?.record.id === item.record.id;
                    const isPhish = item.result.verdict === 'phishing';
                    return (
                      <tr
                        key={item.record.id}
                        className={`transition-colors ${
                          isSelected ? 'pl-subtle' : 'hover:pl-subtle/60'
                        }`}
                      >
                        <td className="py-2.5 pl-4 pr-2 font-mono tabular-nums whitespace-nowrap pl-muted">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.record.id)}
                            className="text-left pl-text hover:underline font-medium cursor-pointer"
                          >
                            {item.record.id}
                          </button>
                          <div className="text-[11px] pl-muted font-sans capitalize">
                            {item.split}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 max-w-[300px]">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.record.id)}
                            className="text-left w-full cursor-pointer group"
                          >
                            <div className="font-medium pl-text group-hover:underline truncate">
                              {item.record.subject}
                            </div>
                            <div className="text-[11px] pl-muted font-mono truncate">
                              {item.record.senderEmail}
                            </div>
                          </button>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums pl-text whitespace-nowrap">
                          {(item.result.models.naiveBayes.phishingProbability * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold pl-text whitespace-nowrap">
                          {(item.result.phishingProbability * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 pl-2 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isPhish ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-red-700 shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                            )}
                            <span
                              className={`font-medium ${
                                isPhish ? 'text-red-700' : 'text-emerald-700'
                              }`}
                            >
                              {isPhish ? 'Phishing' : 'Safe'}
                            </span>
                            {item.nbFalsePositiveAvoided && (
                              <span className="text-[11px] pl-muted">· Saved</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Email Quick Detail */}
        <aside className="xl:col-span-4 pl-surface border pl-border rounded-lg p-5">
          {selectedRecord ? (
            <div className="space-y-4">
              <div className="pb-3 border-b pl-border">
                <div className="text-xs pl-muted font-mono">
                  {selectedRecord.record.id} · {selectedRecord.split.toUpperCase()} · Real Label:{' '}
                  <span className="font-semibold pl-text">
                    {selectedRecord.record.label === 'phishing' ? 'Phishing' : 'Safe'}
                  </span>
                </div>
                <h3 className="text-sm font-semibold pl-text mt-1">
                  {selectedRecord.record.subject}
                </h3>
              </div>

              <div className="text-xs space-y-1.5 pl-muted">
                <div>
                  <span>From:</span>{' '}
                  <span className="font-mono pl-text">{selectedRecord.record.senderEmail}</span>
                </div>
                <div>
                  <span>Reply-To:</span>{' '}
                  <span className="font-mono pl-text">{selectedRecord.record.replyToEmail}</span>
                </div>
                <div>
                  <span>Checks:</span>{' '}
                  <span className="font-mono pl-text">
                    SPF {selectedRecord.record.spf.toUpperCase()} · DKIM{' '}
                    {selectedRecord.record.dkim.toUpperCase()} · DMARC{' '}
                    {selectedRecord.record.dmarc.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="text-xs pl-text pl-subtle border pl-border rounded-md p-3 leading-relaxed">
                {selectedRecord.record.body}
              </div>

              {selectedRecord.record.notes && (
                <div className="text-xs pl-muted leading-relaxed">
                  <span className="font-semibold pl-text">Why this email matters: </span>
                  {selectedRecord.record.notes}
                </div>
              )}

              <div className="pt-2 border-t pl-border space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="font-sans pl-muted">Naive Bayes (Words & Bytes)</span>
                  <span className="pl-text">
                    {(selectedRecord.result.models.naiveBayes.phishingProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans pl-muted">Link & Header Checker</span>
                  <span className="pl-text">
                    {(selectedRecord.result.models.logisticRegression.phishingProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans pl-muted">Rule Trees</span>
                  <span className="pl-text">
                    {(selectedRecord.result.models.decisionForest.phishingProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t pl-border">
                  <span className="font-sans pl-text">Combined Model</span>
                  <span className="pl-accent-text">
                    {(selectedRecord.result.phishingProbability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onInspectRecord(selectedRecord.record.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md pl-accent-bg hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
              >
                <span>Open Explainability in Inspector</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="text-xs pl-muted py-8 text-center">
              Click any email row to preview its details and scores.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
