export interface CheckpointRow {
  budget_steps: number;
  timestep: number;
  n_seeds: number;
  mean_return: number;
  mean_win_rate: number;
  std_across_seeds: number | null;
  se_return: number;
}

export interface AgentFinalPerformance {
  budget_steps: number;
  n_seeds: number;
  seed_returns: number[];
  agent_mean_return: number;
  agent_se_return: number;
  agent_mean_ci95_low: number;
  agent_mean_ci95_high: number;
}

export interface HumanBaseline {
  n_players: number;
  n_episodes: number;
  mean_return: number;
  std_return: number;
  human_mean_ci95_low: number;
  human_mean_ci95_high: number;
}

export interface Report {
  experiment_name: string;
  agent_final_by_budget: AgentFinalPerformance[];
  human_baseline?: HumanBaseline;
  comparison?: {
    agent_budget_steps: number;
    agent_mean_return: number;
    human_mean_return: number;
    difference_mean: number;
    difference_ci95_low: number;
    difference_ci95_high: number;
    success_criterion_met: boolean;
  };
}

export interface SeedCheckpointRow {
  timestep: number;
  mean_return: number;
  std_return: number;
  win_rate: number;
  seed: number;
  budget: number;
}

export interface PlayerData {
  player_id: string;
  mean_return: number;
  std_return: number;
  n_episodes: number;
  min_return: number;
  max_return: number;
}
