'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 600;
const CANVAS_H = 400;
const PADDLE_W = 10;
const PADDLE_H = 60;
const BALL_SIZE = 8;
const WINNING_SCORE = 21;
const BALL_SPEED_INIT = 4;
const BALL_SPEED_MAX = 8;
const BALL_SPEED_INCREMENT = 0.15;
const PADDLE_SPEED_HUMAN = 5;
const PADDLE_SPEED_AI_EASY = 3;
const PADDLE_SPEED_AI_HARD = 5;
const AI_EASY_ACCURACY = 0.75;
const AI_HARD_ACCURACY = 0.95;

type GameMode = 'easy' | 'hard' | 'ai-vs-ai';
type GameState = 'IDLE' | 'PLAYING' | 'GAME_OVER';

interface GameStateRef {
  mode: GameMode;
  state: GameState;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  ballSpeed: number;
  leftY: number;
  rightY: number;
  scoreLeft: number;
  scoreRight: number;
  winner: string;
  keys: Set<string>;
  lastTime: number;
}

// ─── AI logic ─────────────────────────────────────────────────────────────────
function aiMove(
  paddleY: number,
  ballY: number,
  ballVX: number,
  isLeft: boolean,
  speed: number,
  accuracy: number
): number {
  const relevant = isLeft ? ballVX < 0 : ballVX > 0;
  if (!relevant && Math.random() > 0.3) return paddleY;

  const target = ballY - PADDLE_H / 2;
  const diff = target - paddleY;

  if (Math.random() > accuracy) return paddleY + (Math.random() - 0.5) * speed;

  if (Math.abs(diff) < 2) return paddleY;
  if (diff > 0) return paddleY + Math.min(diff, speed);
  return paddleY + Math.max(diff, -speed);
}

