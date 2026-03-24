# PPO vs Human Baseline on Pong (Reproducible Project)

This repository implements the full project defined in your proposal:

- **Research Question 1 (RQ1):** how many steps PPO needs to match/exceed a novice human baseline.
- **Research Question 2 (RQ2):** how stable PPO is across random seeds under the same budget.
- **Main setup:** Gymnasium Atari Pong (`ALE/Pong-v5`) + Stable-Baselines3 PPO.
- **Run matrix:** `1M` and `5M` training steps, each with `5` seeds.
- **Evaluation protocol:** every `100k` steps, evaluate with deterministic policy on exactly `20` episodes using a **fixed list of 20 evaluation seeds**.
- **Primary metric:** mean episodic return.
- **Secondary metric:** win rate.
- **Statistics:** mean ± standard error, bootstrap 95% CIs, and agent-human difference CI.

## 1) What Is Implemented

### Training pipeline
- PPO training with Stable-Baselines3.
- Canonical Atari preprocessing:
  - grayscale,
  - resize to `84x84`,
  - frame stacking (`4`),
  - reward clipping to `[-1, +1]`.
- Deterministic evaluation checkpoints every `100,000` timesteps.
- Per-run output with:
  - run config,
  - runtime metadata for reproducibility,
  - checkpoint-level metrics,
  - episode-level eval returns,
  - checkpoint models and final model.

### Experiment orchestration
- Script to run full matrix:
  - budgets: `1,000,000` and `5,000,000`,
  - seeds: `11,22,33,44,55`.
- Resume-friendly (`--skip-if-complete`).

### Human baseline workflow
- CSV template and validation utilities for:
  - `6` players,
  - `15` episodes per player.
- Interactive CLI for entering episode returns.

### Analysis/reporting
- Learning curve summary across seeds (mean ± SE per checkpoint).
- Final performance summary per budget.
- Bootstrap 95% CIs for:
  - agent mean (seed-level),
  - human mean (episode-level),
  - difference `(agent - human)`.
- Final report output in both JSON and Markdown.
- Learning curve plot image.

## 2) Repository Structure

```text
.
├── README.md
├── AI_USAGE_STATEMENT.md
├── requirements.txt
├── pyproject.toml
├── scripts
│   ├── train_single.py
│   ├── run_experiments.py
│   ├── collect_human_baseline.py
│   ├── analyze_results.py
│   ├── watch_agent.py
│   ├── play_vs_ai.py
│   └── render_learning_progress.py
├── src/pong_ppo
│   ├── config.py
│   ├── envs.py
│   ├── callbacks.py
│   ├── train.py
│   ├── analysis.py
│   ├── human_baseline.py
│   └── repro.py
├── data/human_baseline
│   └── human_returns_template.csv
└── tests
    └── test_analysis.py
```

## 3) Environment Setup

Use Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Install Atari ROMs (license-accepted path from proposal):

```bash
"$(python3 -m site --user-base)/bin/AutoROM" --accept-license
```

This avoids PATH issues on macOS user installs.

## 4) Run Experiments

### A. Single run (example: 1M, seed 11)

```bash
python scripts/train_single.py \
  --env-id ALE/Pong-v5 \
  --timesteps 1000000 \
  --seed 11 \
  --eval-freq 100000 \
  --n-eval-episodes 20 \
  --n-envs 8 \
  --output-root outputs
```

### B. Full proposal matrix (10 runs total)

```bash
python scripts/run_experiments.py \
  --env-id ALE/Pong-v5 \
  --budgets 1000000,5000000 \
  --seeds 11,22,33,44,55 \
  --eval-freq 100000 \
  --n-eval-episodes 20 \
  --n-envs 8 \
  --output-root outputs \
  --skip-if-complete
```

Monitor learning live with TensorBoard while training:

```bash
tensorboard --logdir outputs/ppo_pong
```

## 5) Human Baseline Collection

### Generate template

```bash
python scripts/collect_human_baseline.py make-template \
  --output data/human_baseline/human_returns_template.csv \
  --players 6 \
  --episodes 15
```

### Interactive entry

```bash
python scripts/collect_human_baseline.py interactive \
  --output data/human_baseline/human_returns.csv \
  --players 6 \
  --episodes 15
```

### Validate a completed CSV

```bash
python scripts/collect_human_baseline.py validate \
  --input data/human_baseline/human_returns.csv \
  --players 6 \
  --episodes 15
```

Expected CSV schema:

| column | type | note |
|---|---|---|
| `player_id` | string | one id per participant |
| `episode` | int | episode index (1..15) |
| `episode_return` | float | final Pong return for that episode |

## 6) Analyze Results

After runs are done:

