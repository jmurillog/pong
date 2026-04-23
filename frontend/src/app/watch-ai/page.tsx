'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Checkpoint } from '@/components/AIStreamViewer';

const AIStreamViewer = dynamic(() => import('@/components/AIStreamViewer'), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/3] bg-black rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-zinc-600 text-xs">Loading...</span>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// AI vs AI inline viewer
// ---------------------------------------------------------------------------

type VSStatus = 'idle' | 'connecting' | 'playing' | 'done' | 'error';

function AIVsAIViewer({
  leftPath,
  rightPath,
  fps,
  maxEpisodes,
}: {
  leftPath: string;
  rightPath: string;
  fps: number;
  maxEpisodes: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [status, setStatus] = useState<VSStatus>('idle');
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [leftReturn, setLeftReturn] = useState<number | null>(null);
  const [rightReturn, setRightReturn] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    imgRef.current = new Image();
  }, []);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    setStatus('idle');
  }, []);

  const connect = useCallback(() => {
    if (!leftPath || !rightPath) return;
    stop();
    setStatus('connecting');
    setScores([0, 0]);
    setLeftReturn(null);
    setRightReturn(null);
    setErrorMsg('');

    const params = new URLSearchParams({
      left_model_path: leftPath,
      right_model_path: rightPath,
      fps: String(fps),
      max_episodes: String(maxEpisodes),
    });

    const ws = new WebSocket(`ws://localhost:8000/ws/ai-vs-ai?${params}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('playing');
    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('Cannot connect to server.');
    };
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };
    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(event.data as string); } catch { return; }

      if (data.type === 'frame') {
        const s = data.scores as [number, number];
        setScores(s);
        setLeftReturn(data.left_return as number);
        setRightReturn(data.right_return as number);

        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = `data:image/jpeg;base64,${data.frame as string}`;
      }
      if (data.type === 'stream_end') setStatus('done');
      if (data.type === 'error') {
        setStatus('error');
        setErrorMsg(data.message as string);
      }
    };
  }, [leftPath, rightPath, fps, maxEpisodes, stop]);

  useEffect(() => { return () => stop(); }, [stop]);

  return (
    <div className="flex flex-col gap-3">
      {/* Score display */}
      <div className="flex items-center justify-center gap-4 py-2">
        <span className="text-sm font-mono text-white">LEFT</span>
        <span className="text-2xl font-mono font-semibold text-white">{scores[0]}</span>
        <span className="text-zinc-600">vs</span>
        <span className="text-2xl font-mono font-semibold text-white">{scores[1]}</span>
        <span className="text-sm font-mono text-white">RIGHT</span>
      </div>

      {/* Canvas */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-600 text-sm">Press Start to begin</p>
          </div>
        )}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-zinc-300 text-sm animate-pulse">Connecting...</p>
          </div>
        )}
        {status === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p className="text-zinc-300 text-sm">Match over</p>
            <button onClick={connect} className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md">
              Play again
            </button>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-4">
            <p className="text-red-500 text-sm">Error</p>
            <p className="text-zinc-500 text-xs mt-1 text-center">{errorMsg}</p>
            <button onClick={connect} className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md">
              Retry
            </button>
          </div>
        )}
        {status === 'playing' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Returns row */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
          <p className="text-xs text-zinc-500 mb-0.5">Left Return</p>
          <p className={`text-sm font-mono ${leftReturn === null ? 'text-zinc-600' : leftReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {leftReturn !== null ? `${leftReturn > 0 ? '+' : ''}${leftReturn.toFixed(1)}` : '—'}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
          <p className="text-xs text-zinc-500 mb-0.5">Right Return</p>
          <p className={`text-sm font-mono ${rightReturn === null ? 'text-zinc-600' : rightReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {rightReturn !== null ? `${rightReturn > 0 ? '+' : ''}${rightReturn.toFixed(1)}` : '—'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {status === 'playing' || status === 'connecting' ? (
          <button onClick={stop} className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-md transition-colors">
            Stop
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={!leftPath || !rightPath}
            className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Human vs AI inline viewer
// ---------------------------------------------------------------------------

function HumanVsAIGame({
  modelPath,
  fps,
}: {
  modelPath: string;
  fps: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const actionRef = useRef<number>(0); // 0=NOOP 2=UP 3=DOWN

  const [status, setStatus] = useState<VSStatus>('idle');
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [humanReturn, setHumanReturn] = useState<number | null>(null);
  const [aiReturn, setAiReturn] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    imgRef.current = new Image();
  }, []);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    setStatus('idle');
  }, []);

  const connect = useCallback(() => {
    if (!modelPath) return;
    stop();
    setStatus('connecting');
    setScores([0, 0]);
    setHumanReturn(null);
    setAiReturn(null);
    setErrorMsg('');

    const params = new URLSearchParams({
      model_path: modelPath,
      fps: String(fps),
    });

    const ws = new WebSocket(`ws://localhost:8000/ws/play?${params}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('playing');
    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('Cannot connect to server.');
    };
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };
    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(event.data as string); } catch { return; }

      if (data.type === 'frame') {
        const s = data.scores as [number, number];
        setScores(s);
        setHumanReturn(data.human_return as number);
        setAiReturn(data.ai_return as number);

        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = `data:image/jpeg;base64,${data.frame as string}`;
      }
      if (data.type === 'stream_end') setStatus('done');
      if (data.type === 'error') {
        setStatus('error');
        setErrorMsg(data.message as string);
      }
    };
  }, [modelPath, fps, stop]);

  // Keyboard controls — send action immediately on key change to minimise input lag
  useEffect(() => {
    const sendAction = (action: number) => {
      actionRef.current = action;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action }));
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'ArrowUp') { e.preventDefault(); sendAction(2); }
      if (e.key === 's' || e.key === 'ArrowDown') { e.preventDefault(); sendAction(3); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (['w', 'ArrowUp', 's', 'ArrowDown'].includes(e.key)) sendAction(0);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => { return () => stop(); }, [stop]);

  return (
    <div className="flex flex-col gap-3">
      {/* Score display */}
      <div className="flex items-center justify-center gap-4 py-2">
        <span className="text-sm font-mono text-white">You</span>
        <span className="text-2xl font-mono font-semibold text-white">{scores[0]}</span>
        <span className="text-zinc-600">:</span>
        <span className="text-2xl font-mono font-semibold text-white">{scores[1]}</span>
        <span className="text-sm font-mono text-white">AI</span>
      </div>

      {/* Canvas */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-600 text-sm">Press Start to play</p>
          </div>
        )}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-zinc-300 text-sm animate-pulse">Connecting...</p>
          </div>
        )}
        {status === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p className="text-zinc-300 text-sm">Game over</p>
            <button onClick={connect} className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md">
              Play again
            </button>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-4">
            <p className="text-red-500 text-sm">Error</p>
            <p className="text-zinc-500 text-xs mt-1 text-center">{errorMsg}</p>
            <button onClick={connect} className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md">
              Retry
            </button>
          </div>
        )}
        {status === 'playing' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Returns row */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
          <p className="text-xs text-zinc-500 mb-0.5">Your Return</p>
          <p className={`text-sm font-mono ${humanReturn === null ? 'text-zinc-600' : humanReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {humanReturn !== null ? `${humanReturn > 0 ? '+' : ''}${humanReturn.toFixed(1)}` : '—'}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
          <p className="text-xs text-zinc-500 mb-0.5">AI Return</p>
          <p className={`text-sm font-mono ${aiReturn === null ? 'text-zinc-600' : aiReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {aiReturn !== null ? `${aiReturn > 0 ? '+' : ''}${aiReturn.toFixed(1)}` : '—'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {status === 'playing' || status === 'connecting' ? (
          <button onClick={stop} className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-md transition-colors">
            Stop
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={!modelPath}
            className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
          >
            Start
          </button>
        )}
      </div>

      {/* Controls reminder */}
      <p className="text-xs text-zinc-600 text-center">
        <kbd className="bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-500">W</kbd>{' '}
        /{' '}
        <kbd className="bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-500">↑</kbd>{' '}
        up &nbsp;·&nbsp;{' '}
        <kbd className="bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-500">S</kbd>{' '}
        /{' '}
        <kbd className="bg-zinc-900 border border-zinc-700 px-1 rounded text-zinc-500">↓</kbd>{' '}
        down &nbsp;·&nbsp; You control the left paddle
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkpoint selector helper
// ---------------------------------------------------------------------------

function CheckpointSelect({
  label,
  value,
  onChange,
  grouped,
  loading,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  grouped: Record<string, Checkpoint[]>;
  loading: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {loading && <option>Loading...</option>}
        {!loading && Object.keys(grouped).length === 0 && (
          <option value="">No checkpoints found</option>
        )}
        {Object.entries(grouped).map(([group, ckpts]) => (
          <optgroup key={group} label={group}>
            {ckpts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = 'watch' | 'ai-vs-ai' | 'play';

export default function WatchAIPage() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [tab, setTab] = useState<Tab>('watch');

  // Watch AI tab state
  const [watchId, setWatchId] = useState('');
  const [watchFps, setWatchFps] = useState(20);
  const [watchEpisodes, setWatchEpisodes] = useState(3);

  // AI vs AI tab state
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [vsAiFps, setVsAiFps] = useState(30);
  const [vsAiEpisodes, setVsAiEpisodes] = useState(3);

  // Play vs AI tab state
  const [playId, setPlayId] = useState('');
  const [playFps, setPlayFps] = useState(30);

  useEffect(() => {
    fetch('http://localhost:8000/api/checkpoints')
      .then((r) => r.json())
      .then((d: { checkpoints: Checkpoint[] }) => {
        setCheckpoints(d.checkpoints);
        if (d.checkpoints.length > 0) {
          setWatchId(d.checkpoints[d.checkpoints.length - 1].id);
          setLeftId(d.checkpoints[0].id);
          setRightId(d.checkpoints[d.checkpoints.length - 1].id);
          setPlayId(d.checkpoints[d.checkpoints.length - 1].id);
        }
      })
      .catch(() =>
        setServerError(
          'Server offline — start it with: python3 -m uvicorn server.api_server:app --port 8000',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const grouped = checkpoints.reduce<Record<string, Checkpoint[]>>((acc, c) => {
    const key = `${c.budget_label} · seed ${c.seed}`;
    (acc[key] ??= []).push(c);
    return acc;
  }, {});

  const watchCkpt = checkpoints.find((c) => c.id === watchId) ?? null;
  const leftCkpt = checkpoints.find((c) => c.id === leftId) ?? null;
  const rightCkpt = checkpoints.find((c) => c.id === rightId) ?? null;
  const playCkpt = checkpoints.find((c) => c.id === playId) ?? null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'watch', label: 'Watch' },
    { id: 'ai-vs-ai', label: 'AI vs AI' },
    { id: 'play', label: 'Play vs AI' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Stephano AI</h1>
        <p className="text-sm text-zinc-400 mt-1">Watch and play against our trained PPO agent</p>
      </div>

      {/* Server error banner */}
      {serverError && (
        <div className="bg-zinc-900 border border-red-900 rounded-lg p-4">
          <p className="text-red-500 text-sm font-medium mb-1">Server offline</p>
          <p className="text-zinc-400 text-xs font-mono">{serverError}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={
              tab === id
                ? 'px-4 py-2 text-sm text-white border-b-2 border-blue-500 -mb-px'
                : 'px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent -mb-px transition-colors'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Watch Stephano */}
      {tab === 'watch' && (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Left panel: controls */}
          <div className="space-y-4">
            <CheckpointSelect
              label="Checkpoint"
              value={watchId}
              onChange={setWatchId}
              grouped={grouped}
              loading={loading}
            />

            <div>
              <p className="text-xs text-zinc-500 mb-1">FPS</p>
              <select
                value={watchFps}
                onChange={(e) => setWatchFps(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none"
              >
                {[10, 20, 30].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-1">Episodes</p>
              <select
                value={watchEpisodes}
                onChange={(e) => setWatchEpisodes(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none"
              >
                {[1, 3, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Right panel: viewer */}
          <div className="space-y-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-500 leading-relaxed">
              <span className="text-emerald-500 font-medium">Right (green)</span> = Stephano, our PPO agent &nbsp;·&nbsp;{' '}
              <span className="text-orange-400 font-medium">Left (orange)</span> = game&apos;s built-in AI.
              Early checkpoints haven&apos;t learned yet — poor play is expected.
            </div>
            <AIStreamViewer
              checkpoint={watchCkpt}
              fps={watchFps}
              maxEpisodes={watchEpisodes}
            />
          </div>
        </div>
      )}

      {/* Tab 2: AI vs AI */}
      {tab === 'ai-vs-ai' && (
        <div className="space-y-6">
          {/* Selector row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CheckpointSelect
              label="Left (orange)"
              value={leftId}
              onChange={setLeftId}
              grouped={grouped}
              loading={loading}
            />
            <CheckpointSelect
              label="Right (green)"
              value={rightId}
              onChange={setRightId}
              grouped={grouped}
              loading={loading}
            />
          </div>

          {/* FPS + Episodes */}
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">FPS</p>
              <select
                value={vsAiFps}
                onChange={(e) => setVsAiFps(Number(e.target.value))}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none"
              >
                {[10, 20, 30].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Episodes</p>
              <select
                value={vsAiEpisodes}
                onChange={(e) => setVsAiEpisodes(Number(e.target.value))}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none"
              >
                {[1, 3, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Viewer */}
          <div className="max-w-lg">
            <AIVsAIViewer
              leftPath={leftCkpt?.path ?? ''}
              rightPath={rightCkpt?.path ?? ''}
              fps={vsAiFps}
              maxEpisodes={vsAiEpisodes}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Play vs AI */}
      {tab === 'play' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            {/* Left panel */}
            <div className="space-y-4">
              <CheckpointSelect
                label="AI opponent"
                value={playId}
                onChange={setPlayId}
                grouped={grouped}
                loading={loading}
              />
              <div>
                <p className="text-xs text-zinc-500 mb-1">FPS</p>
                <select
                  value={playFps}
                  onChange={(e) => setPlayFps(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {[10, 20, 30].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Right panel: game */}
            <HumanVsAIGame
              modelPath={playCkpt?.path ?? ''}
              fps={playFps}
            />
          </div>
        </div>
      )}
    </div>
  );
}
