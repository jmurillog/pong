'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import { Report } from '@/lib/types';

function formatBudget(steps: number) {
  if (steps >= 1_000_000) return `${(steps / 1_000_000).toFixed(0)}M`;
  if (steps >= 1_000) return `${(steps / 1_000).toFixed(0)}k`;
  return `${steps}`;
}

export default function DashboardPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/report')
      .then((r) => r.json())
      .then((data) => {
        setReport(Object.keys(data).length > 0 ? data : null);
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  const totalSeeds = report?.agent_final_by_budget?.length
    ? Math.max(...report.agent_final_by_budget.map((b) => b.n_seeds))
    : 0;
  const humanPlayers = report?.human_baseline?.n_players ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">PPO vs Human Baseline · Atari Pong</p>
      </div>

      {/* Research question card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <p className="text-sm font-medium text-zinc-400 mb-3">Research Question</p>
        <p className="text-white text-base leading-relaxed">
          Can a PPO agent reach and exceed a novice human baseline in Pong under a fixed compute budget?
        </p>
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-xs font-medium text-blue-500 mt-0.5 shrink-0">RQ1</span>
            <p className="text-sm text-zinc-400">How many steps for PPO to match a novice human?</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xs font-medium text-blue-500 mt-0.5 shrink-0">RQ2</span>
            <p className="text-sm text-zinc-400">How stable is PPO across seeds under the same budget?</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Training Budgets"
          value={report?.agent_final_by_budget?.length ?? 0}
          subtitle="1M and 5M steps"
        />
        <StatCard
          label="Seeds per Budget"
          value={totalSeeds || '—'}
          subtitle="Independent runs"
        />
        <StatCard
          label="Eval Freq"
          value="50k"
          subtitle="Steps per checkpoint"
        />
        <StatCard
          label="Human Players"
          value={humanPlayers || '—'}
          subtitle="Baseline participants"
        />
      </div>

      {/* Results table */}
      <div>
        <p className="text-sm font-medium text-zinc-400 mb-3">Results</p>

        {loading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
            <p className="text-zinc-500 text-sm animate-pulse">Loading results...</p>
          </div>
        ) : !report || !report.agent_final_by_budget?.length ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
            <p className="text-zinc-500 text-sm">No results yet — run training to populate this table.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500">Budget</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500">Mean Return</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500">SE</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500">95% CI</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500">Seeds</th>
                </tr>
              </thead>
              <tbody>
                {report.agent_final_by_budget.map((b) => (
                  <tr key={b.budget_steps} className="border-b border-zinc-800">
                    <td className="px-4 py-3 font-mono text-white">{formatBudget(b.budget_steps)}</td>
                    <td className="px-4 py-3 font-mono text-white text-right">{b.agent_mean_return.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right">{b.agent_se_return.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">
                      [{b.agent_mean_ci95_low.toFixed(2)}, {b.agent_mean_ci95_high.toFixed(2)}]
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right">{b.n_seeds}</td>
                  </tr>
                ))}
                {report.human_baseline && (
                  <tr>
                    <td className="px-4 py-3 font-mono text-zinc-400">Human baseline</td>
                    <td className="px-4 py-3 font-mono text-white text-right">{report.human_baseline.mean_return.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right">
                      {(report.human_baseline.std_return / Math.sqrt(report.human_baseline.n_players * report.human_baseline.n_episodes)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right text-xs">
                      [{report.human_baseline.human_mean_ci95_low.toFixed(2)}, {report.human_baseline.human_mean_ci95_high.toFixed(2)}]
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400 text-right">
                      {report.human_baseline.n_players}p
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparison verdict */}
      {report?.comparison && (
        <div className={`border rounded-lg p-4 ${report.comparison.success_criterion_met ? 'border-emerald-800 bg-emerald-950/30' : 'border-red-800 bg-red-950/30'}`}>
          <p className={`text-sm font-medium ${report.comparison.success_criterion_met ? 'text-emerald-500' : 'text-red-500'}`}>
            Success criterion {report.comparison.success_criterion_met ? 'met' : 'not met'}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Agent ({formatBudget(report.comparison.agent_budget_steps)}): {report.comparison.agent_mean_return.toFixed(2)} vs Human: {report.comparison.human_mean_return.toFixed(2)} · Diff: {report.comparison.difference_mean.toFixed(2)} [{report.comparison.difference_ci95_low.toFixed(2)}, {report.comparison.difference_ci95_high.toFixed(2)}]
          </p>
        </div>
      )}

      {/* Methodology */}
      <div>
        <p className="text-sm font-medium text-zinc-400 mb-3">Methodology</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-sm font-medium text-white mb-2">Algorithm</p>
            <p className="text-xs text-zinc-400 leading-relaxed">Proximal Policy Optimization (PPO) with standard hyperparameters for Atari environments.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-sm font-medium text-white mb-2">Evaluation</p>
            <p className="text-xs text-zinc-400 leading-relaxed">Bootstrap confidence intervals (10,000 resamples) over multiple seeds per training budget.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-sm font-medium text-white mb-2">Human Baseline</p>
            <p className="text-xs text-zinc-400 leading-relaxed">Novice players — 6 participants × 15 episodes each. Score: game wins/losses (±1 per point).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
