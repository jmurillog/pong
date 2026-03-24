#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pong_ppo.config import DEFAULT_EVAL_SEEDS, ExperimentConfig, PPOHyperParams
from pong_ppo.train import train_single_run


def parse_int_csv(raw: str) -> tuple[int, ...]:
    values = [token.strip() for token in raw.split(",") if token.strip()]
    return tuple(int(value) for value in values)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train one PPO run for Pong.")
    parser.add_argument("--env-id", default="ALE/Pong-v5")
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--seed", type=int, default=11)
    parser.add_argument("--n-envs", type=int, default=8)
    parser.add_argument("--eval-freq", type=int, default=100_000)
    parser.add_argument("--n-eval-episodes", type=int, default=20)
    parser.add_argument(
        "--eval-seeds",
        default=",".join(str(seed) for seed in DEFAULT_EVAL_SEEDS),
        help="Comma-separated fixed evaluation seeds.",
    )
    parser.add_argument("--output-root", default="outputs")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--skip-if-complete", action="store_true")
    parser.add_argument("--no-checkpoints", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    eval_seeds = parse_int_csv(args.eval_seeds)

    config = ExperimentConfig(
        env_id=args.env_id,
        total_timesteps=args.timesteps,
        seed=args.seed,
        eval_freq=args.eval_freq,
        n_eval_episodes=args.n_eval_episodes,
        eval_seeds=eval_seeds,
        n_envs=args.n_envs,
        output_root=Path(args.output_root),
        device=args.device,
        save_checkpoints=not args.no_checkpoints,
        ppo=PPOHyperParams(),
    )

    result = train_single_run(config, skip_if_complete=args.skip_if_complete)
    if result.skipped:
        print(f"Skipped existing run: {result.run_dir}")
    else:
        print(
            f"Completed run in {result.duration_seconds:.2f}s. "
            f"Final model: {result.final_model_path}"
        )


if __name__ == "__main__":
    main()

