# Architecture

## Request lifecycle

```
POST /analyze-ticket
  │
  ├─ parse body  ── invalid JSON ───────────────▶ 400
  │               ── missing ticket_id/complaint ▶ 400
  │               ── empty complaint ────────────▶ 422
  │
  ▼
orchestrator.analyze(req)
  ├─ [0] cache lookup            (sha256 of complaint+history; LRU 256)
  ├─ [1] evidence.analyze_evidence(req)        deterministic, offline
  ├─ [2] llm.reason_with_llm(req, base)        Gemini → OpenAI → None
  ├─ [3] reconcile               case_type from LLM (phishing locked);
  │                              routing/severity/escalation from rules
  ├─ [4] safety.sanitize_reply / sanitize_action   audit + repair
  └─ [5] AnalyzeTicketResponse(**out)          Pydantic enum validation
  │
  ├─ store.record(...)           episodic memory + dashboard + anomalies
  ▼
200 JSON
```

## Modules

| File | Responsibility |
|---|---|
| `app/main.py` | FastAPI app, endpoints, status-code policy, CORS, error handlers. |
| `app/schemas.py` | Request/response models + **all enums** (the schema contract). |
| `app/config.py` | Env-driven settings (keys, models, timeouts, `USE_LLM`). |
| `app/agents/evidence.py` | Deterministic matcher: amounts, counterparties, verdict, case_type, severity, department, escalation. |
| `app/llm.py` | Provider layer: Gemini primary, OpenAI fallback, strict JSON coercion, hard timeout. |
| `app/agents/orchestrator.py` | The planner: pipeline + reconciliation + cache. |
| `app/agents/reply.py` | Safe multilingual (en/bn) summaries, actions, replies. |
| `app/agents/safety.py` | Deterministic guardrail: detect **and repair** unsafe text. |
| `app/tools.py` | Agent tools (also exported to MCP). |
| `app/store.py` | In-memory store, stats, anomaly detection (fast path). |
| `app/db.py` | Optional MySQL **durability mirror** — best-effort writes + startup reload. Never in the request path. |
| `app/routes_dashboard.py` | Non-judged endpoints powering the UI. |
| `mcp_server/server.py` | MCP server exposing the tools over stdio. |

## Persistence model (memory + optional MySQL)

The in-memory store is the **authoritative, fast** path. When `DB_BACKEND=mysql`:

- on startup (FastAPI lifespan) the service loads the most recent rows from MySQL
  into the store, so the dashboard survives restarts;
- after each analysis, the ticket is written to MySQL via a **fire-and-forget
  background task** (`asyncio.create_task` → `asyncio.to_thread`), so the DB write
  is off the response path entirely.

If MySQL is unconfigured, unreachable, or the driver is missing, every connection
attempt fails fast (5 s timeouts) and is swallowed — the API behaves exactly as
in memory-only mode. **A database problem can never slow or fail a ticket.**

## Why deterministic-first

The rubric punishes timeouts and 5xx harshly (Performance & Reliability, and the
p95 latency tiers). A pure-LLM design risks both. By computing a complete, valid,
safe answer **without** the network and using the LLM only to *improve* it, the
service:

- responds in **milliseconds** when the LLM is disabled or down,
- never returns 5xx because of a provider error (any LLM exception → fallback),
- guarantees correct **routing/severity/safety** regardless of model output,
- is **cheap** (one capped LLM call, cached for repeats).

## Failure modes & responses

| Failure | Behaviour |
|---|---|
| Malformed JSON | 400, non-sensitive message. |
| Missing required field | 400. |
| Empty complaint | 422. |
| Gemini error/timeout | Silent fallback to OpenAI. |
| Both providers fail / total LLM budget exceeded | Deterministic answer (still valid + safe). |
| Unknown transaction enum value | Accepted as string, normalized; never crashes. |
| Malformed amount (`"5,000"`, `"N/A"`) | Coerced (or set to `null`); does not 400 the whole ticket. |
| MySQL down/unreachable | Best-effort write skipped; request unaffected. |
| Any unhandled exception | 500 with `{"detail":"Internal error."}` — no stack trace, no secrets. |

## Performance profile

- CPU/RAM: comfortably within 2 vCPU / 4 GB (runs on e2-micro 1 GB).
- Image size: ~150–200 MB (python:3.11-slim, no model weights).
- Latency: deterministic path < 50 ms; with one LLM call typically 1–3 s
  (Gemini flash), hard-capped at 12 s before falling back.
