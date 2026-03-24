'use client';

import { useEffect, useState } from 'react';
import { Report } from '@/lib/types';

function formatBudget(steps: number) {
  if (steps >= 1_000_000) return `${(steps / 1_000_000).toFixed(0)}M`;
  if (steps >= 1_000) return `${(steps / 1_000).toFixed(0)}k`;
  return `${steps}`;
}

export default function EvaluationPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/report')
      .then((r) => r.json())
      .then((data) => setReport(Object.keys(data).length > 0 ? data : null))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  const hasData = report && report.agent_final_by_budget && report.agent_final_by_budget.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Evaluation</h1>
        <p className="text-sm text-zinc-400 mt-1">Final performance · Bootstrap 95% CI</p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 animate-pulse">Loading evaluation data...</p>
      ) : !hasData ? (
        <p className="text-sm text-zinc-500">No evaluation results available yet — complete training experiments and run analysis.</p>
      ) : (
        <>
          {/* Performance table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <p className="text-sm font-medium text-zinc-400">Final Performance</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Budget</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Mean Return</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">±SE</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">CI Low</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">CI High</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Seeds</th>
                </tr>
              </thead>
              <tbody>
                {report!.agent_final_by_budget.map((b) => (
                  <tr key={b.budget_steps} className="border-b border-zinc-800">
                    <td className="px-4 py-3 font-mono text-white">{formatBudget(b.budget_steps)}</td>
                    <td className="px-4 py-3 font-mono text-white text-right">{b.agent_mean_return.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">{b.agent_se_return.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">{b.agent_mean_ci95_low.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">{b.agent_mean_ci95_high.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">{b.n_seeds}</td>
                  </tr>
                ))}
                {report!.human_baseline && (
                  <tr>
                    <td className="px-4 py-3 font-mono text-zinc-400">Human baseline</td>
                    <td className="px-4 py-3 font-mono text-white text-right">{report!.human_baseline.mean_return.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">
                      {(report!.human_baseline.std_return / Math.sqrt(report!.human_baseline.n_players * report!.human_baseline.n_episodes)).toFixed(3)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">{report!.human_baseline.human_mean_ci95_low.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">{report!.human_baseline.human_mean_ci95_high.toFixed(3)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">
                      {report!.human_baseline.n_players}p × {report!.human_baseline.n_episodes}ep
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Comparison section */}
          {report!.comparison && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
              <p className="text-sm font-medium text-zinc-400">Agent vs Human</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Agent Mean Return</p>
                  <p className="text-2xl font-mono font-semibold text-white">{report!.comparison.agent_mean_return.toFixed(2)}</p>
                  <p className="text-xs text-zinc-600 mt-1">{formatBudget(report!.comparison.agent_budget_steps)} budget</p>
                </div>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Human Mean Return</p>
                  <p className="text-2xl font-mono font-semibold text-white">{report!.comparison.human_mean_return.toFixed(2)}</p>
                  <p className="text-xs text-zinc-600 mt-1">Novice baseline</p>
                </div>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Difference (Agent − Human)</p>
                  <p className={`text-2xl font-mono font-semibold ${report!.comparison.difference_mean >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {report!.comparison.difference_mean >= 0 ? '+' : ''}{report!.comparison.difference_mean.toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    95% CI: [{report!.comparison.difference_ci95_low.toFixed(2)}, {report!.comparison.difference_ci95_high.toFixed(2)}]
                  </p>
                </div>
              </div>

              <div className={`border rounded-lg p-4 ${report!.comparison.success_criterion_met ? 'border-emerald-800 bg-emerald-950/30' : 'border-red-800 bg-red-950/30'}`}>
                <p className={`text-sm font-medium ${report!.comparison.success_criterion_met ? 'text-emerald-500' : 'text-red-500'}`}>
                  Success criterion {report!.comparison.success_criterion_met ? 'met' : 'not met'}
                </p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  The {formatBudget(report!.comparison.agent_budget_steps)} PPO agent achieved a mean return of{' '}
                  <span className="font-mono text-white">{report!.comparison.agent_mean_return.toFixed(2)}</span>{' '}
                  compared to the human baseline of{' '}
                  <span className="font-mono text-white">{report!.comparison.human_mean_return.toFixed(2)}</span>.{' '}
                  The 95% CI for the difference [{report!.comparison.difference_ci95_low.toFixed(2)}, {report!.comparison.difference_ci95_high.toFixed(2)}]{' '}
                  {report!.comparison.success_criterion_met
                    ? 'entirely excludes zero, indicating the agent significantly outperforms the human baseline.'
                    : 'overlaps or is below zero, indicating insufficient evidence to conclude superiority.'}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
