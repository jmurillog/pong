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

from pong_ppo.analysis import (
    compare_agent_vs_human,
    final_seed_level_scores,
    learning_curve_summary,
    load_eval_checkpoints,
    load_human_returns,
    plot_learning_curves,
    summarize_agent_final_performance,
    summarize_human_baseline,
    write_json,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze PPO-Pong experiment outputs.")
    parser.add_argument("--output-root", default="outputs")
    parser.add_argument("--experiment-name", default="ppo_pong")
    parser.add_argument("--human-csv", default="data/human_baseline/human_returns.csv")
    parser.add_argument("--skip-human", action="store_true")
    return parser


def write_markdown_report(path: Path, payload: dict) -> None:
    lines: list[str] = []
    lines.append("# PPO Pong Experiment Report")
    lines.append("")
    lines.append("## Agent Final Performance by Budget")
    lines.append("")
    lines.append("| Budget | Seeds | Mean Return | SE | 95% CI (bootstrap) |")
    lines.append("|---|---:|---:|---:|---:|")
    for row in payload["agent_final_by_budget"]:
        budget = row["budget_steps"]
        ci = f"[{row['agent_mean_ci95_low']:.3f}, {row['agent_mean_ci95_high']:.3f}]"
        lines.append(
            f"| {budget:,} | {row['n_seeds']} | {row['agent_mean_return']:.3f} | "
            f"{row['agent_se_return']:.3f} | {ci} |"
        )

    human = payload.get("human_summary")
    if human:
        lines.append("")
        lines.append("## Human Baseline")
        lines.append("")
        lines.append(
            f"- Players: **{human['n_players']}**, total episodes: **{human['n_episodes_total']}**"
        )
        lines.append(
            f"- Mean return: **{human['human_mean_return']:.3f}**, "
            f"SD: **{human['human_std_return']:.3f}**"
        )
        lines.append(
            f"- 95% bootstrap CI: "
            f"**[{human['human_mean_ci95_low']:.3f}, {human['human_mean_ci95_high']:.3f}]**"
        )

    comparisons = payload.get("agent_vs_human", [])
    if comparisons:
        lines.append("")
        lines.append("## Agent vs Human")
        lines.append("")
        lines.append("| Budget | Agent - Human Mean | 95% CI (bootstrap) |")
        lines.append("|---|---:|---:|")
        for row in comparisons:
            ci = f"[{row['agent_minus_human_ci95_low']:.3f}, {row['agent_minus_human_ci95_high']:.3f}]"
            lines.append(
                f"| {row['budget_steps']:,} | {row['agent_minus_human_mean']:.3f} | {ci} |"
            )

    if "success_criterion" in payload:
        lines.append("")
        lines.append("## Success Criterion (5M budget)")
        lines.append("")
        status = "PASSED" if payload["success_criterion"]["met"] else "NOT PASSED"
        lines.append(f"- Status: **{status}**")
        lines.append(
            f"- Agent mean: **{payload['success_criterion']['agent_mean_return']:.3f}**"
        )
        lines.append(
            f"- Human mean: **{payload['success_criterion']['human_mean_return']:.3f}**"
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = build_parser().parse_args()
    output_root = Path(args.output_root)
    experiment_name = args.experiment_name
    analysis_dir = output_root / experiment_name / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)

    checkpoints = load_eval_checkpoints(output_root, experiment_name)
    if checkpoints.empty:
        raise SystemExit(
            f"No checkpoint data found under {(output_root / experiment_name).resolve()}"
        )

    curve = learning_curve_summary(checkpoints)
    curve_csv = analysis_dir / "learning_curve_summary.csv"
    curve.to_csv(curve_csv, index=False)
    plot_path = analysis_dir / "learning_curves.png"
    plot_learning_curves(curve, plot_path)

    budgets = sorted(checkpoints["budget_steps"].unique())
    agent_final = [summarize_agent_final_performance(checkpoints, int(b)) for b in budgets]

    payload: dict = {
        "experiment_name": experiment_name,
        "agent_final_by_budget": agent_final,
        "artifacts": {
            "learning_curve_summary_csv": str(curve_csv),
            "learning_curves_plot": str(plot_path),
        },
    }

    if not args.skip_human and Path(args.human_csv).exists():
        human_df = load_human_returns(Path(args.human_csv))
        human_summary = summarize_human_baseline(human_df)
        payload["human_summary"] = human_summary

        comparisons: list[dict] = []
        for budget in budgets:
            seed_scores = final_seed_level_scores(checkpoints, int(budget))
            cmp_row = compare_agent_vs_human(
                seed_scores["mean_return"].tolist(),
                human_df["episode_return"].tolist(),
            )
            cmp_row["budget_steps"] = int(budget)
            comparisons.append(cmp_row)
        payload["agent_vs_human"] = comparisons

        if 5_000_000 in budgets:
            final_5m = next(row for row in agent_final if row["budget_steps"] == 5_000_000)
            met = final_5m["agent_mean_return"] >= human_summary["human_mean_return"]
            payload["success_criterion"] = {
                "budget_steps": 5_000_000,
                "met": bool(met),
                "agent_mean_return": final_5m["agent_mean_return"],
                "human_mean_return": human_summary["human_mean_return"],
            }

    report_json = analysis_dir / "report.json"
    report_md = analysis_dir / "report.md"
    write_json(report_json, payload)
    write_markdown_report(report_md, payload)

    print(f"Wrote: {curve_csv}")
    print(f"Wrote: {plot_path}")
    print(f"Wrote: {report_json}")
    print(f"Wrote: {report_md}")


if __name__ == "__main__":
    main()

