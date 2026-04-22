'use client';

import Image from 'next/image';

/* ── tiny prose helpers ── */
function Section({ id, number, title, children }: { id: string; number?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-base font-semibold text-white mb-3 flex items-baseline gap-2">
        {number && <span className="text-zinc-500 text-sm font-normal">{number}</span>}
        {title}
      </h2>
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-2">{title}</h3>
      <div className="space-y-2 text-sm text-zinc-300 leading-relaxed">{children}</div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-300 leading-relaxed">{children}</p>;
}

function Cite({ children }: { children: React.ReactNode }) {
  return <span className="text-zinc-400 italic">{children}</span>;
}

function Hypo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-zinc-300 leading-relaxed">
      <span className="font-semibold text-blue-400">{label}:</span> {children}
    </p>
  );
}

function ResultBadge({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-emerald-400 font-semibold">{label}</span>
      <span className="text-zinc-400">—</span>
      <span>{children}</span>
    </span>
  );
}

/* ── main table component ── */
function PaperTable({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="my-6">
      <p className="text-xs text-zinc-500 mb-2 font-medium">{caption}</p>
      <div className="overflow-x-auto border border-zinc-800 rounded-lg">
        {children}
      </div>
    </div>
  );
}

/* ── figure box ── */
function Fig({ src, caption, note }: { src: string; caption: string; note?: string }) {
  return (
    <div className="my-6 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="relative w-full" style={{ minHeight: 220 }}>
        <Image
          src={src}
          alt={caption}
          width={900}
          height={400}
          className="w-full h-auto rounded"
          unoptimized
        />
      </div>
      <p className="text-xs text-zinc-500 mt-3 leading-snug">
        <span className="font-medium text-zinc-400">{caption}</span>
        {note && <span> {note}</span>}
      </p>
    </div>
  );
}

/* ── TOC anchor link ── */
function TocItem({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="block text-xs text-zinc-500 hover:text-zinc-200 py-0.5 transition-colors">
      {label}
    </a>
  );
}

