'use client';

import { useEffect, useState } from 'react';
import LearningCurveChart from '@/components/LearningCurveChart';

interface SummaryRow {
  budget_steps: string;
  timestep: string;
  n_seeds: string;
  mean_return: string;
  mean_win_rate: string;
  std_across_seeds: string;
  se_return: string;
}

interface SeedEntry {
  budget: string;
  seed: string;
  rows: { timestep: string; mean_return: string; win_rate: string; seed: string; budget: string }[];
}

interface ChartPoint {
  timestep: number;
  mean_return_1M?: number;
  se_upper_1M?: number;
  se_lower_1M?: number;
  band_width_1M?: number;
  mean_return_5M?: number;
  se_upper_5M?: number;
  se_lower_5M?: number;
  band_width_5M?: number;
}

function buildChartData(summary: SummaryRow[]): ChartPoint[] {
  const byTimestep: Record<number, ChartPoint> = {};

  for (const row of summary) {
    const ts = parseInt(row.timestep, 10);
    const budgetSteps = parseInt(row.budget_steps, 10);
    const meanReturn = parseFloat(row.mean_return);
    const se = parseFloat(row.se_return);

    if (isNaN(ts) || isNaN(meanReturn)) continue;

    if (!byTimestep[ts]) byTimestep[ts] = { timestep: ts };
    const pt = byTimestep[ts];

    const seSafe = isNaN(se) ? 0 : se;
    if (budgetSteps <= 1_000_000) {
      pt.mean_return_1M = meanReturn;
      pt.se_upper_1M = meanReturn + seSafe;
      pt.se_lower_1M = meanReturn - seSafe;
      pt.band_width_1M = 2 * seSafe;
    } else {
      pt.mean_return_5M = meanReturn;
      pt.se_upper_5M = meanReturn + seSafe;
      pt.se_lower_5M = meanReturn - seSafe;
      pt.band_width_5M = 2 * seSafe;
    }
  }

  return Object.values(byTimestep).sort((a, b) => a.timestep - b.timestep);
}

function formatSteps(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

export default function TrainingPage() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [seedData, setSeedData] = useState<SeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/learning-curves')
      .then((r) => r.json())
      .then(({ summary, seedData }) => {
        setSummary(summary ?? []);
        setSeedData(seedData ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = buildChartData(summary);

  const seedFinals: {
    budget: string;
    seed: string;
    finalReturn: number;
    finalWinRate: number;
    nCheckpoints: number;
  }[] = seedData.map((entry) => {
    const lastRow = entry.rows[entry.rows.length - 1];
    return {
      budget: entry.budget,
      seed: entry.seed,
      finalReturn: lastRow ? parseFloat(lastRow.mean_return) : NaN,
      finalWinRate: lastRow ? parseFloat(lastRow.win_rate) : NaN,
      nCheckpoints: entry.rows.length,
    };
  });

  const budgetGroups: Record<string, number[]> = {};
  for (const sf of seedFinals) {
    if (!budgetGroups[sf.budget]) budgetGroups[sf.budget] = [];
    if (!isNaN(sf.finalReturn)) budgetGroups[sf.budget].push(sf.finalReturn);
  }

  if (!loading && summary.length === 0 && seedData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Training Curves</h1>
          <p className="text-sm text-zinc-400 mt-1">Mean episodic return across seeds</p>
        </div>
        <p className="text-sm text-zinc-500">No training data available yet — run training experiments to see results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Training Curves</h1>
        <p className="text-sm text-zinc-400 mt-1">Mean episodic return across seeds</p>
      </div>

      {/* Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <p className="text-sm font-medium text-zinc-400 mb-1">Learning Curves</p>
        <p className="text-xs text-zinc-600 mb-5">Shaded bands show ±1 SE across seeds</p>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-zinc-500 animate-pulse text-sm">Loading training data...</p>
          </div>
        ) : (
          <LearningCurveChart data={chartData} />
        )}
      </div>

      {/* Checkpoint summary table */}
      {summary.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <p className="text-sm font-medium text-zinc-400 mb-4">Checkpoint Data</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Budget</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Timestep</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Seeds</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Mean Return</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">SE</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, i) => {
                  const budget = parseInt(row.budget_steps, 10);
                  return (
                    <tr key={i} className="border-b border-zinc-800">
                      <td className="py-2 px-3 font-mono text-zinc-400 text-xs">
                        {formatSteps(budget)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-zinc-300 text-xs">
                        {formatSteps(parseInt(row.timestep, 10))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-zinc-400 text-xs">
                        {row.n_seeds}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-white text-xs">
                        {parseFloat(row.mean_return).toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-zinc-400 text-xs">
                        {isNaN(parseFloat(row.se_return)) ? '—' : parseFloat(row.se_return).toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-zinc-400 text-xs">
                        {isNaN(parseFloat(row.mean_win_rate))
                          ? '—'
                          : `${(parseFloat(row.mean_win_rate) * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-seed final scores */}
      {seedFinals.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <p className="text-sm font-medium text-zinc-400 mb-4">Seed Variance</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Budget</th>
                  <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Seed</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Final Return</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Win Rate</th>
                  <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Checkpoints</th>
                </tr>
              </thead>
              <tbody>
                {seedFinals.map((sf, i) => (
                  <tr key={i} className="border-b border-zinc-800">
                    <td className="py-2 px-3 font-mono text-zinc-400 text-xs">{sf.budget}</td>
                    <td className="py-2 px-3 font-mono text-zinc-300 text-xs">{sf.seed}</td>
                    <td className="py-2 px-3 text-right font-mono text-white text-xs">
                      {isNaN(sf.finalReturn) ? '—' : sf.finalReturn.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-400 text-xs">
                      {isNaN(sf.finalWinRate) ? '—' : `${(sf.finalWinRate * 100).toFixed(1)}%`}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-600 text-xs">
                      {sf.nCheckpoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget variance summary */}
      {Object.keys(budgetGroups).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <p className="text-sm font-medium text-zinc-400 mb-4">Variance by Budget</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(budgetGroups).map(([budget, returns]) => {
              const n = returns.length;
              const mean = returns.reduce((a, b) => a + b, 0) / n;
              const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1);
              const std = Math.sqrt(variance);
              const se = std / Math.sqrt(n);

              return (
                <div key={budget} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <p className="text-sm font-medium text-white mb-3">{budget}</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-zinc-500 mb-0.5">Mean</p>
                      <p className="font-mono text-white">{mean.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Std</p>
                      <p className="font-mono text-white">{std.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">SE</p>
                      <p className="font-mono text-white">{se.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Seeds</p>
                      <p className="font-mono text-white">{n}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Min</p>
                      <p className="font-mono text-zinc-300">{Math.min(...returns).toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Max</p>
                      <p className="font-mono text-zinc-300">{Math.max(...returns).toFixed(3)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
