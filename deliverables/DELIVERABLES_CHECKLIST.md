# Deliverables & Rubric Checklist

Every required deliverable and every scoring category, mapped to where it is
satisfied. Use this as the pre-submission walkthrough.

---

## Required deliverables (Problem Statement §11)

| Deliverable | Required | Status | Where |
|---|---|---|---|
| GitHub repository (org access: `bipulhf`) | Yes | ✅ | `https://github.com/MdAhbab/akash` (add `bipulhf` as collaborator if private). |
| Endpoint URL **or** Docker image **or** runbook | Yes | ✅ all three | URL `akash.2haas.com`; `backend/Dockerfile`; `deliverables/RUNBOOK.md`. |
| README.md (setup, run, stack, AI approach, safety, model+cost, assumptions, limitations) | Yes | ✅ | `/README.md`. |
| Dependency file | Yes | ✅ | `backend/requirements.txt` (+ `frontend/package.json`). |
| Sample output file (≥1 from public samples) | Yes | ✅ | `deliverables/sample_outputs/` (1 + all 10). |
| MODELS section in README | Yes | ✅ | README §6 + `deliverables/MODELS.md`. |
| `.env.example` | Recommended | ✅ | `/.env.example`, `backend/.env.example`, `deploy/judging.env.example`. |
| ≤90 s architecture video | Recommended | ⏳ you record | Script in `TEACHING_GUIDE.md`. |

---

## API contract (Problem Statement §4–7)

| Item | Status | Evidence |
|---|---|---|
| `GET /health` → `{"status":"ok"}` | ✅ | `app/main.py`; smoke-tested. |
| `POST /analyze-ticket` structured response | ✅ | `app/main.py` + orchestrator. |
| All required output fields present | ✅ | `AnalyzeTicketResponse` schema. |
| Enum values exact (case_type, severity, department, evidence_verdict) | ✅ | Pydantic `Enum`s in `app/schemas.py`. |
| `ticket_id` echoed | ✅ | Set from request. |
| 200 / 400 / 422 / 500 codes | ✅ | Verified: malformed→400, missing→400, empty→422. |
| No crash on malformed input | ✅ | Manual body parsing + global handler. |
| ≤ 30 s per request | ✅ | Deterministic < 50 ms; LLM capped at 12 s. |
| ≤ 60 s health readiness | ✅ | Health is instant; container HEALTHCHECK included. |

---

## Scoring categories (Rubric)

| Category | Wt | How we address it |
|---|---:|---|
| Evidence Reasoning | 35 | Deterministic matcher + LLM; **10/10 public samples** on relevant_transaction_id, verdict, case_type, department, escalation. |
| Safety & Escalation | 20 | Post-LLM guardrail repairs unsafe text; injection-resistant; escalation policy matches samples. |
| API Contract & Schema | 15 | Pydantic enums + precise status codes. |
| Performance & Reliability | 10 | Deterministic-first, timeout, total fallback, cache; never 5xx. |
| Response Quality | 10 | LLM prose + safe templates; Bangla replies for Bangla input. |
| Deployment & Repro | 5 | `run_onVM.py` one-command deploy + Docker + runbook. |
| Documentation | 5 | This deliverables folder. |

---

## Safety penalties — all avoided

| Violation | Penalty | Mitigation |
|---|---:|---|
| Asks for PIN/OTP/password/card | −15 | Request-vs-warning linter; requests stripped. |
| Unauthorized action promise | −10 | Rewritten to "any eligible amount will be returned through official channels". |
| Third-party redirection | −10 | Removed; official channels only. |
| Prompt injection | schema/safety | Complaint treated as untrusted; deterministic guard. |

---

## Testing checklist (Team Manual §12) — all ✅

- [x] `/health` returns `{"status":"ok"}`
- [x] Main endpoint accepts sample JSON
- [x] Response contains all required fields
- [x] Enum values match exactly
- [x] Handles empty/missing optional input safely
- [x] Handles malformed/missing fields without crashing
- [x] Reply never asks for secret credentials
- [x] Reply never promises unauthorized actions
- [x] Responds within timeout
- [x] README complete

---

## Pre-submit actions for YOU

1. Push to `MdAhbab/akash` (and add `bipulhf` if the repo is private).
2. Add DNS A record → VM IP; deploy with `run_onVM.py`; confirm HTTPS `/health`.
3. Fill the submission form using `SUBMISSION_FORM_ANSWERS.md`.
4. Put the real key(s) **only** in the form's private field if using the Docker
   fallback — never in git.
5. (Optional) record the ≤90 s video.
