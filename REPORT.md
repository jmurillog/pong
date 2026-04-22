# Can a PPO Reinforcement Learning Agent Reach and Exceed a Novice Human Baseline in Pong Under a Fixed Compute Budget?

**José María Murillo, Hans Helmrich, Beatriz Wahle, Valentín Miguel, Pablo Chen, Nicolás Cubillo**
IE University · Emerging Topics in Data Analysis · April 2026

---

## Abstract

We establish a reproducible benchmark comparing Proximal Policy Optimization (PPO) against a measured novice human baseline on Atari Pong. Across five random seeds, PPO trained for 1,000,000 timesteps achieves a mean episodic return of −8.46 (95% CI: [−10.78, −6.58]), already exceeding the human baseline mean of −15.73 (95% CI: [−16.40, −15.06]) by 7.27 points (CI: [4.98, 9.27]). Extending training to 5,000,000 timesteps raises agent performance to +15.61 (CI: [+14.33, +16.62]), a 31.34-point margin over humans, with 100% win rate across all seeds. Analysis of learning curves reveals PPO first exceeds the human mean at approximately 800,000 timesteps. Seed variance decreases from σ = 2.64 at 1M to σ = 1.47 at 5M steps, confirming reliable convergence. All code and raw data are publicly available.

---

## Introduction

Reinforcement learning (RL) has produced landmark results in artificial intelligence — from AlphaGo defeating world champions (Silver et al., 2016) to DQN mastering Atari games from raw pixels (Mnih et al., 2015). Yet most of this work operates at scales that are inaccessible to teams without large compute budgets. A practically important but underexplored question follows: how far can a standard RL algorithm get on a well-defined task under a fixed, modest compute budget — and at what point does it cross the threshold of human competence?

**Research gap.** Most RL benchmarking studies compare algorithms against each other or against human scores that were collected under non-standardized conditions (Mnih et al., 2015 used professional game testers with unlimited practice). Critically, these comparisons rarely quantify uncertainty: they report point estimates without confidence intervals, making it impossible to assess whether a reported performance gap is reliable or a product of random seed selection. Henderson et al. (2018) demonstrated that different seeds, codebases, and hyperparameter choices can produce dramatically different results for the same algorithm on the same task — a finding that directly motivates our multi-seed design. Agarwal et al. (2021) further showed that the field has systematically underreported uncertainty and advocated for bootstrap confidence intervals as the appropriate evaluation protocol for deep RL.

**Novelty.** We address this gap by: (1) collecting a fresh, in-house novice human baseline under the same evaluation conditions as the agent (same environment, opponent, and scoring system); (2) reporting bootstrap 95% confidence intervals for the agent mean, the human mean, and the agent−human difference simultaneously, enabling statistically principled comparison; and (3) framing the study around two concrete hypotheses with a pre-specified success criterion. The primary stakeholder is any small engineering team that must decide whether PPO is a sensible first choice for game agent development under time and compute constraints: our sample-efficiency curve and seed-stability estimates directly support that decision.

**Hypotheses.** H1: PPO will reach or exceed the novice human baseline within 5M environment steps. H2: Performance will show meaningful variance across seeds, such that single-run reporting would meaningfully misrepresent algorithm reliability (Henderson et al., 2018). Both hypotheses were tested prospectively and their confirmation assessed against bootstrap CIs.

---

## Results

### Learning dynamics

Figure 1 presents learning curves (mean ± 1 SE across five seeds) for both training budgets alongside the human baseline. Both trajectories share a cold-start phase: mean return is −21.0 for the first 200,000–400,000 timesteps, indicating the agent has not yet discovered it can score any points. Around step 500,000, performance rises sharply. At 800,000 timesteps — approximately 80% into the shorter budget — the mean first exceeds the human baseline mean of −15.73, directly answering **RQ1**: PPO surpasses novice human performance at roughly **800k training steps**, well within a 1M-step budget.

The 5M trajectory continues improving after the 1M run terminates. The agent crosses zero return (winning more points than it concedes) at approximately 1.4M steps, reaches a 100% win rate by 3.6M steps, and stabilizes at +15.61 return at 5M steps. The characteristic two-phase learning structure — rapid acquisition of game mechanics (500k–1.5M) followed by gradual refinement (1.5M–5M) — is consistent across all five seeds.

**[Figure 1: Learning curves — learning_curves.png]**

### Final performance and human comparison

Table 1 summarizes final performance for both budgets against the human baseline.

**Table 1. Final performance: PPO agent vs. novice human baseline**

| Condition | n | Mean Return | SE | 95% CI | Win Rate |
|---|---|---|---|---|---|
| Human baseline | 90 ep. | −15.73 | 0.35 | [−16.40, −15.06] | 0% |
| PPO — 1M steps | 5 seeds | −8.46 | 1.18 | [−10.78, −6.58] | 10% |
| PPO — 5M steps | 5 seeds | +15.61 | 0.66 | [+14.33, +16.62] | 100% |

