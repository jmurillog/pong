#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pong_ppo.config import DEFAULT_EVAL_SEEDS, DEFAULT_TRAINING_SEEDS, ExperimentConfig, PPOHyperParams
from pong_ppo.train import train_single_run


def parse_int_csv(raw: str) -> tuple[int, ...]:
    return tuple(int(token.strip()) for token in raw.split(",") if token.strip())


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run full proposal matrix: 1M and 5M budgets, each across 5 seeds."
    )
    parser.add_argument("--env-id", default="ALE/Pong-v5")
    parser.add_argument("--budgets", default="1000000,5000000")
    parser.add_argument(
        "--seeds",
        default=",".join(str(seed) for seed in DEFAULT_TRAINING_SEEDS),
    )
    parser.add_argument(
        "--eval-seeds",
        default=",".join(str(seed) for seed in DEFAULT_EVAL_SEEDS),
    )
    parser.add_argument("--eval-freq", type=int, default=100_000)
    parser.add_argument("--n-eval-episodes", type=int, default=20)
    parser.add_argument("--n-envs", type=int, default=8)
    parser.add_argument("--output-root", default="outputs")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--skip-if-complete", action="store_true")
    parser.add_argument("--no-checkpoints", action="store_true")
    parser.add_argument("--fail-fast", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    budgets = parse_int_csv(args.budgets)
    seeds = parse_int_csv(args.seeds)
    eval_seeds = parse_int_csv(args.eval_seeds)

    total_runs = len(budgets) * len(seeds)
    print(f"Starting experiment matrix with {total_runs} runs.")
    print(f"Budgets: {budgets}")
    print(f"Training seeds: {seeds}")
    print(f"Eval seeds ({len(eval_seeds)}): {eval_seeds}")

    completed = 0
    skipped = 0
    failed = 0

    for budget in budgets:
        for seed in seeds:
            config = ExperimentConfig(
                env_id=args.env_id,
                total_timesteps=budget,
                seed=seed,
                eval_freq=args.eval_freq,
                n_eval_episodes=args.n_eval_episodes,
                eval_seeds=eval_seeds,
                n_envs=args.n_envs,
                output_root=Path(args.output_root),
                device=args.device,
                save_checkpoints=not args.no_checkpoints,
                ppo=PPOHyperParams(),
            )
            print("=" * 80)
            print(
                f"Run: budget={budget} seed={seed} run_id={config.run_id()} "
                f"output={config.run_dir()}"
            )

            try:
                result = train_single_run(config, skip_if_complete=args.skip_if_complete)
                if result.skipped:
                    skipped += 1
                    print(f"Skipped (already complete): {result.run_dir}")
                else:
                    completed += 1
                    print(
                        f"Completed in {result.duration_seconds:.2f}s | "
                        f"model={result.final_model_path}"
                    )
            except Exception as exc:
                failed += 1
                print(f"FAILED budget={budget} seed={seed}: {exc}")
                if args.fail_fast:
                    raise

    print("=" * 80)
    print(f"Done. completed={completed}, skipped={skipped}, failed={failed}.")


if __name__ == "__main__":
    main()

