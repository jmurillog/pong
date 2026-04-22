import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const reportPath = path.resolve(process.cwd(), '..', 'outputs', 'ppo_pong', 'analysis', 'report.json');

    if (!fs.existsSync(reportPath)) {
      return NextResponse.json({});
    }

    const raw = fs.readFileSync(reportPath, 'utf-8');
    const data = JSON.parse(raw);

    // Transform report.json field names to match the frontend Report type.
    // report.json uses: human_summary, agent_vs_human, success_criterion
    // frontend expects:  human_baseline,   comparison
    const transformed: Record<string, unknown> = {
      experiment_name: data.experiment_name,
      agent_final_by_budget: data.agent_final_by_budget ?? [],
    };

    if (data.human_summary) {
      const hs = data.human_summary;
      // n_episodes = episodes per player (used in SE denominator: std / sqrt(n_players * n_episodes))
      const episodesPerPlayer = hs.episodes_per_player_min ?? hs.episodes_per_player_max ?? (hs.n_episodes_total / hs.n_players);
      transformed.human_baseline = {
        n_players: hs.n_players,
        n_episodes: episodesPerPlayer,
        mean_return: hs.human_mean_return,
        std_return: hs.human_std_return,
        human_mean_ci95_low: hs.human_mean_ci95_low,
        human_mean_ci95_high: hs.human_mean_ci95_high,
      };
    }

    // Build comparison from the highest-budget agent_vs_human entry + success_criterion
    if (data.agent_vs_human?.length && data.success_criterion) {
      const sc = data.success_criterion;
      // Find the agent_vs_human row matching the success-criterion budget
      const avh = (data.agent_vs_human as { budget_steps: number; agent_minus_human_mean: number; agent_minus_human_ci95_low: number; agent_minus_human_ci95_high: number }[])
        .find((r) => r.budget_steps === sc.budget_steps) ?? data.agent_vs_human[data.agent_vs_human.length - 1];
      transformed.comparison = {
        agent_budget_steps: sc.budget_steps,
        agent_mean_return: sc.agent_mean_return,
        human_mean_return: sc.human_mean_return,
        difference_mean: avh.agent_minus_human_mean,
        difference_ci95_low: avh.agent_minus_human_ci95_low,
        difference_ci95_high: avh.agent_minus_human_ci95_high,
        success_criterion_met: sc.met,
      };
    }

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error reading report.json:', error);
    return NextResponse.json({});
  }
}
