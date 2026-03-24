"""FastAPI WebSocket server for the Pong PPO dashboard.

Endpoints:
  GET  /api/checkpoints          → list all trained model checkpoints
  WS   /ws/watch                 → stream ALE/Pong-v5 with one PPO model vs game AI
  WS   /ws/ai-vs-ai              → stream custom Pong with two PPO models facing each other
  WS   /ws/play                  → receive browser game frames, return PPO action

Start:
    cd <project_root>
    python3 -m uvicorn server.api_server:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import sys
from collections import deque
from pathlib import Path
from typing import Any

import ale_py
import gymnasium as gym
import numpy as np
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from stable_baselines3 import PPO

PROJECT_ROOT = Path(__file__).parent.parent
OUTPUTS_ROOT = PROJECT_ROOT / "outputs" / "ppo_pong"
sys.path.insert(0, str(PROJECT_ROOT / "src"))

gym.register_envs(ale_py)
ENV_ID = "ALE/Pong-v5"

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Pong PPO Server", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ──────────────────────────────────────────────────────────────────


def _encode_frame(frame: np.ndarray, quality: int = 78) -> str:
    img = Image.fromarray(frame)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


def _parse_budget_steps(label: str) -> int:
    s = label.replace("_steps", "").upper()
    for suffix, mult in (("B", 1_000_000_000), ("M", 1_000_000), ("K", 1_000)):
        if s.endswith(suffix):
            try:
                return int(float(s[:-1]) * mult)
            except ValueError:
                pass
    try:
        return int(s)
    except ValueError:
        return 0


def _build_atari_env(seed: int) -> gym.Env:
    """Single ALE env with training-identical preprocessing + rgb_array rendering."""
    env: gym.Env = gym.make(ENV_ID, render_mode="rgb_array", frameskip=1)
    env = gym.wrappers.AtariPreprocessing(
        env, screen_size=84, frame_skip=4, grayscale_obs=True,
        grayscale_newaxis=False, scale_obs=False,
    )
    if hasattr(gym.wrappers, "FrameStackObservation"):
        env = gym.wrappers.FrameStackObservation(env, stack_size=4)
    else:
        env = gym.wrappers.FrameStack(env, num_stack=4)
    return env


class _AISession:
    """PPO model with a rolling 4-frame observation buffer."""

    def __init__(self, model_path: str) -> None:
        self.model = PPO.load(model_path, device="cpu")
        self._buf: deque[np.ndarray] = deque(
            [np.zeros((84, 84), dtype=np.uint8)] * 4, maxlen=4
        )

    def predict(self, frame: np.ndarray) -> int:
        self._buf.append(frame)
        obs = np.stack(list(self._buf), axis=0)  # (4, 84, 84) — matches training obs_space
        action, _ = self.model.predict(obs, deterministic=True)
        return int(action)

    def reset(self) -> None:
        for i in range(4):
            self._buf[i] = np.zeros((84, 84), dtype=np.uint8)


# ── Custom two-player Pong physics ───────────────────────────────────────────


class _PongPhysics:
    """Lightweight Pong used for AI-vs-AI and Human-vs-AI modes.

    Dimensions and colours loosely match ALE/Pong-v5 so that models trained
    on real Atari frames have a reasonable observation.

    Actions follow the ALE convention:
        0 = NOOP  |  2 = UP (paddle moves up)  |  3 = DOWN
    Any other value is treated as NOOP.
    """

    W, H = 160, 210
    PADDLE_W, PADDLE_H = 5, 20
    BALL_R = 3
    PADDLE_SPEED = 3.0
    BALL_SPEED_INIT = 4.0
    BALL_SPEED_MAX = 8.0

    # ALE-ish colours (RGB)
    _BG = np.array([0, 0, 0], dtype=np.uint8)
    _LEFT_COL = np.array([213, 130, 74], dtype=np.uint8)   # orange – Atari opponent
    _RIGHT_COL = np.array([92, 186, 92], dtype=np.uint8)   # green  – Atari agent
    _BALL_COL = np.array([236, 236, 236], dtype=np.uint8)

    def __init__(self) -> None:
        self._rng = np.random.default_rng()
        self.scores = [0, 0]
        self.ball = np.zeros(2, dtype=float)
        self.ball_v = np.zeros(2, dtype=float)
        self.paddles = np.zeros((2, 2), dtype=float)  # [[lx,ly],[rx,ry]]
        self._reset_all(seed=None)

    def reset(self, seed: int | None = None) -> tuple[np.ndarray, np.ndarray]:
        self._rng = np.random.default_rng(seed)
        self.scores = [0, 0]
        self._reset_all(seed)
        return self._obs(0), self._obs(1)

    @staticmethod
    def _random_angle(rng: np.random.Generator) -> float:
        """Return an angle in [0.4, 0.8] rad (~23–46°), randomly ±.
        Ensures the ball always has a meaningful vertical component so it
        can't get stuck bouncing horizontally forever."""
        magnitude = rng.uniform(0.4, 0.8)
        return float(magnitude * rng.choice([-1.0, 1.0]))

    def _reset_all(self, seed: int | None) -> None:
        rng = np.random.default_rng(seed)
        cx, cy = self.W / 2, self.H / 2
        self.ball = np.array([cx, cy], dtype=float)
        angle = self._random_angle(rng)
        direction = float(rng.choice([-1.0, 1.0]))
        self.ball_v = np.array([
            direction * self.BALL_SPEED_INIT * np.cos(angle),
            self.BALL_SPEED_INIT * np.sin(angle),
        ])
        lx = 12.0
        rx = self.W - 12.0 - self.PADDLE_W
        self.paddles = np.array([
            [lx, cy - self.PADDLE_H / 2],
            [rx, cy - self.PADDLE_H / 2],
        ], dtype=float)

    def _reset_ball(self, scorer: int) -> None:
        cx, cy = self.W / 2, self.H / 2
        self.ball = np.array([cx, cy], dtype=float)
        angle = self._random_angle(self._rng)
        direction = 1.0 if scorer == 1 else -1.0
        self.ball_v = np.array([
            direction * self.BALL_SPEED_INIT * np.cos(angle),
            self.BALL_SPEED_INIT * np.sin(angle),
        ])

    # ── Observations ─────────────────────────────────────────────────────────

    def render_rgb(self) -> np.ndarray:
        frame = np.full((self.H, self.W, 3), self._BG, dtype=np.uint8)
        # Court divider
        for y in range(0, self.H, 8):
            frame[y : y + 4, self.W // 2] = 80
        # Left paddle
        lx, ly = int(self.paddles[0, 0]), int(self.paddles[0, 1])
        frame[ly : ly + self.PADDLE_H, lx : lx + self.PADDLE_W] = self._LEFT_COL
        # Right paddle
        rx, ry = int(self.paddles[1, 0]), int(self.paddles[1, 1])
        frame[ry : ry + self.PADDLE_H, rx : rx + self.PADDLE_W] = self._RIGHT_COL
        # Ball
        bx, by = int(self.ball[0]), int(self.ball[1])
        r = self.BALL_R
        frame[
            max(0, by - r) : min(self.H, by + r + 1),
            max(0, bx - r) : min(self.W, bx + r + 1),
        ] = self._BALL_COL
        return frame

    def _obs(self, player: int) -> np.ndarray:
        """84×84 grayscale synthetic observation for each player."""
        frame = self.render_rgb()
        if player == 1:                     # right player: mirror so "own" paddle is on right
            frame = frame[:, ::-1, :].copy()
        gray = Image.fromarray(frame).convert("L").resize((84, 84), Image.BILINEAR)
        return np.array(gray, dtype=np.uint8)

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(
        self, left_action: int, right_action: int
    ) -> tuple[float, float, bool, np.ndarray, np.ndarray, np.ndarray]:
        """Returns (left_reward, right_reward, done, left_obs, right_obs, rgb_frame)."""
        # Move paddles.
        # ALE Pong action space: 0=NOOP, 1=FIRE, 2=RIGHT(UP), 3=LEFT(DOWN),
        #                        4=RIGHTFIRE(UP), 5=LEFTFIRE(DOWN)
        for i, action in enumerate([left_action, right_action]):
            if action in (2, 4):   # UP
                self.paddles[i, 1] -= self.PADDLE_SPEED
            elif action in (3, 5): # DOWN
                self.paddles[i, 1] += self.PADDLE_SPEED
            self.paddles[i, 1] = float(
                np.clip(self.paddles[i, 1], 0, self.H - self.PADDLE_H)
            )

        # Move ball
        self.ball += self.ball_v

        # Wall bounces
        if self.ball[1] <= 0:
            self.ball[1] = 0.0
            self.ball_v[1] = abs(self.ball_v[1])
        elif self.ball[1] >= self.H - 1:
            self.ball[1] = float(self.H - 1)
            self.ball_v[1] = -abs(self.ball_v[1])

        # Left paddle collision — only when ball is moving left
        lx, ly = self.paddles[0]
        if (self.ball_v[0] < 0
                and lx <= self.ball[0] <= lx + self.PADDLE_W + 1
                and ly <= self.ball[1] <= ly + self.PADDLE_H):
            hit_pos = (self.ball[1] - ly) / self.PADDLE_H - 0.5  # −0.5 top … +0.5 bottom
            new_speed = min(float(np.linalg.norm(self.ball_v)) * 1.04, self.BALL_SPEED_MAX)
            angle = hit_pos * (np.pi / 3)   # up to ±60° deflection
            self.ball_v[0] = abs(new_speed * np.cos(angle))   # always going right
            self.ball_v[1] = new_speed * np.sin(angle)
            self.ball[0] = lx + self.PADDLE_W + 1.0           # push out to avoid re-collision

        # Right paddle collision — only when ball is moving right
        rx, ry = self.paddles[1]
        if (self.ball_v[0] > 0
                and rx - 1 <= self.ball[0] <= rx + self.PADDLE_W
                and ry <= self.ball[1] <= ry + self.PADDLE_H):
            hit_pos = (self.ball[1] - ry) / self.PADDLE_H - 0.5
            new_speed = min(float(np.linalg.norm(self.ball_v)) * 1.04, self.BALL_SPEED_MAX)
            angle = hit_pos * (np.pi / 3)
            self.ball_v[0] = -abs(new_speed * np.cos(angle))  # always going left
            self.ball_v[1] = new_speed * np.sin(angle)
            self.ball[0] = rx - 1.0

        # Scoring
        lr = rr = 0.0
        done = False
        if self.ball[0] < 0:
            rr, lr = 1.0, -1.0
            self.scores[1] += 1
            self._reset_ball(1)
            if self.scores[1] >= 21:
                done = True
        elif self.ball[0] > self.W - 1:
            lr, rr = 1.0, -1.0
            self.scores[0] += 1
            self._reset_ball(0)
            if self.scores[0] >= 21:
                done = True

        rgb = self.render_rgb()
        return lr, rr, done, self._obs(0), self._obs(1), rgb

    def _speed_up(self) -> None:
        speed = float(np.linalg.norm(self.ball_v))
        new_speed = min(speed * 1.04, self.BALL_SPEED_MAX)
        if speed > 0:
            self.ball_v = self.ball_v / speed * new_speed


# ── REST: checkpoint discovery ────────────────────────────────────────────────


@app.get("/api/checkpoints")
def list_checkpoints() -> dict[str, Any]:
    if not OUTPUTS_ROOT.exists():
        return {"checkpoints": []}

    results: list[dict[str, Any]] = []

    for budget_dir in sorted(OUTPUTS_ROOT.iterdir()):
        if not budget_dir.is_dir() or budget_dir.name == "analysis":
            continue
        blabel = budget_dir.name
        bsteps = _parse_budget_steps(blabel)

        for seed_dir in sorted(budget_dir.iterdir()):
            if not seed_dir.is_dir() or not seed_dir.name.startswith("seed_"):
                continue
            try:
                seed = int(seed_dir.name.split("_")[1])
            except (IndexError, ValueError):
                continue

            final = seed_dir / "final_model.zip"
            if final.exists():
                results.append({
                    "id": f"{blabel}/seed_{seed}/final",
                    "path": str(final),
                    "budget_label": blabel,
                    "budget_steps": bsteps,
                    "seed": seed,
                    "checkpoint_type": "final",
                    "checkpoint_steps": bsteps,
                    "display_name": f"{blabel} · seed {seed} (final)",
                    "sort_key": bsteps * 1000 + seed,
                })

            models_dir = seed_dir / "models"
            if models_dir.exists():
                for ckpt in sorted(models_dir.glob("checkpoint_*.zip")):
                    try:
                        csteps = int(ckpt.stem.split("_")[1])
                    except (IndexError, ValueError):
                        continue
                    results.append({
                        "id": f"{blabel}/seed_{seed}/ckpt_{csteps}",
                        "path": str(ckpt),
                        "budget_label": blabel,
                        "budget_steps": bsteps,
                        "seed": seed,
                        "checkpoint_type": "checkpoint",
                        "checkpoint_steps": csteps,
                        "display_name": f"{csteps:,} steps · seed {seed}",
                        "sort_key": csteps * 1000 + seed,
                    })

    results.sort(key=lambda c: c["sort_key"])
    return {"checkpoints": results}


# ── WS helpers ────────────────────────────────────────────────────────────────


async def _recv_stop(ws: WebSocket, timeout: float = 0.001) -> bool:
    """Non-blocking check for a stop message. Returns True if client wants to stop."""
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=timeout)
        return json.loads(raw).get("stop", False)
    except asyncio.TimeoutError:
        return False
    except Exception:
        return True  # disconnected