```bash
python scripts/analyze_results.py \
  --output-root outputs \
  --experiment-name ppo_pong \
  --human-csv data/human_baseline/human_returns.csv
```

Main analysis artifacts:

- `outputs/ppo_pong/analysis/learning_curve_summary.csv`
- `outputs/ppo_pong/analysis/learning_curves.png`
- `outputs/ppo_pong/analysis/report.json`
- `outputs/ppo_pong/analysis/report.md`

## 7) Watch The Agent Play

### A. Live window (local desktop)

```bash
python scripts/watch_agent.py \
  --model outputs/ppo_pong/5M_steps/seed_11/final_model.zip \
  --env-id ALE/Pong-v5 \
  --episodes 3 \
  --render-mode human \
  --fps 12
```

### B. Save gameplay video (mp4)

```bash
python scripts/watch_agent.py \
  --model outputs/ppo_pong/5M_steps/seed_11/final_model.zip \
  --env-id ALE/Pong-v5 \
  --episodes 1 \
  --render-mode rgb_array \
  --video-output outputs/ppo_pong/5M_steps/seed_11/demo_episode.mp4
```

### C. Visualize learning progress from checkpoints

```bash
python scripts/render_learning_progress.py \
  --models-dir outputs/ppo_pong/5M_steps/seed_11/models \
  --keep 6 \
  --output-dir outputs/ppo_pong/5M_steps/seed_11/progress_videos
```

### D. Play against the AI (score challenge)

This runs one human-played episode first, then one AI-played episode on the same seed and compares scores.

```bash
python scripts/play_vs_ai.py \
  --model outputs/ppo_pong/5M_steps/seed_11/final_model.zip \
  --env-id ALE/Pong-v5 \
  --watch-ai \
  --fps 12
```

Controls:
- `UP` or `W`: move up
- `DOWN` or `S`: move down
- `SPACE`: fire / serve
- `ESC`: quit

## 8) Output Layout Per Run

For each run (`budget + seed`):

```text
outputs/ppo_pong/<budget_label>/seed_<seed>/
├── run_config.json
├── runtime_metadata.json
├── eval_checkpoints.csv
├── eval_episode_returns.csv
├── final_model.zip
├── models/
│   ├── checkpoint_000100000.zip
│   ├── checkpoint_000200000.zip
│   └── ...
└── tb/
```

`eval_checkpoints.csv` contains checkpoint summary rows with:
- timestep,
- mean return,
- std return (across eval episodes),
- win rate,
- seed, budget, run id.

`eval_episode_returns.csv` stores each episode return at each checkpoint (for auditing and deeper analysis).

## 9) Proposal Requirement Mapping

### From Section 3.1 (Algorithm & preprocessing)
- PPO from Stable-Baselines3: implemented.
- Gymnasium Atari Pong: implemented.
- Grayscale/84x84/stack4/reward clipping: implemented in environment wrappers.
- Default Atari-like PPO starting hyperparameters:
  - `n_steps=128`,
  - `n_epochs=4`,
  - `batch_size=256`,
  - `clip_range=0.1`.

### From Section 3.2 (Experimental design)
- Budgets `1M` and `5M`: supported directly.
- `5` seeds: supported directly.
- Evaluation every `100k`: implemented.
- `20` deterministic eval episodes with fixed eval seeds: implemented.
- Mean return as primary checkpoint metric: implemented.

### From Section 3.3 (Hypothesis test outputs)
- Final mean across seeds ± SE: implemented.
- 95% bootstrap CI for agent mean: implemented.
- 95% bootstrap CI for human mean: implemented.
- 95% bootstrap CI for difference `(agent - human)`: implemented.
- Win rate secondary metric: implemented.
- Visual checkpoint videos for interpretability: implemented.

### From Section 3.4 (Data acquisition/reproducibility)
- Training/eval logs exported to CSV.
- Hyperparameters + environment metadata logged.
- Runtime metadata (versions/platform/git hash) saved per run.

### From Section 3.5 (contingency)
- You can switch environment with `--env-id` if Atari ROM setup fails.
- Same run/evaluation/statistical pipeline remains unchanged.

## 10) Reproducibility Notes

- Use fixed training seeds and fixed eval seed list.
- Keep package versions stable (`requirements.txt`).
- Save raw episode-level evaluation data.
- Save configuration and runtime metadata for each run.

## 11) Quick Validation

Run tests:

```bash
python3 -m pytest
```

Current unit tests cover statistical utility correctness and seed-final score extraction logic.

## 12) Suggested Execution Order

1. Install dependencies + ROMs.
2. Run full experiment matrix.
3. Collect/validate human baseline CSV.
4. Run analysis script.
5. Use generated `report.md` + `learning_curves.png` in the final report.
