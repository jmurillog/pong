#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pong_ppo.human_baseline import (
    create_template_dataframe,
    summarize_human_baseline,
    validate_human_baseline_df,
    write_template_csv,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Human baseline data helper.")
    sub = parser.add_subparsers(dest="command", required=True)

    make_template = sub.add_parser("make-template", help="Create empty CSV template.")
    make_template.add_argument("--output", default="data/human_baseline/human_returns_template.csv")
    make_template.add_argument("--players", type=int, default=6)
    make_template.add_argument("--episodes", type=int, default=15)

    validate = sub.add_parser("validate", help="Validate a filled human baseline CSV.")
    validate.add_argument("--input", required=True)
    validate.add_argument("--players", type=int, default=6)
    validate.add_argument("--episodes", type=int, default=15)

    interactive = sub.add_parser(
        "interactive",
        help="Prompt for returns episode-by-episode and save a completed CSV.",
    )
    interactive.add_argument("--output", default="data/human_baseline/human_returns.csv")
    interactive.add_argument("--players", type=int, default=6)
    interactive.add_argument("--episodes", type=int, default=15)
    interactive.add_argument(
        "--player-names",
        default="",
        help="Comma-separated names. If omitted: player_1..player_N",
    )
    return parser


def cmd_make_template(output: Path, players: int, episodes: int) -> None:
    write_template_csv(output, n_players=players, episodes_per_player=episodes)
    print(f"Wrote template: {output}")


def cmd_validate(input_path: Path, players: int, episodes: int) -> int:
    df = pd.read_csv(input_path)
    issues = validate_human_baseline_df(
        df,
        expected_players=players,
        episodes_per_player=episodes,
    )
    if issues:
        print("Validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1

    stats = summarize_human_baseline(df)
    print("Validation successful.")
    print(
        f"Players={stats.n_players} Episodes={stats.n_episodes_total} "
        f"Mean={stats.mean_return:.3f} SD={stats.std_return:.3f}"
    )
    return 0


def _parse_player_names(raw: str, players: int) -> list[str]:
    names = [token.strip() for token in raw.split(",") if token.strip()]
    if not names:
        return [f"player_{i}" for i in range(1, players + 1)]
    if len(names) != players:
        raise ValueError(f"Expected {players} names, got {len(names)}.")
    return names


def cmd_interactive(output: Path, players: int, episodes: int, player_names_raw: str) -> int:
    player_names = _parse_player_names(player_names_raw, players)
    rows: list[dict] = []
    print("Entering interactive human baseline collection.")
    print(
        "Protocol reminder: same keyboard settings + rendering for all players, "
        f"{episodes} episodes each."
    )

    for player in player_names:
        print(f"\nPlayer: {player}")
        for episode in range(1, episodes + 1):
            while True:
                raw = input(f"Episode {episode} return: ").strip()
                try:
                    value = float(raw)
                    break
                except ValueError:
                    print("Please enter a numeric return (e.g., -21, 3, 17).")
            rows.append(
                {
                    "player_id": player,
                    "episode": episode,
                    "episode_return": value,
                }
            )

    df = pd.DataFrame(rows, columns=["player_id", "episode", "episode_return"])
    issues = validate_human_baseline_df(
        df,
        expected_players=players,
        episodes_per_player=episodes,
    )
    if issues:
        print("Internal validation failed after collection:")
        for issue in issues:
            print(f"- {issue}")
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output, index=False)
    stats = summarize_human_baseline(df)
    print(f"Saved: {output}")
    print(
        f"Players={stats.n_players} Episodes={stats.n_episodes_total} "
        f"Mean={stats.mean_return:.3f} SD={stats.std_return:.3f}"
    )
    return 0


def main() -> None:
    args = build_parser().parse_args()

    if args.command == "make-template":
        cmd_make_template(Path(args.output), args.players, args.episodes)
        return

    if args.command == "validate":
        raise SystemExit(cmd_validate(Path(args.input), args.players, args.episodes))

    if args.command == "interactive":
        raise SystemExit(
            cmd_interactive(
                Path(args.output),
                args.players,
                args.episodes,
                args.player_names,
            )
        )

    raise RuntimeError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()

