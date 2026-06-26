# RUNBOOK — bring the service up from scratch

A stranger can copy-paste this to run QueueStorm. Three paths; pick one.

---

## Path A — Local (Python)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate      Linux/macOS:  source .venv/bin/activate
pip install -r requirements.txt

# Optional: enable LLMs (works without this too)
cp .env.example .env        # edit GEMINI_API_KEY / OPENAI_API_KEY

uvicorn app.main:app --host 0.0.0.0 --port 8787
```

Test:

```bash
curl http://localhost:8787/health
# -> {"status":"ok"}

curl -X POST http://localhost:8787/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"TKT-001","complaint":"I sent 5000 taka to a wrong number around 2pm","language":"en","transaction_history":[{"transaction_id":"TXN-9101","timestamp":"2026-04-14T14:08:22Z","type":"transfer","amount":5000,"counterparty":"+8801719876543","status":"completed"}]}'
```

---

## Path B — Docker (the judged image)

```bash
cd backend
docker build -t queuestorm-api .

# with keys:
docker run -p 8000:8000 -e PORT=8000 --env-file ../deploy/judging.env queuestorm-api
# without keys (deterministic mode, still valid + safe):
docker run -p 8000:8000 -e PORT=8000 -e USE_LLM=false queuestorm-api

curl http://localhost:8000/health
```

Image: `python:3.11-slim`, ~150–200 MB, binds `0.0.0.0`, non-root user,
built-in `HEALTHCHECK`.

---

## Path C — Full demo stack (API + UI)

```bash
cd deploy
docker compose --env-file ../.env up -d --build
# SPA:  http://localhost/        API:  http://localhost/health
```

---

## Path D — Production VM (one command)

See `DEPLOYMENT_GCP.md`. Short version on a fresh Debian/Ubuntu VM:

```bash
git clone https://github.com/MdAhbab/akash.git && cd akash
nano .env                       # paste real keys (or skip for deterministic mode)
sudo python3 deploy/run_onVM.py
```

---

## Run the tests

```bash
cd backend
python tests/test_samples.py     # expect: 10/10 sample cases match
# or with pytest:
pip install pytest && pytest -q
```

## Run the MCP server (optional)

```bash
cd backend
pip install -r requirements-mcp.txt
python -m mcp_server.server
```

---

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `PORT` | 8787 | Bind port. |
| `GEMINI_API_KEY` | — | Primary LLM key (optional). |
| `GEMINI_MODEL` | gemini-3.5-flash | Primary model id. |
| `OPENAI_API_KEY` | — | Fallback LLM key (optional). |
| `OPENAI_MODEL` | gpt-4o | Fallback model id. |
| `USE_LLM` | true | `false` ⇒ deterministic, no network. |
| `LLM_TIMEOUT_SECONDS` | 12 | Per-call hard timeout. |
