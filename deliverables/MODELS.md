# MODELS

Every model used, where it runs, and why — as required by the deliverables list.

| Model | Provider / Host | Runs where | Role | Cost profile |
|---|---|---|---|---|
| **`gemini-3.5-flash`** | Google (Gemini API) | External HTTPS call from the backend | **Primary** reasoning + drafting | Flash tier — a fraction of a cent per ticket (~300–600 in / ~200 out tokens). |
| **`gpt-4o`** | OpenAI | External HTTPS call from the backend | **Fallback** reasoning + drafting | Only invoked if Gemini fails/times out. |
| **Deterministic rules engine** | — (no model) | In-process, CPU only | Evidence matching, routing, severity, escalation, safety repair | **Free**, sub-millisecond. Solves all 10 public samples alone. |

## Why these choices

- **Flash-tier primary.** The task is latency-sensitive (p95 ≤ 5 s for full
  credit) and cost-sensitive (we pay). A flash model is the right tier: fast,
  cheap, and strong enough for classification + short Bangla/English drafting.
- **Cross-provider fallback.** Gemini and OpenAI are independent. If one has an
  outage or rate-limits during judging, the other answers. If both fail, the
  deterministic engine answers. There is no single point of failure.
- **No local LLM / no GPU.** The rubric forbids GPU and multi-GB weights for the
  preliminary; external APIs + rules are the correct fit and keep the image small.

## Configuration

All model ids and behaviour are environment-driven (`backend/app/config.py`):

| Var | Default | Meaning |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash` | Primary model id. |
| `OPENAI_MODEL` | `gpt-4o` | Fallback model id. |
| `USE_LLM` | `true` | `false` ⇒ pure deterministic (zero cost, zero network). |
| `LLM_TIMEOUT_SECONDS` | `12` | Hard per-call timeout before fallback. |

## Validation & the thinking-model tweak

The supplied Gemini key (newer `AQ.` format) and the `gemini-3.5-flash` model
were **validated live** — the API returns `200` and valid output. Because
`gemini-3.5-flash` is a *thinking* model, the client sets
`generationConfig.thinkingConfig.thinkingBudget = 0`, which keeps responses fast
(~1–2 s, measured) and reduces cost, without losing classification quality for
this structured task.

The key is sent via both `?key=` and the `x-goog-api-key` header for
compatibility. If Gemini is ever slow or unavailable, the service transparently
falls back to OpenAI `gpt-4o` (also validated live) and then to the deterministic
engine — so no model/key/latency issue ever produces a failed request.