# ── WS 1: Watch one model vs game AI ────────────────────────────────────────


@app.websocket("/ws/watch")
async def watch_game(
    websocket: WebSocket,
    model_path: str = Query(...),
    seed: int = Query(default=42),
    fps: int = Query(default=20),
    max_episodes: int = Query(default=3),
) -> None:
    await websocket.accept()
    env: gym.Env | None = None
    try:
        model = PPO.load(model_path, device="cpu")
        env = _build_atari_env(seed)
        obs, _ = env.reset(seed=seed)

        ep_return = 0.0
        episode = 0
        delay = 1.0 / max(1, fps)

        while episode < max_episodes:
            if await _recv_stop(websocket):
                break

            action, _ = model.predict(np.array(obs), deterministic=True)
            obs, reward, terminated, truncated, _ = env.step(int(action))
            ep_return += float(reward)
            done = terminated or truncated

            frame = env.render()
            if frame is not None:
                try:
                    await websocket.send_json({
                        "type": "frame",
                        "frame": _encode_frame(frame),
                        "episode_return": ep_return,
                        "episode": episode + 1,
                        "done": done,
                    })
                except Exception:
                    break

            if done:
                await websocket.send_json({
                    "type": "episode_end",
                    "episode": episode + 1,
                    "final_return": ep_return,
                })
                episode += 1
                if episode < max_episodes:
                    obs, _ = env.reset()
                    ep_return = 0.0

            await asyncio.sleep(delay)

        await websocket.send_json({"type": "stream_end", "episodes_played": episode})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        if env is not None:
            try:
                env.close()
            except Exception:
                pass


