'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface PlayerData {
  player_id: string;
  mean_return: number;
  std_return: number;
  n_episodes: number;
  min_return: number;
  max_return: number;
}

interface OverallStats {
  n_total: number;
  mean_return: number;
  std_return: number;
  se_return: number;
  min_return: number;
  max_return: number;
  ci95_low: number;
  ci95_high: number;
}

interface HumanData {
  source: 'filled' | 'template' | 'none';
  players: PlayerData[];
  overallStats: OverallStats | null;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, padding: '8px 12px' }} className="text-xs">
      <p className="text-zinc-300 font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-zinc-400 font-mono">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function HumanBaselinePage() {
  const [data, setData] = useState<HumanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/human-baseline')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const hasData = data?.players && data.players.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Human Baseline</h1>
        <p className="text-sm text-zinc-400 mt-1">6 players × 15 episodes</p>
      </div>

      {/* Protocol */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <p className="text-sm font-medium text-zinc-400 mb-3">Collection Protocol</p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Six novice participants with no prior Atari Pong experience each played 15 complete episodes against the built-in opponent.
          An episode ends when one side reaches 21 points. Episode return is defined as player score minus opponent score, ranging from −21 to +21.
          Bootstrap confidence intervals (10,000 resamples) are computed over all episodes pooled across players.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 animate-pulse">Loading human baseline data...</p>
      ) : !hasData ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            Awaiting data collection. Fill in{' '}
            <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 text-xs">data/human_baseline/human_returns.csv</code>{' '}
            and re-run analysis.
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-600 max-w-xs">
            <p className="text-zinc-500 mb-1"># Expected format:</p>
            <p>player_id,episode_return</p>
            <p>player_1,-15</p>
            <p>player_1,-12</p>
            <p>player_2,-10</p>
            <p>...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <p className="text-sm font-medium text-zinc-400 mb-1">Mean Return per Player</p>
            <p className="text-xs text-zinc-600 mb-5">Average episodic return across all episodes</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data!.players.map((p) => ({ name: p.player_id, return: p.mean_return }))}
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#27272a" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis
                  domain={[-21, 21]}
                  stroke="#27272a"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  label={{ value: 'Mean Return', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 4" />
                {data!.overallStats && (
                  <ReferenceLine
                    y={data!.overallStats.mean_return}
                    stroke="#f59e0b"
                    strokeDasharray="6 3"
                    label={{ value: `Mean: ${data!.overallStats.mean_return.toFixed(1)}`, position: 'right', fill: '#f59e0b', fontSize: 11 }}
                  />
                )}
                <Bar dataKey="return" name="Mean Return" radius={[3, 3, 0, 0]}>
                  {data!.players.map((_, index) => (
                    <Cell key={index} fill="#3b82f6" fillOpacity={0.7 + (index % 3) * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-player table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <p className="text-sm font-medium text-zinc-400">Per-Player Statistics</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Player', 'Episodes', 'Mean Return', 'Std Dev', 'Min', 'Max'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.players.map((p) => (
                  <tr key={p.player_id} className="border-b border-zinc-800">
                    <td className="px-4 py-2.5 font-mono text-zinc-300 text-xs">{p.player_id}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-400 text-xs">{p.n_episodes}</td>
                    <td className="px-4 py-2.5 font-mono text-white text-xs">{p.mean_return.toFixed(3)}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-400 text-xs">{p.std_return.toFixed(3)}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-600 text-xs">{p.min_return.toFixed(1)}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-600 text-xs">{p.max_return.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Overall stats */}
          {data!.overallStats && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <p className="text-sm font-medium text-zinc-400 mb-4">Overall Summary</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Mean Return', value: data!.overallStats.mean_return.toFixed(3) },
                  { label: 'Std Dev', value: data!.overallStats.std_return.toFixed(3) },
                  { label: 'Std Error', value: data!.overallStats.se_return.toFixed(3) },
                  { label: 'Total Episodes', value: data!.overallStats.n_total },
                  { label: '95% CI Low', value: data!.overallStats.ci95_low.toFixed(3) },
                  { label: '95% CI High', value: data!.overallStats.ci95_high.toFixed(3) },
                  { label: 'Min Return', value: data!.overallStats.min_return.toFixed(1) },
                  { label: 'Max Return', value: data!.overallStats.max_return.toFixed(1) },
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
                    <p className="text-lg font-mono font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
