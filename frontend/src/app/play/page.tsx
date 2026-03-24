'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Play } from 'lucide-react';

const PongGame = dynamic(() => import('@/components/PongGame'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-zinc-900 border border-zinc-800 rounded-lg">
      <p className="text-zinc-500 animate-pulse text-sm">Loading game...</p>
    </div>
  ),
});

export default function PlayPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Play Pong</h1>
        <p className="text-sm text-zinc-400 mt-1">Human vs AI · First to 21</p>
      </div>

      {/* Game */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <PongGame />
      </div>

      {/* Watch AI link */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white mb-0.5">Watch the trained PPO agent</p>
          <p className="text-xs text-zinc-400">
            Stream live gameplay from trained checkpoints and compare early vs late training.
          </p>
        </div>
        <Link
          href="/watch-ai"
          className="shrink-0 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-3 py-1.5 rounded-md transition-colors"
        >
          <Play size={13} />
          Watch AI
        </Link>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-sm font-medium text-white mb-2">Atari Environment</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The actual PPO agent trains on the ALE (Arcade Learning Environment) version of Pong,
            observing raw pixel frames (84×84 grayscale, 4-frame stack) and receiving +1 or −1
            rewards per point scored.
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-sm font-medium text-white mb-2">Scoring System</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Episode return = (player points) − (opponent points), range [−21, +21]. A return of
            +21 means the player won every point. The human baseline averages this across all
            episodes and players.
          </p>
        </div>
      </div>
    </div>
  );
}