# ── WS 2: AI vs AI (custom physics Pong) ────────────────────────────────────


@app.websocket("/ws/ai-vs-ai")
async def ai_vs_ai(
    websocket: WebSocket,
    left_model_path: str = Query(...),
    right_model_path: str = Query(...),
    seed: int = Query(default=42),
    fps: int = Query(default=30),
    max_episodes: int = Query(default=3),
) -> None:
    """Two PPO models face each other in a custom Pong physics environment."""
    await websocket.accept()
    try:
        left_ai = _AISession(left_model_path)
        right_ai = _AISession(right_model_path)
        game = _PongPhysics()

        left_obs, right_obs = game.reset(seed=seed)
        left_ret = right_ret = 0.0
        episode = 0
        delay = 1.0 / max(1, fps)

        while episode < max_episodes:
            if await _recv_stop(websocket):
                break

            la = left_ai.predict(left_obs)
            ra = right_ai.predict(right_obs)
            lr, rr, done, left_obs, right_obs, rgb = game.step(la, ra)
            left_ret += lr
            right_ret += rr

            try:
                await websocket.send_json({
                    "type": "frame",
                    "frame": _encode_frame(rgb),
                    "left_return": left_ret,
                    "right_return": right_ret,
                    "scores": game.scores,
                    "episode": episode + 1,
                    "done": done,
                })
            except Exception:
                break

            if done:
                await websocket.send_json({
                    "type": "episode_end",
                    "episode": episode + 1,
                    "left_return": left_ret,
                    "right_return": right_ret,
                    "scores": game.scores,
                })
                episode += 1
                if episode < max_episodes:
                    left_obs, right_obs = game.reset()
                    left_ai.reset()
                    right_ai.reset()
                    left_ret = right_ret = 0.0

            await asyncio.sleep(delay)

        await websocket.send_json({"type": "stream_end", "episodes_played": episode})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass


