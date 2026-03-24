from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_TRAINING_SEEDS = (11, 22, 33, 44, 55)
DEFAULT_EVAL_SEEDS = tuple(range(1000, 1020))  # fixed evaluation seeds


@dataclass(frozen=True)
class PPOHyperParams:
    """PPO hyperparameters aligned with the proposal defaults for Atari."""

    n_steps: int = 128
    n_epochs: int = 4
    batch_size: int = 256
    clip_range: float = 0.1
    learning_rate: float = 2.5e-4
    gamma: float = 0.99
    gae_lambda: float = 0.95
    ent_coef: float = 0.01
    vf_coef: float = 0.5
    max_grad_norm: float = 0.5


@dataclass(frozen=True)
class ExperimentConfig:
    """Full configuration for one training run."""

    env_id: str = "ALE/Pong-v5"
    total_timesteps: int = 1_000_000
    seed: int = 11
    eval_freq: int = 100_000
    n_eval_episodes: int = 20
    eval_seeds: tuple[int, ...] = DEFAULT_EVAL_SEEDS
    n_envs: int = 8
    clip_rewards: bool = True
    device: str = "auto"
    ppo: PPOHyperParams = field(default_factory=PPOHyperParams)

    # Output layout
    output_root: Path = Path("outputs")
    experiment_name: str = "ppo_pong"
    save_checkpoints: bool = True
    checkpoint_interval: int = 100_000

    def run_id(self) -> str:
        return f"{self.experiment_name}_steps{self.total_timesteps}_seed{self.seed}"

    def budget_label(self) -> str:
        if self.total_timesteps >= 1_000_000 and self.total_timesteps % 1_000_000 == 0:
            return f"{self.total_timesteps // 1_000_000}M_steps"
        if self.total_timesteps >= 1_000 and self.total_timesteps % 1_000 == 0:
            return f"{self.total_timesteps // 1_000}K_steps"
        return f"{self.total_timesteps}_steps"

    def run_dir(self) -> Path:
        return (
            self.output_root
            / self.experiment_name
            / self.budget_label()
            / f"seed_{self.seed}"
        )

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["output_root"] = str(self.output_root)
        return payload
