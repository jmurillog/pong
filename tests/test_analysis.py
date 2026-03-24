from __future__ import annotations

import numpy as np
import pandas as pd

from pong_ppo.analysis import (
    bootstrap_mean_ci,
    bootstrap_mean_difference_ci,
    final_seed_level_scores,
    standard_error,
)


def test_standard_error_matches_hand_calculation() -> None:
    values = np.array([1.0, 2.0, 3.0, 4.0])
    expected = np.std(values, ddof=1) / np.sqrt(values.size)
    assert np.isclose(standard_error(values), expected)


def test_bootstrap_mean_ci_contains_empirical_mean() -> None:
    values = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    lower, upper = bootstrap_mean_ci(values, n_bootstrap=2000, rng_seed=7)
    assert lower <= np.mean(values) <= upper


def test_bootstrap_difference_ci_sign_is_positive_when_first_is_larger() -> None:
    a = np.array([5.0, 6.0, 7.0, 8.0])
    b = np.array([0.0, 1.0, 1.0, 2.0])
    lower, upper = bootstrap_mean_difference_ci(a, b, n_bootstrap=2000, rng_seed=7)
    assert lower > 0
    assert upper > 0


def test_final_seed_level_scores_keeps_latest_timestep_per_seed() -> None:
    df = pd.DataFrame(
        [
            {"budget_steps": 1_000_000, "seed": 11, "timestep": 100_000, "mean_return": 1.0},
            {"budget_steps": 1_000_000, "seed": 11, "timestep": 200_000, "mean_return": 2.0},
            {"budget_steps": 1_000_000, "seed": 22, "timestep": 100_000, "mean_return": 0.5},
            {"budget_steps": 1_000_000, "seed": 22, "timestep": 300_000, "mean_return": 1.5},
        ]
    )
    final = final_seed_level_scores(df, budget_steps=1_000_000)
    assert len(final) == 2
    assert set(final["timestep"].tolist()) == {200_000, 300_000}

