# 00 — Master Plan & "What we did while planning"

This is the document to read first. It explains **how we approached the
problem**, **why the architecture looks the way it does**, and **what every
moving part is for** — so you can defend the solution to a judge and understand
it end to end.

---

## A. How to read the problem (what the rubric actually rewards)

The single most important insight: **the judge scores only two endpoints**,
`GET /health` and `POST /analyze-ticket`. The fancy UI is explicitly *not*
judged. So we spent our effort where the points are:

| Category | Weight | What we did about it |
|---|---:|---|
| Evidence Reasoning | **35** | A deterministic engine that identifies the right transaction + verdict, reproducing all 10 public samples, refined by an LLM. |
| Safety & Escalation | **20** | A deterministic guardrail that *repairs* unsafe text after the LLM, so the three penalties can't land. |
| API Contract & Schema | **15** | Pydantic enums — wrong enum values are literally impossible to emit. Precise 200/400/422/500 codes. |
| Performance & Reliability | **10** | Deterministic-first, hard LLM timeout, total fallback, response cache. Never 5xx, never stall. |
| Response Quality | 10 | LLM prose + safe templates; Bangla replies for Bangla input. |
| Deployment & Repro | 5 | One-command VM deploy + Docker image + runbook. |
| Documentation | 5 | This deliverables folder. |

**Priority order we followed** (straight from the rubric's "How to Prioritize"):
schema first → evidence reasoning → safety → reliability → docs.

---

## B. The "investigator twist" and how we solve it

The complaint says one thing; the transaction data may say another. Two fields
encode the reasoning: `relevant_transaction_id` and `evidence_verdict`.

Our deterministic engine encodes explainable rules distilled from the 10
samples, e.g.:

- **Match by amount** (handles `5,000` and Bangla `৫০০০`), then by transaction
  type relevant to the case, then by recency.
- **Established-recipient contradiction:** "I sent it to the wrong person" but
  the history shows repeated transfers to that same number ⇒ `inconsistent`.
- **Duplicate detection:** two identical payments to the same biller seconds
  apart ⇒ `duplicate_payment`, and the *second* one is the suspected duplicate.
- **Ambiguity honesty:** several equally-plausible transactions ⇒
  `insufficient_data` with `relevant_transaction_id = null` (we don't guess).
- **Safety reports:** phishing ⇒ `critical`, `fraud_risk`, `human_review`,
  `relevant_transaction_id = null` (it's about a threat, not a ledger entry).

These rules alone score the 10 samples 10/10. The LLM then improves wording and
catches phrasing the rules miss — but it can never override routing/severity/
safety, which stay deterministic.

---

## C. Architecture in one picture

```
            ┌──────────────── POST /analyze-ticket ────────────────┐
            │                                                       │
  request ──▶ [0] cache ─▶ [1] Evidence agent (rules, no network)   │
            │                     │                                 │
            │              [2] Reasoning agent ── Gemini ─▶ OpenAI ─▶│ (fallback)
            │                     │                                 │
            │              [3] Reconciler (routing/severity = rules)│
            │                     │                                 │
            │              [4] Safety agent (audit + REPAIR)        │
            │                     │                                 │
            │              [5] Schema agent (Pydantic enums)        │
            │                     │                                 │
  response ◀─────────────── 200 JSON ◀── [memory/anomaly store] ────┘
```

Everything except step [2] is deterministic and offline. That is the whole
reliability story.

---

## D. The agentic / MCP requirement (you asked for "4–5 agentic features")

We implemented **five** (full detail in `AGENTIC_AI.md`):

1. **Tool use** — discrete tools (`lookup_transactions`, `match_transaction`,
   `classify_case`, `check_safety`) the agent invokes.
2. **MCP server** — the *same* tools exposed over the Model Context Protocol
   (`backend/mcp_server/server.py`) so any MCP client (Claude Desktop, IDE
   agents) can drive the investigator.
3. **Planner / orchestrator** — a multi-step pipeline with provider fallback.
4. **Reflection** — the safety agent re-examines and repairs the draft reply.
5. **Episodic memory + anomaly detection** — a store that remembers cases and
   flags phishing surges / critical load / volume spikes across tickets.

---

## E. Decisions you (the human) made, recorded

- **Deploy:** GCP **e2-micro** + **nginx**, brought up by `sudo python3
  deploy/run_onVM.py`. Domain **akash.2haas.com** with Let's Encrypt HTTPS.
- **Model:** default `gemini-3.5-flash` (env-overridable) + `gpt-4o` fallback.
- **Agent depth:** hybrid (deterministic core + 1 LLM pass) for latency/safety.

> ⚠️ **e2-micro has 1 GB RAM.** The deploy script adds 2 GB swap automatically so
> the Vite/three.js build doesn't OOM. The backend image is ~150–200 MB.

---

## F. What to do next (your checklist)

1. **Read** `TEACHING_GUIDE.md` (how it all works, in plain English) and
   `DELIVERABLES_CHECKLIST.md` (every required item ✔ and where it lives).
2. **Create the GitHub repo** and push (already wired to `MdAhbab/akash`).
3. **Point DNS:** add an `A` record `akash.2haas.com → <your VM public IP>`.
4. **Deploy:** `git clone` on the VM, scp your `.env` (real keys) next to it,
   then `sudo python3 deploy/run_onVM.py`.
5. **Verify** `https://akash.2haas.com/health` from your laptop.
6. **Fill the submission form** using `SUBMISSION_FORM_ANSWERS.md`.
7. (Optional) record the ≤90 s architecture video using the script in
   `TEACHING_GUIDE.md`.