**H1 confirmed.** The 95% bootstrap CI for the agent−human difference at 1M steps is [+4.98, +9.27], entirely excluding zero. At 5M steps, the difference is +31.34 (CI: [+29.94, +32.57]). PPO significantly exceeds the novice human baseline at both budgets; at 5M steps, the agent achieves near-perfect mastery. **H2 confirmed.** At 1M steps, per-seed final returns span [−12.35, −6.20] with σ = 2.64, confirming that single-seed reporting would be misleading: a cherry-picked best run (−6.2) appears 50% better than the worst (−12.35). At 5M steps, variance shrinks substantially (σ = 1.47, range [+13.25, +17.00]), but differences between seeds remain non-trivial for decision-making under compute constraints.

### Seed-level variance

Figure 2 shows per-seed final returns for both budgets against the human baseline. All five 5M seeds individually exceed the entire human distribution. All five 1M seeds exceed the human mean.

**[Figure 2: Seed variance bar chart — seed_variance.png]**

---

## Discussion

### Interpretation

The most striking finding is the speed of human-level surpassing: approximately 800,000 timesteps, corresponding to under two hours of wall-clock training on a consumer laptop with GPU acceleration. This is far earlier than the 1M-step budget would suggest is needed, meaning teams operating under tight compute constraints can still expect above-human performance. The cold-start plateau (steps 1–400k) followed by rapid improvement is consistent with the well-documented reward sparsity problem in Atari: the agent must first discover that scoring is possible before systematic improvement can occur.

At 5M steps, the 100% win rate across all seeds indicates the agent has effectively solved Pong at the difficulty of the built-in ROM opponent. Remaining episodic variation (+13 to +17) reflects game stochasticity, not policy uncertainty.

### Implications and recommendations

For practitioners, the results support the following decision framework: a 1M-step PPO run is a low-risk choice for reaching above-human novice performance on Pong, while a 5M-step run achieves near-perfect play with high reliability. The seed-stability improvement from 1M to 5M (σ: 2.64 → 1.47) suggests that increasing compute not only raises the mean but also reduces the risk of a poor outcome from unlucky initialization. We recommend always running at minimum 3–5 seeds before reporting results, as single-run performance estimates carry substantial uncertainty even in a relatively easy environment like Pong.

### Ethical considerations

While this study is technically benign, it touches on broader considerations relevant to RL benchmarking. Human-AI comparisons carry implicit claims about substitutability: framing an agent as "superhuman" after comparing it to novice players under non-representative conditions would be misleading. Our study deliberately limits its claims — we benchmark against novice humans playing under time pressure with unfamiliar controls, not experienced players or game-specific experts. Additionally, the fabricated nature of the Atari environment means the agent's superiority reflects mastery of a fixed, known-dynamics simulator, not general intelligence. These distinctions matter when communicating RL results to non-technical audiences or policymakers.

### Limitations

Several limitations qualify these conclusions. First, the human participants are novice players (no prior Pong experience); a baseline including experienced players would set a higher bar and may yield different crossover timings. Second, Pong is widely regarded as one of the easier Atari games for deep RL; the same budget on games such as Montezuma's Revenge or Pitfall would yield very different results. Third, the agent is trained against a fixed, deterministic ROM opponent: its policy may not generalize to novel or adaptive opponents. Fourth, wall-clock training time was not systematically recorded across all seeds, limiting reproducibility for time-constrained practitioners.

### Future directions

Natural extensions include: (1) testing the same pipeline on harder Atari games to characterize where the human-surpassing threshold lies as a function of game complexity; (2) collecting an experienced human baseline to establish an upper bound that RL may not yet reach; (3) comparing PPO against DQN and A3C under identical budgets and the same human baseline to isolate algorithmic differences from evaluation differences; (4) investigating whether the 800k crossover point is robust to hyperparameter changes, particularly the clip range and learning rate.

---

## Methods

### Environment and preprocessing

All experiments use `ALE/Pong-v5` via Gymnasium 1.0.0 and ale-py 0.10.1. Standard Atari preprocessing is applied: frames are converted to grayscale and resized to 84×84 pixels; four consecutive frames are stacked to provide temporal information to the policy; rewards are clipped to [−1, +1] during training to normalize the gradient signal. Eight parallel environments are used throughout training.

### Algorithm

We use Proximal Policy Optimization (Schulman et al., 2017) implemented in Stable-Baselines3 2.4.1. PPO constrains each policy gradient update to remain within a trust region via a clipped surrogate objective, balancing sample efficiency with training stability. Hyperparameters follow the Stable-Baselines3 Atari defaults: n\_steps = 128, n\_epochs = 4, mini-batch size = 256, clip range ε = 0.1, learning rate α = 2.5 × 10⁻⁴, discount factor γ = 0.99, GAE parameter λ = 0.95, entropy coefficient = 0.01, value function coefficient = 0.5, max gradient norm = 0.5. No hyperparameter tuning was performed; the goal is to assess what a default PPO run achieves, which is directly consistent with our stakeholder question.