# ── WS 3: Human vs AI ────────────────────────────────────────────────────────


@app.websocket("/ws/play")
async def human_vs_ai(
    websocket: WebSocket,
    model_path: str = Query(...),
    fps: int = Query(default=30),
) -> None:
    """Human plays against a PPO model in custom Pong.

    The server drives the game. Each tick the server reads the human action from
    the client, steps the physics, streams the frame back, and the PPO model
    controls the right (green) paddle.

    Client sends every frame (or just when action changes):
        {"action": 0|2|3}   # 0=noop, 2=up, 3=down

    Server sends every frame:
        {"type": "frame", "frame": "<base64 JPEG>",
         "scores": [left, right],
         "human_return": float, "ai_return": float,
         "episode": int, "done": bool}
    """
    await websocket.accept()
    try:
        ai = _AISession(model_path)
        game = _PongPhysics()

        # Human is LEFT (orange), AI is RIGHT (green)
        left_obs, right_obs = game.reset(seed=42)
        human_ret = ai_ret = 0.0
        episode = 1
        human_action = 0
        delay = 1.0 / max(1, fps)

        while True:
            # Read latest human action (non-blocking)
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
                msg = json.loads(raw)
                if msg.get("stop"):
                    break
                human_action = int(msg.get("action", 0))
            except asyncio.TimeoutError:
                pass
            except Exception:
                break

            ai_action = ai.predict(right_obs)

            lr, rr, done, left_obs, right_obs, rgb = game.step(human_action, ai_action)
            human_ret += lr
            ai_ret += rr

            try:
                await websocket.send_json({
                    "type": "frame",
                    "frame": _encode_frame(rgb),
                    "scores": game.scores,
                    "human_return": human_ret,
                    "ai_return": ai_ret,
                    "episode": episode,
                    "done": done,
                })
            except Exception:
                break

            if done:
                await websocket.send_json({
                    "type": "episode_end",
                    "episode": episode,
                    "human_return": human_ret,
                    "ai_return": ai_ret,
                    "scores": game.scores,
                })
                episode += 1
                left_obs, right_obs = game.reset()
                ai.reset()
                human_ret = ai_ret = 0.0

            await asyncio.sleep(delay)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
