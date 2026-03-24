from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from stable_baselines3.common.callbacks import BaseCallback


@dataclass(frozen=True)
class EvalResult:
    timestep: int
    returns: list[float]
    eval_seeds: list[int]

    @property
    def mean_return(self) -> float:
        return float(np.mean(self.returns))

    @property
    def std_return(self) -> float:
        return float(np.std(self.returns, ddof=1)) if len(self.returns) > 1 else 0.0

    @property
    def win_rate(self) -> float:
        wins = [value > 0.0 for value in self.returns]
        return float(np.mean(wins))


class FixedSeedEvalCallback(BaseCallback):
    """
    Evaluate deterministic policy every N timesteps using a fixed list of seeds.
    Stores both checkpoint aggregates and per-episode returns.
    """

    def __init__(
        self,
        *,
        eval_env,
        eval_freq: int,
        n_eval_episodes: int,
        eval_seeds: list[int] | tuple[int, ...],
        run_id: str,
        training_seed: int,
        budget_steps: int,
        output_dir: Path,
        save_model_checkpoints: bool = True,
        verbose: int = 0,
    ) -> None:
        super().__init__(verbose=verbose)
        self.eval_env = eval_env
        self.eval_freq = eval_freq
        self.n_eval_episodes = n_eval_episodes
        self.eval_seeds = list(eval_seeds)
        self.run_id = run_id
        self.training_seed = training_seed
        self.budget_steps = budget_steps
        self.output_dir = output_dir
        self.save_model_checkpoints = save_model_checkpoints

        self.next_eval_step = eval_freq
        self.last_eval_step = -1

        self.checkpoint_csv = self.output_dir / "eval_checkpoints.csv"
        self.episode_csv = self.output_dir / "eval_episode_returns.csv"
        self.model_dir = self.output_dir / "models"
        self.model_dir.mkdir(parents=True, exist_ok=True)

        if self.n_eval_episodes > len(self.eval_seeds):
            raise ValueError(
                f"Requested n_eval_episodes={self.n_eval_episodes}, "
                f"but only {len(self.eval_seeds)} fixed eval seeds were provided."
            )

    def _on_step(self) -> bool:
        while self.num_timesteps >= self.next_eval_step:
            self._evaluate_and_log(self.next_eval_step)
            self.next_eval_step += self.eval_freq
        return True

    def _on_training_end(self) -> None:
        # Keep evaluation checkpoints aligned to the configured budget (e.g., 1M/5M),
        # avoiding duplicate terminal evaluations caused by vectorized step overshoot.
        if self.last_eval_step < self.budget_steps:
            self._evaluate_and_log(self.budget_steps)

    def _evaluate_and_log(self, timestep: int) -> None:
        result = self._run_fixed_seed_evaluation(timestep=timestep)
        self._append_checkpoint_row(result)
        self._append_episode_rows(result)

        if self.save_model_checkpoints:
            checkpoint_path = self.model_dir / f"checkpoint_{timestep:09d}.zip"
            self.model.save(str(checkpoint_path))

        self.last_eval_step = timestep

    def _run_fixed_seed_evaluation(self, *, timestep: int) -> EvalResult:
        returns: list[float] = []
        used_eval_seeds = self.eval_seeds[: self.n_eval_episodes]

        for eval_seed in used_eval_seeds:
            observation, _ = self.eval_env.reset(seed=eval_seed)
            done = False
            truncated = False
            total_reward = 0.0

            while not (done or truncated):
                action, _ = self.model.predict(observation, deterministic=True)
                observation, reward, done, truncated, _ = self.eval_env.step(action)
                total_reward += float(reward)

            returns.append(total_reward)

        return EvalResult(timestep=timestep, returns=returns, eval_seeds=used_eval_seeds)

    def _append_checkpoint_row(self, result: EvalResult) -> None:
        row = {
            "timestamp_utc": datetime.now(tz=timezone.utc).isoformat(),
            "run_id": self.run_id,
            "budget_steps": self.budget_steps,
            "seed": self.training_seed,
            "timestep": result.timestep,
            "n_eval_episodes": len(result.returns),
            "mean_return": result.mean_return,
            "std_return": result.std_return,
            "win_rate": result.win_rate,
        }
        self._append_csv_row(self.checkpoint_csv, row)

    def _append_episode_rows(self, result: EvalResult) -> None:
        for eval_seed, episode_return in zip(result.eval_seeds, result.returns):
            row = {
                "timestamp_utc": datetime.now(tz=timezone.utc).isoformat(),
                "run_id": self.run_id,
                "budget_steps": self.budget_steps,
                "seed": self.training_seed,
                "timestep": result.timestep,
                "eval_seed": eval_seed,
                "episode_return": episode_return,
                "is_win": int(episode_return > 0.0),
            }
            self._append_csv_row(self.episode_csv, row)

    @staticmethod
    def _append_csv_row(path: Path, row: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        write_header = not path.exists() or path.stat().st_size == 0
        with path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(row.keys()))
            if write_header:
                writer.writeheader()
            writer.writerow(row)
