# Streaming Server

FastAPI WebSocket server that loads trained PPO checkpoints and streams live Atari Pong gameplay to the Next.js frontend.

## Setup

```bash
# From the project root:
pip install -r server/requirements-server.txt
```

## Start

```bash
# From the project root:
uvicorn server.api_server:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:3000/watch-ai** in the frontend.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/checkpoints` | Lists all trained model checkpoints found in `outputs/` |
| `WebSocket /ws/watch?model_path=...&seed=42&fps=20&max_episodes=3` | Streams JPEG frames of AI gameplay |

## WebSocket protocol

**Server → client:**
```json
{"type": "frame", "frame": "<base64 JPEG>", "episode_return": -12.0, "episode": 1, "done": false}
{"type": "episode_end", "episode": 1, "final_return": -21.0}
{"type": "stream_end", "episodes_played": 3}
{"type": "error", "message": "..."}
```

**Client → server:**
```json
{"stop": true}
```
