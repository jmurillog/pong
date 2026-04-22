'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
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

const PongGame = dynamic(() => import('@/components/PongGame'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-zinc-900 border border-zinc-800 rounded-lg">
      <p className="text-zinc-500 animate-pulse text-sm">Loading game...</p>
    </div>
  ),
});

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

const EPISODES_PER_PLAYER = 15;

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

type CollectionPhase = 'idle' | 'enter-name' | 'playing' | 'player-done' | 'all-done';

export default function HumanBaselinePage() {
  const [data, setData] = useState<HumanData | null>(null);
  const [loading, setLoading] = useState(true);

  // Collection state
  const [phase, setPhase] = useState<CollectionPhase>('idle');
  const [playerName, setPlayerName] = useState('');
  const [episodeScores, setEpisodeScores] = useState<number[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/analyze', { method: 'POST' });
      const data = await res.json();
      setAnalyzeResult(data);
      if (data.ok) fetchData();
    } catch {
      setAnalyzeResult({ ok: false, message: 'Could not reach backend. Is the Python server running?' });
    } finally {
      setAnalyzing(false);
    }
  };
  const [gameKey, setGameKey] = useState(0); // force remount PongGame between episodes

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch('/api/human-baseline')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasData = data?.players && data.players.length > 0;

  const handleEpisodeEnd = useCallback((humanScore: number, aiScore: number) => {
    const episodeReturn = humanScore - aiScore;
    setEpisodeScores((prev) => {
      const next = [...prev, episodeReturn];
      if (next.length >= EPISODES_PER_PLAYER) {
        setPhase('player-done');
      }
      return next;
    });
    setCurrentEpisode((prev) => prev + 1);
  }, []);

  const startNextEpisode = () => {
    setGameKey((k) => k + 1); // remount game so it resets
    setPhase('playing');
  };

  const savePlayerScores = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/human-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerName, scores: episodeScores }),
      });
      if (!res.ok) throw new Error('Save failed');
      setPhase('all-done');
      fetchData();
    } catch {
      setSaveError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const startNewPlayer = () => {
    setPlayerName('');
    setEpisodeScores([]);
    setCurrentEpisode(0);
    setSaveError('');
    setPhase('enter-name');
    setGameKey((k) => k + 1);
  };

  const cancelCollection = () => {
    setPhase('idle');
    setPlayerName('');
    setEpisodeScores([]);
    setCurrentEpisode(0);
  };

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
          Six novice participants each play 15 complete episodes against the built-in Pong AI.
          An episode ends when one side reaches 21 points. Episode return = player score − opponent score, ranging from −21 to +21.
          Bootstrap confidence intervals (10,000 resamples) are computed over all episodes pooled across players.
        </p>
      </div>

      {/* ── Collection UI ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-400">Collect Data</p>
          {phase !== 'idle' && (
            <button onClick={cancelCollection} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Cancel
            </button>
          )}
        </div>

        {phase === 'idle' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Each player plays {EPISODES_PER_PLAYER} episodes. Scores are saved automatically after each player finishes.
            </p>
            <button
              onClick={() => setPhase('enter-name')}
              className="bg-white text-black text-sm px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors"
            >
              Start Collection
            </button>
          </div>
        )}

        {phase === 'enter-name' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Player name or ID</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && playerName.trim()) { setPhase('playing'); } }}
                placeholder="e.g. player_1"
                className="bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 rounded-md w-64 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <button
              onClick={() => { if (playerName.trim()) setPhase('playing'); }}
              disabled={!playerName.trim()}
              className="bg-white text-black text-sm px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Playing
            </button>
          </div>
        )}

        {(phase === 'playing' || phase === 'player-done') && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <p className="text-sm text-white font-medium">{playerName}</p>
              <span className="text-xs text-zinc-500">
                Episode {Math.min(currentEpisode + 1, EPISODES_PER_PLAYER)} / {EPISODES_PER_PLAYER}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: EPISODES_PER_PLAYER }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < episodeScores.length
                        ? episodeScores[i] >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                        : i === episodeScores.length ? 'bg-zinc-500 animate-pulse' : 'bg-zinc-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {phase === 'playing' && episodeScores.length < EPISODES_PER_PLAYER && (
              <>
                <p className="text-xs text-zinc-500">
                  Controls: <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded text-zinc-300 text-xs">W</kbd>/
                  <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded text-zinc-300 text-xs">↑</kbd> up ·{' '}
                  <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded text-zinc-300 text-xs">S</kbd>/
                  <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded text-zinc-300 text-xs">↓</kbd> down ·{' '}
                  <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded text-zinc-300 text-xs">Space</kbd> start
                </p>
                <PongGame
                  key={gameKey}
                  onEpisodeEnd={handleEpisodeEnd}
                  collectionMode
                  initialMode="easy"
                />
              </>
            )}

            {phase === 'playing' && episodeScores.length > 0 && episodeScores.length < EPISODES_PER_PLAYER && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-400">
                Last episode: <span className={`font-mono font-semibold ${episodeScores[episodeScores.length - 1] >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {episodeScores[episodeScores.length - 1] >= 0 ? '+' : ''}{episodeScores[episodeScores.length - 1]}
                </span>
                {' · '}
                <button onClick={startNextEpisode} className="text-zinc-300 hover:text-white underline">
                  Start next episode
                </button>
              </div>
            )}

            {phase === 'player-done' && (
              <div className="space-y-4">
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-white">Session complete for {playerName}</p>
                  <p className="text-xs text-zinc-400">
                    Mean return:{' '}
                    <span className="font-mono text-white">
                      {(episodeScores.reduce((a, b) => a + b, 0) / episodeScores.length).toFixed(2)}
                    </span>
                    {' · '}Scores: <span className="font-mono text-zinc-300">[{episodeScores.join(', ')}]</span>
                  </p>
                </div>
                {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={savePlayerScores}
                    disabled={saving}
                    className="bg-white text-black text-sm px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'all-done' && (
          <div className="space-y-4">
            <p className="text-sm text-emerald-400 font-medium">Scores saved.</p>
            <div className="flex gap-3">
              <button
                onClick={startNewPlayer}
                className="bg-white text-black text-sm px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors"
              >
                Next Player
              </button>
              <button
                onClick={cancelCollection}
                className="bg-zinc-800 text-white text-sm px-4 py-2 rounded-md hover:bg-zinc-700 transition-colors"
              >
                Done Collecting
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Run Analysis ── */}
      {hasData && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-400">Run Analysis</p>
            <p className="text-xs text-zinc-500 mt-1">
              Generates learning curves, bootstrap CIs, and the agent vs human comparison. Updates the Dashboard and Evaluation pages.
            </p>
          </div>
          {analyzeResult && (
            <p className={`text-xs ${analyzeResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {analyzeResult.message}
            </p>
          )}
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="bg-white text-black text-sm px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {analyzing ? 'Running analysis...' : 'Run Analysis'}
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {loading ? (
        <p className="text-sm text-zinc-500 animate-pulse">Loading human baseline data...</p>
      ) : !hasData ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            No data yet — use the collection panel above to play and record scores.
          </p>
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
