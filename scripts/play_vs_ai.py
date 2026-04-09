#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pygame
from stable_baselines3 import PPO

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pong_ppo.envs import build_single_env


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Play one Pong episode as human, then compare your score vs the trained AI."
    )
    parser.add_argument("--model", required=True, help="Path to trained SB3 PPO .zip model")
    parser.add_argument("--env-id", default="ALE/Pong-v5")
    parser.add_argument("--seed", type=int, default=123)
    parser.add_argument("--fps", type=int, default=60)
    parser.add_argument("--zoom", type=float, default=3.0)
    parser.add_argument("--max-steps", type=int, default=20_000)
    parser.add_argument(
        "--watch-ai",
        action="store_true",
        help="Render a window while the AI plays after your episode.",
    )
    parser.add_argument("--device", default="auto")
    return parser


def _action_from_keys(keys) -> int:
    up = keys[pygame.K_UP] or keys[pygame.K_w]
    down = keys[pygame.K_DOWN] or keys[pygame.K_s]
    fire = keys[pygame.K_SPACE]

    if up and fire:
        return 4  # RIGHTFIRE
    if down and fire:
        return 5  # LEFTFIRE
    if up:
        return 2  # RIGHT
    if down:
        return 3  # LEFT
    if fire:
        return 1  # FIRE
    return 0  # NOOP


def _prepare_screen(frame: np.ndarray, zoom: float, title: str):
    frame_h, frame_w = int(frame.shape[0]), int(frame.shape[1])
    window_w = int(frame_w * zoom)
    window_h = int(frame_h * zoom)
    screen = pygame.display.set_mode((window_w, window_h))
    pygame.display.set_caption(title)
    return screen, (window_w, window_h)


def _draw_frame(screen, frame: np.ndarray, window_size: tuple[int, int]) -> None:
    surface = pygame.surfarray.make_surface(np.transpose(frame, (1, 0, 2)))
    if surface.get_size() != window_size:
        surface = pygame.transform.scale(surface, window_size)
    screen.blit(surface, (0, 0))
    pygame.display.flip()


def play_human_episode(
    env,
    *,
    seed: int,
    fps: int,
    zoom: float,
    max_steps: int,
) -> tuple[float, int]:
    pygame.init()
    try:
        env.reset(seed=seed)
        frame = env.render()
        if frame is None:
            raise RuntimeError("Environment did not return a frame for human rendering.")

        screen, window_size = _prepare_screen(frame, zoom, "Pong: You are playing")
        clock = pygame.time.Clock()
        total_reward = 0.0
        done = False
        truncated = False
        steps = 0
        user_exit = False

        while not (done or truncated):
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    user_exit = True
                    break
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    user_exit = True
                    break

            if user_exit:
                break

            action = _action_from_keys(pygame.key.get_pressed())
            _, reward, done, truncated, _ = env.step(action)
            total_reward += float(reward)

            frame = env.render()
            if frame is None:
                raise RuntimeError("Environment returned no frame during human play.")
            _draw_frame(screen, frame, window_size)

            steps += 1
            if steps >= max_steps:
                break
            clock.tick(fps)

        return total_reward, steps
    finally:
        pygame.quit()


def play_ai_episode(
    model: PPO,
    env,
    *,
    seed: int,
    fps: int,
    zoom: float,
    max_steps: int,
    render: bool,
) -> tuple[float, int]:
    obs, _ = env.reset(seed=seed)
    screen = None
    window_size = (0, 0)
    clock = None

    if render:
        pygame.init()
        frame = env.render()
        if frame is not None:
            screen, window_size = _prepare_screen(frame, zoom, "Pong: AI is playing")
            clock = pygame.time.Clock()

    try:
        total_reward = 0.0
        done = False
        truncated = False
        steps = 0
        user_exit = False

        while not (done or truncated):
            if render:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        user_exit = True
                        break
                    if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                        user_exit = True
                        break

                if user_exit:
                    break

            action, _ = model.predict(obs, deterministic=True)
            obs, reward, done, truncated, _ = env.step(action)
            total_reward += float(reward)

            if render and screen is not None and clock is not None:
                frame = env.render()
                if frame is not None:
                    _draw_frame(screen, frame, window_size)
                clock.tick(fps)

            steps += 1
            if steps >= max_steps:
                break

        return total_reward, steps
    finally:
        if render:
            pygame.quit()


def main() -> None:
    args = build_parser().parse_args()
    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"Model path does not exist: {model_path}")

    print("Controls: UP/W = up, DOWN/S = down, SPACE = fire, ESC = exit.")
    print("Step 1/2: Play your episode.")

    human_env = build_single_env(
        args.env_id,
        clip_rewards=True,
        render_mode="rgb_array",
        monitor=False,
    )
    try:
        human_score, human_steps = play_human_episode(
            human_env,
            seed=args.seed,
            fps=args.fps,
            zoom=args.zoom,
            max_steps=args.max_steps,
        )
    finally:
        human_env.close()

    print(f"Your score: {human_score:.3f} (steps={human_steps})")
    print("Step 2/2: AI plays.")

    model = PPO.load(str(model_path), device=args.device)
    ai_env = build_single_env(
        args.env_id,
        clip_rewards=True,
        render_mode="rgb_array" if args.watch_ai else None,
        monitor=False,
    )
    try:
        ai_score, ai_steps = play_ai_episode(
            model,
            ai_env,
            seed=args.seed,
            fps=args.fps,
            zoom=args.zoom,
            max_steps=args.max_steps,
            render=args.watch_ai,
        )
    finally:
        ai_env.close()

    print(f"AI score: {ai_score:.3f} (steps={ai_steps})")

    if human_score > ai_score:
        print("Result: You win.")
    elif ai_score > human_score:
        print("Result: AI wins.")
    else:
        print("Result: Tie.")


if __name__ == "__main__":
    main()
