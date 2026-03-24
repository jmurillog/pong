from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


REQUIRED_COLUMNS = ("player_id", "episode", "episode_return")


@dataclass(frozen=True)
class HumanBaselineStats:
    n_players: int
    n_episodes_total: int
    mean_return: float
    std_return: float


def create_template_dataframe(*, n_players: int = 6, episodes_per_player: int = 15) -> pd.DataFrame:
    rows = []
    for player_idx in range(1, n_players + 1):
        player_id = f"player_{player_idx}"
        for episode in range(1, episodes_per_player + 1):
            rows.append(
                {
                    "player_id": player_id,
                    "episode": episode,
                    "episode_return": "",
                }
            )
    return pd.DataFrame(rows, columns=list(REQUIRED_COLUMNS))


def validate_human_baseline_df(
    df: pd.DataFrame,
    *,
    expected_players: int = 6,
    episodes_per_player: int = 15,
) -> list[str]:
    issues: list[str] = []

    missing = set(REQUIRED_COLUMNS) - set(df.columns)
    if missing:
        issues.append(f"Missing required columns: {sorted(missing)}.")
        return issues

    parsed = df.copy()
    parsed["episode"] = pd.to_numeric(parsed["episode"], errors="coerce")
    parsed["episode_return"] = pd.to_numeric(parsed["episode_return"], errors="coerce")

    if parsed["episode"].isna().any():
        issues.append("Column 'episode' contains non-numeric values.")
    if parsed["episode_return"].isna().any():
        issues.append("Column 'episode_return' contains missing or non-numeric values.")

    if (parsed["episode"] < 1).any():
        issues.append("Episode indices must be >= 1.")

    duplicated = parsed.duplicated(subset=["player_id", "episode"])
    if duplicated.any():
        issues.append("Duplicate (player_id, episode) rows found.")

    n_players = parsed["player_id"].nunique()
    if n_players != expected_players:
        issues.append(f"Expected {expected_players} players but found {n_players}.")

    counts = parsed.groupby("player_id")["episode"].count()
    wrong_counts = counts[counts != episodes_per_player]
    if not wrong_counts.empty:
        offenders = ", ".join(f"{idx}:{int(value)}" for idx, value in wrong_counts.items())
        issues.append(
            f"Each player must have {episodes_per_player} episodes; mismatches: {offenders}."
        )

    return issues


def summarize_human_baseline(df: pd.DataFrame) -> HumanBaselineStats:
    returns = pd.to_numeric(df["episode_return"], errors="coerce").dropna().to_numpy(dtype=float)
    if returns.size == 0:
        raise ValueError("No numeric episode_return values available.")

    return HumanBaselineStats(
        n_players=int(df["player_id"].nunique()),
        n_episodes_total=int(returns.size),
        mean_return=float(np.mean(returns)),
        std_return=float(np.std(returns, ddof=1)) if returns.size > 1 else 0.0,
    )


def write_template_csv(path: Path, *, n_players: int = 6, episodes_per_player: int = 15) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    template = create_template_dataframe(
        n_players=n_players,
        episodes_per_player=episodes_per_player,
    )
    template.to_csv(path, index=False)

