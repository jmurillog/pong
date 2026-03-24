'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Checkpoint {
  id: string;
  path: string;
  budget_label: string;
  budget_steps: number;
  seed: number;
  checkpoint_type: string;
  checkpoint_steps: number;
  display_name: string;
}

type StreamStatus = 'idle' | 'connecting' | 'playing' | 'done' | 'error' | 'stopped';

interface Props {
  checkpoint: Checkpoint | null;
  label?: string;
  fps?: number;
  maxEpisodes?: number;
}

export default function AIStreamViewer({
  checkpoint,
  label,
  fps = 20,
  maxEpisodes = 3,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [status, setStatus] = useState<StreamStatus>('idle');
  const [episodeReturn, setEpisodeReturn] = useState<number | null>(null);
  const [episode, setEpisode] = useState(1);
  const [episodeHistory, setEpisodeHistory] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    imgRef.current = new Image();
  }, []);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ stop: true }));
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setStatus('stopped');
  }, []);

  const connect = useCallback(() => {
    if (!checkpoint) return;
    stop();

    setStatus('connecting');
    setEpisodeReturn(null);
    setEpisode(1);
    setEpisodeHistory([]);
    setErrorMsg('');

    const params = new URLSearchParams({
      model_path: checkpoint.path,
      seed: '42',
      fps: String(fps),
      max_episodes: String(maxEpisodes),
    });

    const ws = new WebSocket(`ws://localhost:8000/ws/watch?${params}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('playing');

    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('Cannot connect to server. Run: uvicorn server.api_server:app --port 8000');
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (data.type === 'frame') {
        setEpisodeReturn(data.episode_return as number);
        setEpisode(data.episode as number);

        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = `data:image/jpeg;base64,${data.frame as string}`;
      }

      if (data.type === 'episode_end') {
        setEpisodeHistory((h) => [...h, data.final_return as number]);
      }

      if (data.type === 'stream_end') {
        setStatus('done');
      }

      if (data.type === 'error') {
        setStatus('error');
        setErrorMsg(data.message as string);
      }
    };
  }, [checkpoint, fps, maxEpisodes, stop]);

  useEffect(() => {
    if (checkpoint) connect();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoint?.id]);

  const avgReturn =
    episodeHistory.length > 0
      ? episodeHistory.reduce((a, b) => a + b, 0) / episodeHistory.length
      : null;

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <p className="text-xs text-zinc-500">{label}</p>
      )}

      {checkpoint && (
        <p className="text-xs text-zinc-400 truncate">{checkpoint.display_name}</p>
      )}

      {/* Canvas */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Overlays */}
        {(status === 'idle' || !checkpoint) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-600 text-sm">Select a checkpoint to start</p>
          </div>
        )}

        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p className="text-zinc-300 text-sm animate-pulse">Connecting...</p>
            <p className="text-zinc-600 text-xs mt-1">Loading model</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-4">
            <p className="text-red-500 text-sm">Connection failed</p>
            <p className="text-zinc-500 text-xs mt-1 text-center">{errorMsg}</p>
            <button
              onClick={connect}
              className="mt-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p className="text-zinc-300 text-sm">Stream finished</p>
            {avgReturn !== null && (
              <p className={`text-lg font-mono font-semibold mt-1 ${avgReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                avg {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(1)}
              </p>
            )}
            <button
              onClick={connect}
              className="mt-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md"
            >
              Watch again
            </button>
          </div>
        )}

        {status === 'stopped' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p className="text-zinc-400 text-sm">Stopped</p>
            <button
              onClick={connect}
              className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md"
            >
              Restart
            </button>
          </div>
        )}

        {/* Live badge */}
        {status === 'playing' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {checkpoint && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
            <p className="text-xs text-zinc-500 mb-0.5">Episode</p>
            <p className="text-sm font-mono text-white">{episode} / {maxEpisodes}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
            <p className="text-xs text-zinc-500 mb-0.5">Return</p>
            <p className={`text-sm font-mono ${episodeReturn === null ? 'text-zinc-600' : episodeReturn > 0 ? 'text-emerald-500' : episodeReturn < 0 ? 'text-red-500' : 'text-zinc-400'}`}>
              {episodeReturn !== null ? `${episodeReturn > 0 ? '+' : ''}${episodeReturn.toFixed(0)}` : '—'}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-2">
            <p className="text-xs text-zinc-500 mb-0.5">Avg</p>
            <p className={`text-sm font-mono ${avgReturn === null ? 'text-zinc-600' : avgReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {avgReturn !== null ? `${avgReturn > 0 ? '+' : ''}${avgReturn.toFixed(1)}` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Episode history chips */}
      {episodeHistory.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {episodeHistory.map((r, i) => (
            <span
              key={i}
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                r > 0
                  ? 'border-emerald-800 text-emerald-500'
                  : r < 0
                    ? 'border-red-900 text-red-500'
                    : 'border-zinc-700 text-zinc-500'
              }`}
            >
              ep{i + 1}: {r > 0 ? '+' : ''}{r.toFixed(0)}
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      {checkpoint && status !== 'idle' && (
        <div className="flex gap-2">
          {status === 'playing' ? (
            <button
              onClick={stop}
              className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-md transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={connect}
              className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-md transition-colors"
            >
              {status === 'done' || status === 'stopped' ? 'Replay' : 'Start'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
