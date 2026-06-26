# Deliverables - index

Everything a judge (or you) needs, in reading order.

| # | Document | What it covers |
|---|---|---|
| 00 | [00_PLAN.md](00_PLAN.md) | **Start here.** Master plan, how we read the rubric, what every part is for, your next-steps checklist. |
| - | [../README.md](../README.md) | The canonical project README (setup, MODELS, AI approach, safety, cost, limitations). |
| 1 | [ARCHITECTURE.md](ARCHITECTURE.md) | Request lifecycle, modules, failure modes, performance. |
| 2 | [AGENTIC_AI.md](AGENTIC_AI.md) | The 5 agentic features + the MCP server. |
| 3 | [SAFETY.md](SAFETY.md) | Safety guardrails, escalation, secret handling. |
| 4 | [MODELS.md](MODELS.md) | Every model, where it runs, why and cost. |
| 5 | [RUNBOOK.md](RUNBOOK.md) | Copy-paste run instructions (local / Docker / compose / VM). |
| 6 | [DELIVERABLES_CHECKLIST.md](DELIVERABLES_CHECKLIST.md) | Every required item ✔ mapped to where it lives. |
| 7 | [TEACHING_GUIDE.md](TEACHING_GUIDE.md) | Plain-English walkthrough + ≤90s video script. |
| 8 | [SUBMISSION_FORM_ANSWERS.md](SUBMISSION_FORM_ANSWERS.md) | Ready-to-paste submission form answers. |
| - | [sample_outputs/](sample_outputs/) | Generated outputs for the public sample cases. |

## Status snapshot

- ✅ `/health` and `/analyze-ticket` implemented and smoke-tested.
- ✅ **10/10** public sample cases match on the rubric-critical fields.
- ✅ All sample replies pass the safety audit; adversarial injection neutralized.
- ✅ Status codes 200/400/422/500 verified.
- ✅ Frontend builds; backend image is slim and CPU-only.
- ⏳ You: push to GitHub, point DNS, run `run_onVM.py`, fill the form, record video.