export default function ReportPage() {
  return (
    <div className="flex gap-8 items-start">

      {/* ── sticky TOC ── */}
      <aside className="hidden xl:block w-44 shrink-0 sticky top-6">
        <p className="text-xs font-medium text-zinc-600 mb-2 uppercase tracking-wider">Contents</p>
        <nav className="space-y-0.5">
          <TocItem href="#abstract" label="Abstract" />
          <TocItem href="#introduction" label="Introduction" />
          <TocItem href="#results" label="Results" />
          <TocItem href="#discussion" label="Discussion" />
          <TocItem href="#methods" label="Methods" />
          <TocItem href="#authors" label="Author Contributions" />
          <TocItem href="#references" label="References" />
          <TocItem href="#code" label="Code Availability" />
          <TocItem href="#ai" label="AI Usage" />
        </nav>
      </aside>

      {/* ── paper body ── */}
      <div className="flex-1 min-w-0 max-w-3xl">

        {/* Title block */}
        <div className="mb-10 pb-8 border-b border-zinc-800">
          <h1 className="text-xl font-semibold text-white leading-snug mb-4">
            Can a PPO Reinforcement Learning Agent Reach and Exceed a Novice Human Baseline in Pong Under a Fixed Compute Budget?
          </h1>
          <p className="text-sm text-zinc-400 mb-1">
            José María Murillo · Hans Helmrich · Beatriz Wahle · Valentín Miguel · Pablo Chen · Nicolás Cubillo
          </p>
          <p className="text-xs text-zinc-600">IE University · Emerging Topics in Data Analysis · April 2026</p>
        </div>

        {/* Abstract */}
        <section id="abstract" className="mb-10 bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Abstract</h2>
          <P>
            We establish a reproducible benchmark comparing Proximal Policy Optimization (PPO) against a
            measured novice human baseline on Atari Pong. Across five random seeds, PPO trained for
            1,000,000 timesteps achieves a mean episodic return of −8.46 (95% CI: [−10.78, −6.58]),
            already exceeding the human baseline mean of −15.73 (95% CI: [−16.40, −15.06]) by 7.27
            points (CI: [4.98, 9.27]). Extending training to 5,000,000 timesteps raises agent performance
            to +15.61 (CI: [+14.33, +16.62]), a 31.34-point margin over humans, with 100% win rate across
            all seeds. Analysis of learning curves reveals PPO first exceeds the human mean at approximately
            800,000 timesteps. Seed variance decreases from σ = 2.64 at 1M to σ = 1.47 at 5M steps,
            confirming reliable convergence. All code and raw data are publicly available.
          </P>
        </section>

        {/* Introduction */}
        <Section id="introduction" number="1" title="Introduction">
          <P>
            Reinforcement learning (RL) has produced landmark results in artificial intelligence — from
            AlphaGo defeating world champions (Silver et al., 2016) to DQN mastering Atari games from
            raw pixels (Mnih et al., 2015). Yet most of this work operates at scales inaccessible to teams
            without large compute budgets. A practically important but underexplored question follows: how
            far can a standard RL algorithm get on a well-defined task under a fixed, modest compute
            budget — and at what point does it cross the threshold of human competence?
          </P>

          <Sub title="Research gap">
            <P>
              Most RL benchmarking studies compare algorithms against each other or against human scores
              collected under non-standardized conditions. Mnih et al. (2015) used professional game testers
              with unlimited practice; those scores carry no uncertainty estimates and cannot be directly
              compared to a fresh, novice population. <Cite>Henderson et al. (2018)</Cite> demonstrated that
              different seeds, codebases, and hyperparameter choices produce dramatically different results for
              the same algorithm on the same task — making single-run reporting unreliable.{' '}
              <Cite>Agarwal et al. (2021)</Cite> further showed that the field has systematically underreported
              uncertainty and advocated for bootstrap confidence intervals as the appropriate protocol for deep RL.
            </P>
          </Sub>

          <Sub title="Novelty">
            <P>
              We address this gap by: (1) collecting a fresh, in-house novice human baseline under identical
              evaluation conditions as the agent (same environment, opponent, and scoring system); (2) reporting
              bootstrap 95% confidence intervals for the agent mean, the human mean, and the agent−human
              difference simultaneously; and (3) framing the study around two pre-specified hypotheses with a
              declared success criterion. The primary stakeholder is any small engineering team deciding whether
              PPO is a sensible first choice for game agent development under compute constraints: our
              sample-efficiency curve and seed-stability estimates directly inform that decision.
            </P>
          </Sub>

          <Sub title="Hypotheses">
            <Hypo label="H1">PPO will reach or exceed the novice human baseline within 5M environment steps.</Hypo>
            <Hypo label="H2">
              Performance will show meaningful variance across seeds, such that single-run reporting would
              meaningfully misrepresent algorithm reliability (Henderson et al., 2018).
            </Hypo>
          </Sub>
        </Section>

        {/* Results */}
        <Section id="results" number="2" title="Results">
          <Sub title="Learning dynamics">
            <P>
              Figure 1 presents learning curves (mean ± 1 SE across five seeds) for both training budgets
              alongside the human baseline. Both trajectories share a cold-start phase: mean return is −21.0
              for the first 200,000–400,000 timesteps, indicating no policy improvement. Around step 500,000,
              performance rises sharply. At 800,000 timesteps — approximately 80% into the shorter budget —
              the mean first exceeds the human baseline mean of −15.73, directly answering{' '}
              <span className="font-semibold text-white">RQ1</span>: PPO surpasses novice human performance at
              roughly <span className="font-semibold text-blue-400">~800k training steps</span>, well within a
              1M-step budget.
            </P>
            <P>
              The 5M trajectory continues improving after the 1M run terminates: crossing zero return at ~1.4M
              steps, reaching 100% win rate by 3.6M steps, and stabilizing at +15.61 at 5M steps. The
              characteristic two-phase structure — rapid acquisition of game mechanics (500k–1.5M) followed by
              gradual refinement — is consistent across all five seeds.
            </P>
          </Sub>

          <Fig
            src="/figures/learning_curves.png"
            caption="Figure 1. PPO learning curves (mean ± 1 SE across 5 seeds) for 1M and 5M budgets."
            note="Orange dashed line marks the novice human baseline mean (−15.73). Both budgets share early dynamics up to 1M steps; the 5M curve continues to near-perfect performance."
          />

          <Sub title="Final performance and human comparison">
            <P>
              Table 1 summarizes final agent performance for both budgets alongside the measured human baseline,
              with bootstrap 95% confidence intervals.
            </P>
          </Sub>

          <PaperTable caption="Table 1. Final performance: PPO agent vs. novice human baseline (bootstrap 95% CIs, 10,000 resamples).">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Condition</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">n</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">Mean Return</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">SE</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">95% CI</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2.5 text-zinc-400 font-mono">Human baseline</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">90 ep.</td>
                  <td className="px-4 py-2.5 text-right text-white font-mono">−15.73</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">0.35</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">[−16.40, −15.06]</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">0%</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2.5 text-blue-400 font-mono">PPO — 1M steps</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">5 seeds</td>
                  <td className="px-4 py-2.5 text-right text-white font-mono">−8.46</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">1.18</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">[−10.78, −6.58]</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">10%</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-emerald-400 font-mono">PPO — 5M steps</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">5 seeds</td>
                  <td className="px-4 py-2.5 text-right text-white font-mono">+15.61</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">0.66</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">[+14.33, +16.62]</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </PaperTable>

          <div className="space-y-2">
            <P><ResultBadge label="H1 confirmed.">The 95% bootstrap CI for agent−human at 1M is [+4.98, +9.27], entirely excluding zero. At 5M, the difference is +31.34 (CI: [+29.94, +32.57]). PPO significantly exceeds the novice human baseline at both budgets.</ResultBadge></P>
            <P><ResultBadge label="H2 confirmed.">At 1M steps, per-seed returns span [−12.35, −6.20] with σ = 2.64 — a cherry-picked best run would appear ~50% better than the worst. At 5M steps, variance shrinks (σ = 1.47, range [+13.25, +17.00]), but differences remain non-trivial for compute-constrained decisions.</ResultBadge></P>
          </div>

          <Sub title="Seed-level variance">
            <P>
              Figure 2 shows per-seed final returns for both budgets. All five 5M seeds individually exceed
              the entire human distribution. All five 1M seeds individually exceed the human mean.
            </P>
          </Sub>

          <Fig
            src="/figures/seed_variance.png"
            caption="Figure 2. Per-seed final returns for 1M (blue) and 5M (green) budgets."
            note="Orange dashed line marks the novice human mean. All five 5M seeds exceed the human distribution; 1M seeds exceed the human mean but show greater spread."
          />
        </Section>

        {/* Discussion */}
        <Section id="discussion" number="3" title="Discussion">
          <Sub title="Interpretation">
            <P>
              The most striking finding is the speed of human-level surpassing: approximately 800,000
              timesteps, corresponding to under two hours of wall-clock training on consumer hardware with
              GPU acceleration. This suggests that the bar set by novice players on Pong is relatively low,
              and PPO's steep early learning curve is sufficient to clear it within a single training run.
              The cold-start plateau (steps 1–400k) reflects the well-known reward sparsity problem in Atari:
              the agent must first discover that scoring is possible before systematic improvement can begin.
            </P>
            <P>
              At 5M steps, the 100% win rate across all seeds indicates the agent has effectively solved Pong
              at the difficulty level presented by the built-in ROM opponent. Remaining episodic variation
              (+13 to +17) reflects game stochasticity, not policy uncertainty.
            </P>
          </Sub>

          <Sub title="Implications and recommendations">
            <P>
              For practitioners, the results support a clear decision framework: a 1M-step PPO run is
              low-risk for reaching above-human novice performance on Pong, while a 5M run achieves
              near-perfect play with high reliability. The seed-stability improvement from 1M to 5M
              (σ: 2.64 → 1.47) suggests that additional compute not only raises the mean but also
              reduces the risk of a poor outcome from unlucky initialization. We recommend running at
              minimum 3–5 seeds before reporting results, as single-run estimates carry substantial
              uncertainty even in a relatively easy environment.
            </P>
          </Sub>

          <Sub title="Ethical considerations">
            <P>
              While technically benign, this study touches on considerations relevant to RL benchmarking
              more broadly. Human-AI comparisons carry implicit claims about substitutability: framing an
              agent as "superhuman" after comparing it to novice players under non-representative conditions
              (unfamiliar controls, time pressure, no practice) is misleading for public communication.
              Our study deliberately limits its claims to the novice framing. Additionally, the agent's
              mastery of a fixed-dynamics simulator does not imply general intelligence — a distinction that
              matters when communicating RL results to non-technical audiences or policymakers.
            </P>
          </Sub>

          <Sub title="Limitations">
            <P>
              The human participants are novice players; a baseline including experienced players would set a
              higher bar. Pong is one of the easier Atari games for deep RL — identical budgets on games such
              as Montezuma's Revenge would yield very different results. The agent is trained against a fixed,
              deterministic ROM opponent; its policy may not generalize to adaptive opponents. Wall-clock
              training time was not systematically recorded, limiting reproducibility for time-constrained
              practitioners.
            </P>
          </Sub>

          <Sub title="Future directions">
            <P>
              Natural extensions include: (1) testing the same pipeline on harder Atari games to characterize
              how the human-surpassing threshold varies with game complexity; (2) collecting an experienced
              human baseline; (3) comparing PPO against DQN and A3C under identical budgets and the same
              human baseline to isolate algorithmic differences from evaluation differences; (4) investigating
              whether the ~800k crossover is robust to hyperparameter changes.
            </P>
          </Sub>
        </Section>

        {/* Methods */}
        <Section id="methods" number="4" title="Methods">
          <Sub title="Environment and preprocessing">
            <P>
              All experiments use <span className="font-mono text-zinc-200">ALE/Pong-v5</span> via Gymnasium
              1.0.0 and ale-py 0.10.1. Standard Atari preprocessing: grayscale conversion, resize to 84×84
              pixels, 4-frame stack, reward clipping to [−1, +1] during training. Eight parallel environments
              are used throughout training.
            </P>
          </Sub>

          <Sub title="Algorithm">
            <P>
              Proximal Policy Optimization (Schulman et al., 2017) implemented in Stable-Baselines3 2.4.1.
              Hyperparameters follow Stable-Baselines3 Atari defaults: n_steps = 128, n_epochs = 4,
              batch_size = 256, clip_range ε = 0.1, learning_rate α = 2.5 × 10⁻⁴, γ = 0.99, λ_GAE = 0.95,
              ent_coef = 0.01, vf_coef = 0.5, max_grad_norm = 0.5. No tuning was performed.
            </P>
          </Sub>

          <Sub title="Experimental design">
            <P>
              Two budgets: 1,000,000 and 5,000,000 timesteps, each with five seeds {"{11, 22, 33, 44, 55}"},
              yielding 10 total runs. Every 100,000 timesteps, the policy was evaluated deterministically on
              20 episodes using fixed eval seeds {"{1000, …, 1019}"}. Primary metric: mean episodic return.
              Secondary metric: win rate (fraction of episodes with positive return).
            </P>
          </Sub>

          <Sub title="Human baseline">
            <P>
              Six IE University students (no prior Pong experience) each played 15 complete episodes against
              the built-in ROM opponent via the project web dashboard, yielding 90 total episodes.
              Episode return = (player points) − (opponent points) ∈ [−21, +21].
            </P>
          </Sub>

          <Sub title="Statistical analysis">
            <P>
              Agent performance: mean of seed-level final returns (n = 5) ± SE (σ/√n). Human performance:
              mean of all episode returns (n = 90) ± SE. Bootstrap 95% CIs computed for agent mean, human
              mean, and agent−human difference: 10,000 resamples, fixed RNG seed 12345. Success criterion
              pre-specified as: 5M agent mean exceeds human mean with a bootstrap CI for the difference
              entirely excluding zero.
            </P>
          </Sub>
        </Section>

        {/* Author Contributions */}
        <Section id="authors" number="5" title="Author Contributions">
          <PaperTable caption="Table 2. Final author contributions.">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  {['Name', 'Role', 'Contribution'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['José María Murillo', 'Project Lead', 'Overall coordination, PPO training pipeline, hyperparameter setup, final report editing'],
                  ['Hans Helmrich', 'RL Engineer', 'Environment setup (Gymnasium/Atari), frame preprocessing, reward logging, web dashboard'],
                  ['Beatriz Wahle', 'Data & Evaluation', 'Human baseline collection protocol, evaluation metrics, seed variance analysis'],
                  ['Valentín Miguel', 'Literature & Writing', 'Literature review, methods section writing, references management'],
                  ['Pablo Chen', 'Experiments & Analysis', 'Multi-seed experiment runs, learning curve visualization, statistical reporting'],
                  ['Nicolás Cubillo', 'Reproducibility & Code', 'Code documentation, reproducibility pipeline, appendix, AI usage statement'],
                ].map(([name, role, contrib]) => (
                  <tr key={name} className="border-b border-zinc-800/50">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{name}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{role}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{contrib}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaperTable>
        </Section>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-10" />
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-8">Appendix</p>

        {/* References */}
        <Section id="references" title="References">
          <div className="space-y-2.5 text-xs text-zinc-500 leading-relaxed font-mono">
            {[
              'Agarwal, R., Schwarzer, M., Castro, P. S., Courville, A. C., & Bellemare, M. (2021). Deep reinforcement learning at the edge of the statistical precipice. Advances in Neural Information Processing Systems, 34, 29304–29320.',
              'Bellemare, M. G., Naddaf, Y., Veness, J., & Bowling, M. (2013). The Arcade Learning Environment: An evaluation platform for general agents. Journal of Artificial Intelligence Research, 47, 253–279.',
              'Henderson, P., Islam, R., Bachman, P., Pineau, J., Precup, D., & Meger, D. (2018). Deep reinforcement learning that matters. Proceedings of the AAAI Conference on Artificial Intelligence, 32(1).',
              'Mnih, V., Kavukcuoglu, K., Silver, D., et al. (2015). Human-level control through deep reinforcement learning. Nature, 518(7540), 529–533.',
              'Raffin, A., Hill, A., Gleave, A., Kanervisto, A., Ernestus, M., & Dormann, N. (2021). Stable-Baselines3: Reliable reinforcement learning implementations. Journal of Machine Learning Research, 22(268), 1–8.',
              'Schulman, J., Wolski, F., Dhariwal, P., Radford, A., & Klimov, O. (2017). Proximal policy optimization algorithms. arXiv preprint arXiv:1707.06347.',
              'Silver, D., Huang, A., Maddison, C. J., et al. (2016). Mastering the game of Go with deep neural networks and tree search. Nature, 529(7587), 484–489.',
            ].map((ref, i) => (
              <p key={i} className="pl-4 -indent-4">{ref}</p>
            ))}
          </div>
        </Section>

        {/* Code availability */}
        <Section id="code" title="Code Availability Statement">
          <P>All code is available in the project repository. To reproduce:</P>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-3 space-y-2">
            <p className="text-xs text-zinc-500 font-medium">Environment setup</p>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto">{`python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
AutoROM --accept-license`}</pre>
            <p className="text-xs text-zinc-500 font-medium mt-3">Full 10-run experiment matrix</p>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto">{`python scripts/run_experiments.py \\
  --env-id ALE/Pong-v5 --budgets 1000000,5000000 \\
  --seeds 11,22,33,44,55 --eval-freq 100000 \\
  --n-eval-episodes 20 --n-envs 8 \\
  --output-root outputs --skip-if-complete`}</pre>
            <p className="text-xs text-zinc-500 font-medium mt-3">Regenerate all tables, figures, and statistics</p>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto">{`python scripts/analyze_results.py --output-root outputs \\
  --experiment-name ppo_pong \\
  --human-csv data/human_baseline/human_returns.csv`}</pre>
          </div>
          <P>
            Raw per-run CSV logs, model checkpoints, and runtime metadata (package versions, platform, git hash)
            are stored in <span className="font-mono text-zinc-200">outputs/ppo_pong/{'{budget}'}/seed_{'{seed}'}/ </span>.
            Training at full scale on Apple M3 with MPS acceleration takes approximately 8–10 hours per 5M-step seed.
          </P>
        </Section>

        {/* AI Usage */}
        <Section id="ai" title="AI Usage Statement">
          <P>
            This project used AI tooling (Claude Code, Anthropic) for code generation, documentation drafting,
            and implementation acceleration. All technical decisions, experimental design choices, and reported
            results were supervised and verified by the human authors. No experimental data were fabricated;
            all tables and figures are derived from actual executed training runs. Statistical analysis and
            result interpretation reflect the authors' own understanding of the methodology and findings.
          </P>
        </Section>

      </div>
    </div>
  );
}
