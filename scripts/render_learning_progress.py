#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Record gameplay videos from multiple checkpoints to visualize learning progress."
    )
    parser.add_argument(
        "--models-dir",
        required=True,
        help="Directory containing checkpoint_XXXXXXXXX.zip files.",
    )
    parser.add_argument("--env-id", default="ALE/Pong-v5")
    parser.add_argument("--episodes", type=int, default=1)
    parser.add_argument("--seed", type=int, default=123)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--max-steps", type=int, default=20_000)
    parser.add_argument(
        "--keep",
        type=int,
        default=5,
        help="How many checkpoints to render (uniformly sampled from available files).",
    )
    parser.add_argument(
        "--output-dir",
        default="outputs/progress_videos",
        help="Where per-checkpoint videos are saved.",
    )
    return parser


def _checkpoint_step(path: Path) -> int:
    match = re.search(r"checkpoint_(\d+)\.zip$", path.name)
    if not match:
        return -1
    return int(match.group(1))


def _select_uniform(paths: list[Path], keep: int) -> list[Path]:
    if keep <= 0 or keep >= len(paths):
        return paths
    if keep == 1:
        return [paths[-1]]

    selected: list[Path] = []
    last = len(paths) - 1
    for i in range(keep):
        idx = round(i * last / (keep - 1))
        selected.append(paths[idx])
    deduped = []
    seen = set()
    for path in selected:
        if path not in seen:
            deduped.append(path)
            seen.add(path)
    return deduped


def main() -> None:
    args = build_parser().parse_args()
    models_dir = Path(args.models_dir)
    all_checkpoints = sorted(models_dir.glob("checkpoint_*.zip"), key=_checkpoint_step)
    if not all_checkpoints:
        raise SystemExit(f"No checkpoints found in: {models_dir}")

    selected = _select_uniform(all_checkpoints, args.keep)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Found {len(all_checkpoints)} checkpoints. Rendering {len(selected)}.")

    for checkpoint in selected:
        step = _checkpoint_step(checkpoint)
        video_path = output_dir / f"checkpoint_{step:09d}.mp4"
        cmd = [
            sys.executable,
            str(ROOT / "scripts" / "watch_agent.py"),
            "--model",
            str(checkpoint),
            "--env-id",
            args.env_id,
            "--episodes",
            str(args.episodes),
            "--seed",
            str(args.seed),
            "--render-mode",
            "rgb_array",
            "--video-output",
            str(video_path),
            "--fps",
            str(args.fps),
            "--max-steps",
            str(args.max_steps),
        ]
        print(f"Rendering checkpoint {step} -> {video_path}")
        subprocess.run(cmd, check=True)

    print(f"Done. Videos saved in: {output_dir}")


if __name__ == "__main__":
    main()

