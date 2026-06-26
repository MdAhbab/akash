# Agentic AI Features & MCP

The copilot is built as a small **multi-agent system** with five agentic
capabilities. This document maps each to the code so it's verifiable.

---

## 1. Tool use (function-style capabilities)

The agent reasons by invoking discrete, typed tools rather than one monolithic
prompt. Defined in `backend/app/tools.py`:

| Tool | Input | Output |
|---|---|---|
| `lookup_transactions` | history, amount?, type?, status? | filtered transactions |
| `match_transaction` | complaint, history, case_type? | relevant_transaction_id + verdict |
| `classify_case` | complaint, history, user_type? | case_type, severity, department, escalation |
| `check_safety` | text, language? | `{safe, violations[]}` |

These are pure JSON-in/JSON-out functions, so they are deterministic, testable,
and reusable.

---

## 2. MCP — Model Context Protocol server

The **same** tools are exposed to external agents over MCP in
`backend/mcp_server/server.py` (stdio transport). Any MCP-compatible client
(IDE agents, desktop assistants, custom orchestrators) can call them.

Run it:

```bash
cd backend
pip install -r requirements-mcp.txt
python -m mcp_server.server
```

Example MCP client config (`mcpServers` block):

```json
{
  "mcpServers": {
    "akash-investigator": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/absolute/path/to/backend"
    }
  }
}
```

Because the agent's in-process tools and the MCP tools are one implementation,
"the copilot's capabilities" are genuinely portable — that is the point of MCP.

---

## 3. Planner / orchestrator (multi-step plan with fallback)

`backend/app/agents/orchestrator.py` executes an explicit plan:
cache → evidence → reason (with provider fallback) → reconcile → safety →
schema. Each step is independent and the plan degrades gracefully (LLM optional).

---

## 4. Reflection (self-correction guardrail)

After drafting, the **safety agent** re-examines the customer-facing text and
**repairs** it — stripping credential requests, softening unauthorized promises,
removing third-party redirects, and guaranteeing the safety reminder. This is a
reflection loop: generate → critique → revise, before the response leaves the
service (`backend/app/agents/safety.py`).

---

## 5. Episodic memory + anomaly detection (cross-ticket retrieval)

`backend/app/store.py` remembers every analyzed case and computes patterns the
agent could not see from a single request: **phishing surges**, **critical
load**, and **volume spikes** in the last hour. These power the Sentinel /
Insights dashboards and demonstrate memory/retrieval beyond one prompt.

---

## How the LLM is used (and constrained)

- **One** structured-JSON call per ticket (Gemini → OpenAI fallback).
- The system prompt hard-codes the safety rules and instructs the model to treat
  the complaint as **untrusted data** (prompt-injection defense).
- The model may refine `case_type`, `relevant_transaction_id`, `evidence_verdict`
  and write the prose — but **routing, severity, escalation, and final safety are
  re-derived deterministically**, so the model cannot break the contract.

This is exactly the "hybrid rule + AI" design the Team Instructions Manual
recommends: deterministic logic for validation/safety, AI for language
understanding and drafting.