### Experimental design

Two training budgets were evaluated: 1,000,000 and 5,000,000 timesteps. Each was run with five independent random seeds {11, 22, 33, 44, 55}, yielding 10 total training runs. Every 100,000 timesteps, the policy was evaluated deterministically (no exploration) on 20 episodes using a fixed set of evaluation seeds {1000, …, 1019}, ensuring checkpoint comparisons are not confounded by evaluation stochasticity. The primary metric is mean episodic return; win rate (fraction of episodes with positive return) is the secondary metric.

### Human baseline

Six participants (IE University students, no prior Pong experience) each played 15 complete episodes of Pong against the built-in ROM opponent, yielding 90 total episodes. Episode return is defined as (player points) − (opponent points), range [−21, +21]. Data were recorded using the project web dashboard.

### Statistical analysis

Agent performance is summarized as the mean of seed-level final returns (n = 5) ± standard error (SE = σ/√n). Human performance is the mean of all episode returns (n = 90) ± SE. Bootstrap 95% CIs are computed for: (a) agent mean, (b) human mean, and (c) the agent−human difference. All bootstrap estimates use 10,000 resamples with a fixed RNG seed (12345) for reproducibility. The success criterion was pre-specified as: the 5M agent mean exceeds the human mean with a bootstrap CI for the difference that entirely excludes zero.

---

## Author Contributions

| Name | Role | Contribution |
|---|---|---|
| José María Murillo | Project Lead | Overall coordination, PPO training pipeline, hyperparameter setup, final report editing |
| Hans Helmrich | RL Engineer | Environment setup (Gymnasium/Atari), frame preprocessing, reward logging, web dashboard |
| Beatriz Wahle | Data & Evaluation | Human baseline collection protocol, evaluation metrics, seed variance analysis |
| Valentín Miguel | Literature & Writing | Literature review, methods section writing, references management |
| Pablo Chen | Experiments & Analysis | Multi-seed experiment runs, learning curve visualization, statistical reporting |
| Nicolás Cubillo | Reproducibility & Code | Code documentation, reproducibility pipeline, appendix, AI usage statement |

---

## Appendix

### References

Agarwal, R., Schwarzer, M., Castro, P. S., Courville, A. C., & Bellemare, M. (2021). Deep reinforcement learning at the edge of the statistical precipice. *Advances in Neural Information Processing Systems*, 34, 29304–29320.

Bellemare, M. G., Naddaf, Y., Veness, J., & Bowling, M. (2013). The Arcade Learning Environment: An evaluation platform for general agents. *Journal of Artificial Intelligence Research*, 47, 253–279.

Henderson, P., Islam, R., Bachman, P., Pineau, J., Precup, D., & Meger, D. (2018). Deep reinforcement learning that matters. *Proceedings of the AAAI Conference on Artificial Intelligence*, 32(1).

Mnih, V., Kavukcuoglu, K., Silver, D., et al. (2015). Human-level control through deep reinforcement learning. *Nature*, 518(7540), 529–533.

Raffin, A., Hill, A., Gleave, A., Kanervisto, A., Ernestus, M., & Dormann, N. (2021). Stable-Baselines3: Reliable reinforcement learning implementations. *Journal of Machine Learning Research*, 22(268), 1–8.

Schulman, J., Wolski, F., Dhariwal, P., Radford, A., & Klimov, O. (2017). Proximal policy optimization algorithms. *arXiv preprint arXiv:1707.06347*.

Silver, D., Huang, A., Maddison, C. J., et al. (2016). Mastering the game of Go with deep neural networks and tree search. *Nature*, 529(7587), 484–489.

---

### Code Availability Statement

All code is available in the project repository. The pipeline is structured as follows:

**Environment setup:**
```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
AutoROM --accept-license
```

**Reproduce the full 10-run experiment matrix:**
```
python scripts/run_experiments.py \
  --env-id ALE/Pong-v5 --budgets 1000000,5000000 \
  --seeds 11,22,33,44,55 --eval-freq 100000 \
  --n-eval-episodes 20 --n-envs 8 --output-root outputs --skip-if-complete
```

**Regenerate all tables, figures, and statistics:**
```
python scripts/analyze_results.py --output-root outputs \
  --experiment-name ppo_pong --human-csv data/human_baseline/human_returns.csv
```

Raw per-run CSV logs, model checkpoints, and runtime metadata (package versions, platform, git hash) are stored in `outputs/ppo_pong/{budget}/seed_{seed}/`. Training at full scale on Apple M3 with MPS acceleration takes approximately 8–10 hours per 5M-step seed.

---

### AI Usage Statement

This project used AI tooling (Claude Code, Anthropic) for code generation, documentation drafting, and implementation acceleration. All technical decisions, experimental design choices, and reported results were supervised and verified by the human authors. No experimental data were fabricated; all tables and figures are derived from actual executed training runs. Statistical analysis and result interpretation reflect the authors' understanding of the methodology and findings.
