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
    interactive.add_argument(
        "--play",
        action="store_true",
        help="Launch a Pong window for each episode. Score is recorded automatically.",
    )
    interactive.add_argument("--env-id", default="ALE/Pong-v5")
    interactive.add_argument("--fps", type=int, default=60,
                              help="Display frame rate (visual smoothness).")
    interactive.add_argument("--game-fps", type=int, default=15,
                              help="Game logic speed — lower = slower ball and paddle.")
    interactive.add_argument("--zoom", type=float, default=3.0)
    interactive.add_argument("--seed-offset", type=int, default=0,
                              help="Episode seeds start at seed-offset+episode_number.")
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


def _play_one_episode(env_id: str, seed: int, fps: int, game_fps: int, zoom: float) -> float:
    """Launch a pygame Pong window, let the human play, return the episode score.

    fps controls display smoothness; game_fps controls how fast the ball and
    paddle actually move. Each game step is shown for (fps // game_fps) display
    frames so the image stays smooth while the game runs slower.
    """
    import numpy as np
    import pygame

    from pong_ppo.envs import build_single_env

    # How many display frames to hold each game frame for.
    hold_frames = max(1, round(fps / game_fps))

    env = build_single_env(env_id, clip_rewards=False, render_mode="rgb_array", monitor=False)
    pygame.init()
    try:
        obs, _ = env.reset(seed=seed)
        frame = env.render()
        if frame is None:
            raise RuntimeError("Environment returned no frame.")

        frame_h, frame_w = frame.shape[0], frame.shape[1]
        window_w, window_h = int(frame_w * zoom), int(frame_h * zoom)
        screen = pygame.display.set_mode((window_w, window_h))
        pygame.display.set_caption("Pong — you are playing  |  ESC to quit episode")
        clock = pygame.time.Clock()

        total_reward = 0.0
        done = False
        truncated = False
        current_surface = None

        while not (done or truncated):
            # Read keys and step the game once.
            quit_requested = False
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    quit_requested = True
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    quit_requested = True

            if quit_requested:
                break

            keys = pygame.key.get_pressed()
            up = keys[pygame.K_UP] or keys[pygame.K_w]
            down = keys[pygame.K_DOWN] or keys[pygame.K_s]
            fire = keys[pygame.K_SPACE]
            if up and fire:
                action = 4
            elif down and fire:
                action = 5
            elif up:
                action = 2
            elif down:
                action = 3
            elif fire:
                action = 1
            else:
                action = 0

            obs, reward, done, truncated, _ = env.step(action)
            total_reward += float(reward)

            frame = env.render()
            if frame is not None:
                current_surface = pygame.transform.scale(
                    pygame.surfarray.make_surface(np.transpose(frame, (1, 0, 2))),
                    (window_w, window_h),
                )

            # Display the same game frame for `hold_frames` display frames.
            for _ in range(hold_frames):
                if current_surface is not None:
                    screen.blit(current_surface, (0, 0))
                    pygame.display.flip()
                clock.tick(fps)

        return total_reward
    finally:
        env.close()
        pygame.quit()


def cmd_interactive(
    output: Path,
    players: int,
    episodes: int,
    player_names_raw: str,
    play: bool,
    env_id: str,
    fps: int,
    game_fps: int,
    zoom: float,
    seed_offset: int,
) -> int:
    player_names = _parse_player_names(player_names_raw, players)
    rows: list[dict] = []
    print("Entering interactive human baseline collection.")
    if play:
        print("Controls: UP/W = up, DOWN/S = down, SPACE = fire, ESC = end episode early.")
    else:
        print(
            "Protocol reminder: same keyboard settings + rendering for all players, "
            f"{episodes} episodes each."
        )

    for player in player_names:
        print(f"\nPlayer: {player}")
        input("Press Enter when ready to start...")
        for episode in range(1, episodes + 1):
            if play:
                seed = seed_offset + episode
                print(f"Episode {episode}/{episodes} — close the window or press ESC when done.")
                value = _play_one_episode(env_id, seed=seed, fps=fps, game_fps=game_fps, zoom=zoom)
                print(f"  Score: {value}")
            else:
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
                play=args.play,
                env_id=args.env_id,
                fps=args.fps,
                game_fps=args.game_fps,
                zoom=args.zoom,
                seed_offset=args.seed_offset,
            )
        )

    raise RuntimeError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
