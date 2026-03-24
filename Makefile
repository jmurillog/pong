.PHONY: setup train-matrix analyze human-template test watch progress-videos play-vs-ai

setup:
	python3 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt
	. .venv/bin/activate && python -m AutoROM --accept-license

train-matrix:
	python3 scripts/run_experiments.py --skip-if-complete

analyze:
	python3 scripts/analyze_results.py --output-root outputs --experiment-name ppo_pong --human-csv data/human_baseline/human_returns.csv

human-template:
	python3 scripts/collect_human_baseline.py make-template --output data/human_baseline/human_returns_template.csv

test:
	python3 -m pytest -q

watch:
	python3 scripts/watch_agent.py --model outputs/ppo_pong/5M_steps/seed_11/final_model.zip --env-id ALE/Pong-v5 --episodes 1 --render-mode human

progress-videos:
	python3 scripts/render_learning_progress.py --models-dir outputs/ppo_pong/5M_steps/seed_11/models --keep 6 --output-dir outputs/ppo_pong/5M_steps/seed_11/progress_videos

play-vs-ai:
	python3 scripts/play_vs_ai.py --model outputs/ppo_pong/5M_steps/seed_11/final_model.zip --env-id ALE/Pong-v5 --watch-ai
