from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.utils import set_random_seed

from .callbacks import FixedSeedEvalCallback
from .config import ExperimentConfig
from .envs import build_single_env, build_vec_env, infer_policy_type
from .repro import write_runtime_metadata


@dataclass(frozen=True)
class RunResult:
    run_dir: Path
    final_model_path: Path
    duration_seconds: float
    skipped: bool = False


def train_single_run(config: ExperimentConfig, *, skip_if_complete: bool = False) -> RunResult:
    run_dir = config.run_dir()
    run_dir.mkdir(parents=True, exist_ok=True)
    final_model_path = run_dir / "final_model.zip"

    if skip_if_complete and final_model_path.exists():
        return RunResult(
            run_dir=run_dir,
            final_model_path=final_model_path,
            duration_seconds=0.0,
            skipped=True,
        )

    config_path = run_dir / "run_config.json"
    metadata_path = run_dir / "runtime_metadata.json"
    with config_path.open("w", encoding="utf-8") as handle:
        json.dump(config.to_dict(), handle, indent=2)
    write_runtime_metadata(metadata_path, cwd=Path.cwd())

    set_random_seed(config.seed)
    train_env = build_vec_env(
        config.env_id,
        config.seed,
        n_envs=config.n_envs,
        clip_rewards=config.clip_rewards,
    )
    eval_env = build_single_env(config.env_id, clip_rewards=config.clip_rewards)

    policy = infer_policy_type(config.env_id)
    ppo = config.ppo

    model = PPO(
        policy=policy,
        env=train_env,
        seed=config.seed,
        verbose=1,
        device=config.device,
        tensorboard_log=str(run_dir / "tb"),
        n_steps=ppo.n_steps,
        n_epochs=ppo.n_epochs,
        batch_size=ppo.batch_size,
        learning_rate=ppo.learning_rate,
        gamma=ppo.gamma,
        gae_lambda=ppo.gae_lambda,
        clip_range=ppo.clip_range,
        ent_coef=ppo.ent_coef,
        vf_coef=ppo.vf_coef,
        max_grad_norm=ppo.max_grad_norm,
    )

    eval_callback = FixedSeedEvalCallback(
        eval_env=eval_env,
        eval_freq=config.eval_freq,
        n_eval_episodes=config.n_eval_episodes,
        eval_seeds=config.eval_seeds,
        run_id=config.run_id(),
        training_seed=config.seed,
        budget_steps=config.total_timesteps,
        output_dir=run_dir,
        save_model_checkpoints=config.save_checkpoints,
        verbose=1,
    )

    start = time.time()
    try:
        model.learn(
            total_timesteps=config.total_timesteps,
            callback=eval_callback,
            progress_bar=True,
        )
        model.save(str(final_model_path))
    finally:
        train_env.close()
        eval_env.close()
    end = time.time()

    return RunResult(
        run_dir=run_dir,
        final_model_path=final_model_path,
        duration_seconds=end - start,
        skipped=False,
    )

