from __future__ import annotations

from collections.abc import Callable
from typing import Any

import gymnasium as gym
import numpy as np
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor, VecTransposeImage

try:
    import ale_py

    gym.register_envs(ale_py)
except Exception:
    # Non-Atari usage should continue to work even if ALE is unavailable.
    ale_py = None


def is_atari_env_id(env_id: str) -> bool:
    return env_id.startswith("ALE/") or "NoFrameskip" in env_id


def _frame_stack(env: gym.Env, num_stack: int = 4) -> gym.Env:
    """Compatible frame-stack wrapper across Gymnasium versions."""
    if hasattr(gym.wrappers, "FrameStackObservation"):
        return gym.wrappers.FrameStackObservation(env, stack_size=num_stack)
    return gym.wrappers.FrameStack(env, num_stack=num_stack)


def build_single_env(
    env_id: str,
    seed: int | None = None,
    *,
    clip_rewards: bool = True,
    render_mode: str | None = None,
    monitor: bool = True,
) -> gym.Env:
    """Build one env instance with canonical Atari preprocessing for Pong."""
    make_kwargs: dict[str, Any] = {}
    if is_atari_env_id(env_id):
        # Required so AtariPreprocessing controls the only frame-skip path.
        make_kwargs["frameskip"] = 1

    env = gym.make(env_id, render_mode=render_mode, **make_kwargs)

    if is_atari_env_id(env_id):
        env = gym.wrappers.AtariPreprocessing(
            env,
            screen_size=84,
            frame_skip=4,
            grayscale_obs=True,
            grayscale_newaxis=False,
            scale_obs=False,
        )
        env = _frame_stack(env, num_stack=4)

    if clip_rewards:
        env = gym.wrappers.TransformReward(env, lambda reward: float(np.clip(reward, -1.0, 1.0)))

    if monitor:
        env = Monitor(env)
    if seed is not None:
        env.reset(seed=seed)
    return env


def make_env_fn(
    env_id: str,
    seed: int,
    rank: int,
    *,
    clip_rewards: bool,
) -> Callable[[], gym.Env]:
    def _init() -> gym.Env:
        run_seed = seed + rank
        return build_single_env(
            env_id=env_id,
            seed=run_seed,
            clip_rewards=clip_rewards,
            monitor=False,
        )

    return _init


def build_vec_env(
    env_id: str,
    seed: int,
    *,
    n_envs: int = 8,
    clip_rewards: bool = True,
) -> VecMonitor:
    env_fns = [make_env_fn(env_id, seed, rank=i, clip_rewards=clip_rewards) for i in range(n_envs)]
    vec_env = DummyVecEnv(env_fns)
    vec_env = VecMonitor(vec_env)

    obs_shape = getattr(vec_env.observation_space, "shape", ())
    if len(obs_shape) == 3 and obs_shape[-1] in (1, 3, 4):
        vec_env = VecTransposeImage(vec_env)

    return vec_env


def infer_policy_type(env_id: str) -> str:
    """Use CNN for Atari-like visual tasks, MLP otherwise."""
    return "CnnPolicy" if is_atari_env_id(env_id) else "MlpPolicy"
