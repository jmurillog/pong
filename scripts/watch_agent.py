#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from stable_baselines3 import PPO

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pong_ppo.envs import build_single_env


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Watch a trained PPO agent playing Pong.")
    parser.add_argument("--model", required=True, help="Path to SB3 .zip model")
    parser.add_argument("--env-id", default="ALE/Pong-v5")
    parser.add_argument("--episodes", type=int, default=1)
    parser.add_argument("--seed", type=int, default=123)
    parser.add_argument(
        "--render-mode",
        choices=["human", "rgb_array"],
        default="human",
        help="'human' for live window, 'rgb_array' for recording frames.",
    )
    parser.add_argument(
        "--video-output",
        default="",
        help="Output .mp4 path. Required if --render-mode rgb_array.",
    )
    parser.add_argument("--fps", type=int, default=12)
    parser.add_argument(
        "--max-steps",
        type=int,
        default=20_000,
        help="Safety cap per episode to avoid endless rollouts.",
    )
    parser.add_argument("--device", default="auto")
    return parser


def run_episode(model: PPO, env, *, deterministic: bool, max_steps: int) -> tuple[float, list[np.ndarray]]:
    obs, _ = env.reset()
    done = False
    truncated = False
    ep_return = 0.0
    frames: list[np.ndarray] = []
    steps = 0

    while not (done or truncated):
        action, _ = model.predict(obs, deterministic=deterministic)
        obs, reward, done, truncated, _ = env.step(action)
        ep_return += float(reward)
        frame = env.render()
        if frame is not None:
            frames.append(np.asarray(frame))
        steps += 1
        if steps >= max_steps:
            break

    return ep_return, frames


def main() -> None:
    args = build_parser().parse_args()
    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"Model path does not exist: {model_path}")

    if args.render_mode == "rgb_array" and not args.video_output:
        raise SystemExit("--video-output is required with --render-mode rgb_array")

    model = PPO.load(str(model_path), device=args.device)
    env = build_single_env(
        args.env_id,
        seed=args.seed,
        clip_rewards=True,
        render_mode=args.render_mode,
        monitor=False,
    )

    try:
        all_returns: list[float] = []
        all_frames: list[np.ndarray] = []
        for ep in range(args.episodes):
            ep_seed = args.seed + ep
            env.reset(seed=ep_seed)
            ep_return, ep_frames = run_episode(
                model,
                env,
                deterministic=True,
                max_steps=args.max_steps,
            )
            all_returns.append(ep_return)
            all_frames.extend(ep_frames)
            print(f"Episode {ep + 1}/{args.episodes} return={ep_return:.3f}")

        print(f"Mean return: {float(np.mean(all_returns)):.3f}")

        if args.render_mode == "rgb_array":
            try:
                import imageio.v3 as iio
            except ModuleNotFoundError as exc:
                raise SystemExit(
                    "Missing dependency 'imageio'. Install with: python3 -m pip install imageio imageio-ffmpeg"
                ) from exc
            output_path = Path(args.video_output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            if not all_frames:
                raise RuntimeError("No frames were captured for video output.")
            iio.imwrite(output_path, all_frames, fps=args.fps)
            print(f"Saved video: {output_path}")
    finally:
        env.close()


if __name__ == "__main__":
    main()