function clampPaddle(y: number): number {
  return Math.max(0, Math.min(CANVAS_H - PADDLE_H, y));
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, gs: GameStateRef) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(gs.scoreLeft), CANVAS_W / 2 - 70, 50);
  ctx.fillText(String(gs.scoreRight), CANVAS_W / 2 + 70, 50);

  ctx.fillStyle = '#555';
  ctx.font = '28px monospace';
  ctx.fillText('|', CANVAS_W / 2, 50);

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(10, gs.leftY, PADDLE_W, PADDLE_H, 3);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(CANVAS_W - 10 - PADDLE_W, gs.rightY, PADDLE_W, PADDLE_H, 3);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(gs.ballX - BALL_SIZE / 2, gs.ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE, 2);
  ctx.fill();

  if (gs.state === 'IDLE') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PONG', CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press SPACE to start', CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText('First to 21 wins', CANVAS_W / 2, CANVAS_H / 2 + 35);
  }

  if (gs.state === 'GAME_OVER') {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${gs.winner} Wins!`, CANVAS_W / 2, CANVAS_H / 2 - 25);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press SPACE to restart', CANVAS_W / 2, CANVAS_H / 2 + 15);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameStateRef>({
    mode: 'easy',
    state: 'IDLE',
    ballX: CANVAS_W / 2,
    ballY: CANVAS_H / 2,
    ballVX: BALL_SPEED_INIT,
    ballVY: BALL_SPEED_INIT * 0.7,
    ballSpeed: BALL_SPEED_INIT,
    leftY: CANVAS_H / 2 - PADDLE_H / 2,
    rightY: CANVAS_H / 2 - PADDLE_H / 2,
    scoreLeft: 0,
    scoreRight: 0,
    winner: '',
    keys: new Set(),
    lastTime: 0,
  });
  const rafRef = useRef<number | null>(null);
  const [mode, setMode] = useState<GameMode>('easy');
  const [gameState, setGameState] = useState<GameState>('IDLE');

  const resetBall = useCallback((direction: 1 | -1 = 1) => {
    const gs = gsRef.current;
    gs.ballSpeed = BALL_SPEED_INIT;
    gs.ballX = CANVAS_W / 2;
    gs.ballY = CANVAS_H / 2;
    const angle = (Math.random() * 40 - 20) * (Math.PI / 180);
    gs.ballVX = direction * gs.ballSpeed * Math.cos(angle);
    gs.ballVY = gs.ballSpeed * Math.sin(angle);
  }, []);

  const resetGame = useCallback(() => {
    const gs = gsRef.current;
    gs.scoreLeft = 0;
    gs.scoreRight = 0;
    gs.leftY = CANVAS_H / 2 - PADDLE_H / 2;
    gs.rightY = CANVAS_H / 2 - PADDLE_H / 2;
    gs.winner = '';
    gs.state = 'PLAYING';
    resetBall(1);
    setGameState('PLAYING');
  }, [resetBall]);

  const gameLoop = useCallback((timestamp: number) => {
    const gs = gsRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gs.state !== 'PLAYING') {
      draw(ctx, gs);
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const delta = Math.min(timestamp - gs.lastTime, 50);
    gs.lastTime = timestamp;
    const dt = delta / (1000 / 60);

    const isAiVsAi = gs.mode === 'ai-vs-ai';
    const isHard = gs.mode === 'hard';

    if (isAiVsAi) {
      gs.leftY = clampPaddle(
        aiMove(gs.leftY, gs.ballY, gs.ballVX, true, PADDLE_SPEED_AI_HARD * dt, AI_HARD_ACCURACY)
      );
      gs.rightY = clampPaddle(
        aiMove(gs.rightY, gs.ballY, gs.ballVX, false, PADDLE_SPEED_AI_HARD * dt, AI_HARD_ACCURACY)
      );
    } else {
      if (gs.keys.has('w') || gs.keys.has('arrowup')) {
        gs.leftY = clampPaddle(gs.leftY - PADDLE_SPEED_HUMAN * dt);
      }
      if (gs.keys.has('s') || gs.keys.has('arrowdown')) {
        gs.leftY = clampPaddle(gs.leftY + PADDLE_SPEED_HUMAN * dt);
      }

      const aiSpeed = isHard ? PADDLE_SPEED_AI_HARD : PADDLE_SPEED_AI_EASY;
      const aiAcc = isHard ? AI_HARD_ACCURACY : AI_EASY_ACCURACY;
      gs.rightY = clampPaddle(aiMove(gs.rightY, gs.ballY, gs.ballVX, false, aiSpeed * dt, aiAcc));
    }

    gs.ballX += gs.ballVX * dt;
    gs.ballY += gs.ballVY * dt;

    if (gs.ballY - BALL_SIZE / 2 <= 0) {
      gs.ballY = BALL_SIZE / 2;
      gs.ballVY = Math.abs(gs.ballVY);
    }
    if (gs.ballY + BALL_SIZE / 2 >= CANVAS_H) {
      gs.ballY = CANVAS_H - BALL_SIZE / 2;
      gs.ballVY = -Math.abs(gs.ballVY);
    }

    const leftPaddleX = 10 + PADDLE_W;
    const rightPaddleX = CANVAS_W - 10 - PADDLE_W;

    if (
      gs.ballVX < 0 &&
      gs.ballX - BALL_SIZE / 2 <= leftPaddleX &&
      gs.ballX + BALL_SIZE / 2 >= 10 &&
      gs.ballY >= gs.leftY &&
      gs.ballY <= gs.leftY + PADDLE_H
    ) {
      gs.ballX = leftPaddleX + BALL_SIZE / 2;
      const hitPos = (gs.ballY - gs.leftY) / PADDLE_H - 0.5;
      const angle = hitPos * 60 * (Math.PI / 180);
      gs.ballSpeed = Math.min(gs.ballSpeed + BALL_SPEED_INCREMENT, BALL_SPEED_MAX);
      gs.ballVX = gs.ballSpeed * Math.cos(angle);
      gs.ballVY = gs.ballSpeed * Math.sin(angle);
    }

    if (
      gs.ballVX > 0 &&
      gs.ballX + BALL_SIZE / 2 >= rightPaddleX &&
      gs.ballX - BALL_SIZE / 2 <= CANVAS_W - 10 &&
      gs.ballY >= gs.rightY &&
      gs.ballY <= gs.rightY + PADDLE_H
    ) {
      gs.ballX = rightPaddleX - BALL_SIZE / 2;
      const hitPos = (gs.ballY - gs.rightY) / PADDLE_H - 0.5;
      const angle = hitPos * 60 * (Math.PI / 180);
      gs.ballSpeed = Math.min(gs.ballSpeed + BALL_SPEED_INCREMENT, BALL_SPEED_MAX);
      gs.ballVX = -(gs.ballSpeed * Math.cos(angle));
      gs.ballVY = gs.ballSpeed * Math.sin(angle);
    }

    if (gs.ballX < 0) {
      gs.scoreRight += 1;
      if (gs.scoreRight >= WINNING_SCORE) {
        gs.state = 'GAME_OVER';
        gs.winner = isAiVsAi ? 'Right AI' : 'AI';
        setGameState('GAME_OVER');
      } else {
        resetBall(1);
      }
    } else if (gs.ballX > CANVAS_W) {
      gs.scoreLeft += 1;
      if (gs.scoreLeft >= WINNING_SCORE) {
        gs.state = 'GAME_OVER';
        gs.winner = isAiVsAi ? 'Left AI' : 'Player';
        setGameState('GAME_OVER');
      } else {
        resetBall(-1);
      }
    }

    draw(ctx, gs);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [resetBall]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      gsRef.current.keys.add(key);

      if (e.key === ' ') {
        e.preventDefault();
        const gs = gsRef.current;
        if (gs.state === 'IDLE' || gs.state === 'GAME_OVER') {
          resetGame();
        }
      }

      if (['arrowup', 'arrowdown'].includes(key)) {
        e.preventDefault();
      }
    },
    [resetGame]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    gsRef.current.keys.delete(e.key.toLowerCase());
  }, []);

  const handleModeChange = useCallback(
    (newMode: GameMode) => {
      setMode(newMode);
      gsRef.current.mode = newMode;
      gsRef.current.state = 'IDLE';
      gsRef.current.scoreLeft = 0;
      gsRef.current.scoreRight = 0;
      gsRef.current.leftY = CANVAS_H / 2 - PADDLE_H / 2;
      gsRef.current.rightY = CANVAS_H / 2 - PADDLE_H / 2;
      resetBall(1);
      setGameState('IDLE');
    },
    [resetBall]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gsRef.current.lastTime = performance.now();
    draw(ctx, gsRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameLoop, handleKeyDown, handleKeyUp]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const y = ((touch.clientY - rect.top) / rect.height) * CANVAS_H;
    gsRef.current.leftY = clampPaddle(y - PADDLE_H / 2);
  }, []);

  const modes: { id: GameMode; label: string }[] = [
    { id: 'easy', label: 'vs Easy AI' },
    { id: 'hard', label: 'vs Hard AI' },
    { id: 'ai-vs-ai', label: 'AI vs AI' },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {modes.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className={
              mode === id
                ? 'bg-white text-black text-sm px-3 py-1.5 rounded-md'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-3 py-1.5 rounded-md transition-colors'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="block max-w-full rounded-lg border border-zinc-800"
        style={{ imageRendering: 'crisp-edges' }}
        onTouchMove={handleTouchMove}
        onTouchStart={(e) => e.preventDefault()}
      />

      {/* Status bar */}
      <p className="text-sm text-zinc-500">
        {mode === 'easy' ? 'Easy AI' : mode === 'hard' ? 'Hard AI' : 'AI vs AI'} &middot;{' '}
        {gameState === 'PLAYING' ? 'Playing' : gameState === 'GAME_OVER' ? 'Game over' : 'Waiting'} &middot; First to {WINNING_SCORE} wins
      </p>

      {/* Controls */}
      {mode !== 'ai-vs-ai' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4 text-sm text-zinc-400 w-full max-w-md">
          <p className="text-xs font-medium text-zinc-500 mb-2">Controls — Left Paddle</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span>
              <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 text-xs">W</kbd>{' '}
              /{' '}
              <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 text-xs">↑</kbd>{' '}
              Move up
            </span>
            <span>
              <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 text-xs">S</kbd>{' '}
              /{' '}
              <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 text-xs">↓</kbd>{' '}
              Move down
            </span>
            <span>
              <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 text-xs">Space</kbd>{' '}
              Start / Restart
            </span>
            <span className="text-zinc-600">Touch: drag on canvas</span>
          </div>
        </div>
      )}
    </div>
  );
}
