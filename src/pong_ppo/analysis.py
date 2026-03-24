from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("XDG_CACHE_HOME", str((Path.cwd() / ".cache").resolve()))
os.environ.setdefault("MPLCONFIGDIR", str((Path.cwd() / ".mplconfig").resolve()))

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def standard_error(values: np.ndarray) -> float:
    values = np.asarray(values, dtype=float)
    if values.size <= 1:
        return 0.0
    return float(np.std(values, ddof=1) / np.sqrt(values.size))


def bootstrap_mean_ci(
    values: np.ndarray | list[float],
    *,
    confidence: float = 0.95,
    n_bootstrap: int = 10_000,
    rng_seed: int = 12345,
) -> tuple[float, float]:
    data = np.asarray(values, dtype=float)
    if data.size == 0:
        raise ValueError("Cannot bootstrap an empty array.")
    rng = np.random.default_rng(rng_seed)
    sample_means = rng.choice(data, size=(n_bootstrap, data.size), replace=True).mean(axis=1)
    alpha = (1.0 - confidence) / 2.0
    lower = float(np.quantile(sample_means, alpha))
    upper = float(np.quantile(sample_means, 1.0 - alpha))
    return lower, upper


def bootstrap_mean_difference_ci(
    values_a: np.ndarray | list[float],
    values_b: np.ndarray | list[float],
    *,
    confidence: float = 0.95,
    n_bootstrap: int = 10_000,
    rng_seed: int = 12345,
) -> tuple[float, float]:
    a = np.asarray(values_a, dtype=float)
    b = np.asarray(values_b, dtype=float)
    if a.size == 0 or b.size == 0:
        raise ValueError("Cannot bootstrap difference with empty input arrays.")
    rng = np.random.default_rng(rng_seed)
    sample_a = rng.choice(a, size=(n_bootstrap, a.size), replace=True).mean(axis=1)
    sample_b = rng.choice(b, size=(n_bootstrap, b.size), replace=True).mean(axis=1)
    diff = sample_a - sample_b
    alpha = (1.0 - confidence) / 2.0
    lower = float(np.quantile(diff, alpha))
    upper = float(np.quantile(diff, 1.0 - alpha))
    return lower, upper


def load_eval_checkpoints(output_root: Path, experiment_name: str) -> pd.DataFrame:
    csv_paths = sorted(
        (output_root / experiment_name).glob("*/seed_*/eval_checkpoints.csv")
    )
    if not csv_paths:
        return pd.DataFrame()
    frames = [pd.read_csv(path) for path in csv_paths]
    return pd.concat(frames, ignore_index=True)


def load_eval_episode_returns(output_root: Path, experiment_name: str) -> pd.DataFrame:
    csv_paths = sorted(
        (output_root / experiment_name).glob("*/seed_*/eval_episode_returns.csv")
    )
    if not csv_paths:
        return pd.DataFrame()
    frames = [pd.read_csv(path) for path in csv_paths]
    return pd.concat(frames, ignore_index=True)


def learning_curve_summary(eval_checkpoints: pd.DataFrame) -> pd.DataFrame:
    if eval_checkpoints.empty:
        return pd.DataFrame()

    grouped = eval_checkpoints.groupby(["budget_steps", "timestep"], as_index=False)
    summary = grouped.agg(
        n_seeds=("seed", "nunique"),
        mean_return=("mean_return", "mean"),
        mean_win_rate=("win_rate", "mean"),
        std_across_seeds=("mean_return", "std"),
    )
    summary["se_return"] = summary.apply(
        lambda row: 0.0
        if row["n_seeds"] <= 1
        else float(row["std_across_seeds"] / np.sqrt(row["n_seeds"])),
        axis=1,
    )
    summary = summary.sort_values(["budget_steps", "timestep"]).reset_index(drop=True)
    return summary


def final_seed_level_scores(eval_checkpoints: pd.DataFrame, budget_steps: int) -> pd.DataFrame:
    subset = eval_checkpoints[eval_checkpoints["budget_steps"] == budget_steps].copy()
    if subset.empty:
        return pd.DataFrame()
    subset = subset.sort_values(["seed", "timestep"])
    idx = subset.groupby("seed")["timestep"].idxmax()
    return subset.loc[idx].sort_values("seed").reset_index(drop=True)


def summarize_agent_final_performance(
    eval_checkpoints: pd.DataFrame,
    budget_steps: int,
) -> dict:
    seed_level = final_seed_level_scores(eval_checkpoints, budget_steps)
    if seed_level.empty:
        raise ValueError(f"No evaluation rows found for budget {budget_steps}.")

    seed_returns = seed_level["mean_return"].to_numpy(dtype=float)
    agent_mean = float(np.mean(seed_returns))
    agent_se = standard_error(seed_returns)
    ci_low, ci_high = bootstrap_mean_ci(seed_returns)

    return {
        "budget_steps": budget_steps,
        "n_seeds": int(seed_returns.size),
        "seed_returns": seed_returns.tolist(),
        "agent_mean_return": agent_mean,
        "agent_se_return": agent_se,
        "agent_mean_ci95_low": ci_low,
        "agent_mean_ci95_high": ci_high,
    }


def load_human_returns(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Human baseline file not found: {path}")
    df = pd.read_csv(path)
    required_cols = {"player_id", "episode", "episode_return"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in human baseline file: {sorted(missing)}")
    return df


def summarize_human_baseline(human_df: pd.DataFrame) -> dict:
    returns = human_df["episode_return"].to_numpy(dtype=float)
    mean = float(np.mean(returns))
    std = float(np.std(returns, ddof=1)) if returns.size > 1 else 0.0
    ci_low, ci_high = bootstrap_mean_ci(returns)
    return {
        "n_players": int(human_df["player_id"].nunique()),
        "episodes_per_player_min": int(human_df.groupby("player_id")["episode"].count().min()),
        "episodes_per_player_max": int(human_df.groupby("player_id")["episode"].count().max()),
        "n_episodes_total": int(returns.size),
        "human_mean_return": mean,
        "human_std_return": std,
        "human_mean_ci95_low": ci_low,
        "human_mean_ci95_high": ci_high,
    }


def compare_agent_vs_human(agent_seed_returns: list[float], human_episode_returns: list[float]) -> dict:
    agent = np.asarray(agent_seed_returns, dtype=float)
    human = np.asarray(human_episode_returns, dtype=float)
    diff_mean = float(np.mean(agent) - np.mean(human))
    diff_low, diff_high = bootstrap_mean_difference_ci(agent, human)
    return {
        "agent_minus_human_mean": diff_mean,
        "agent_minus_human_ci95_low": diff_low,
        "agent_minus_human_ci95_high": diff_high,
    }


def plot_learning_curves(summary_df: pd.DataFrame, output_path: Path) -> None:
    if summary_df.empty:
        raise ValueError("No summary rows available to plot.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(10, 6))

    for budget, frame in summary_df.groupby("budget_steps"):
        frame = frame.sort_values("timestep")
        x = frame["timestep"].to_numpy()
        y = frame["mean_return"].to_numpy()
        se = frame["se_return"].to_numpy()
        label = f"{budget // 1_000_000}M steps budget"
        plt.plot(x, y, label=label)
        plt.fill_between(x, y - se, y + se, alpha=0.2)

    plt.axhline(0.0, color="black", linewidth=1.0, linestyle="--", label="Return = 0")
    plt.xlabel("Training Timesteps")
    plt.ylabel("Mean Episodic Return (Across Seeds)")
    plt.title("PPO on Pong: Learning Curves (mean ± SE)")
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=180)
    plt.close()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
