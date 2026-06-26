"""Agent orchestrator — the planner that runs the investigation pipeline.

Pipeline (each step is an "agent" with a single responsibility):

  1. Evidence agent   — deterministic transaction matching + verdict (tool layer)
  2. Reasoning agent  — one LLM pass (Gemini → OpenAI) for language + nuance
  3. Reconciler       — merge LLM + deterministic; routing/severity/escalation
                        are ALWAYS derived deterministically (policy-correct)
  4. Safety agent     — reflection step: audit + repair the customer-facing text
  5. Schema agent     — Pydantic validation guarantees the exact output contract

Routing, severity, escalation and safety never depend on the LLM, so the worst
case (LLM down) still yields a correct, safe, schema-valid answer fast.
"""
from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from typing import Any, Optional

from ..llm import reason_with_llm
from ..schemas import (
    AnalyzeTicketRequest,
    CaseType,
    EvidenceVerdict,
)
from . import evidence as ev
from . import reply as rp
from . import safety

# Cost-aware cache: identical complaints (ignoring ticket_id) reuse the prior
# analysis instead of paying for another LLM call. Bounded LRU, process-local.
_CACHE: "OrderedDict[str, tuple[dict[str, Any], str]]" = OrderedDict()
_CACHE_MAX = 256


def _cache_key(req: AnalyzeTicketRequest) -> str:
    payload = {
        "complaint": req.complaint,
        "language": req.language,
        "channel": req.channel,
        "user_type": req.user_type,
        "transaction_history": [t.model_dump() for t in (req.transaction_history or [])],
    }
    blob = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _valid_txn_id(rid: Optional[str], req: AnalyzeTicketRequest) -> Optional[str]:
    if rid is None:
        return None
    ids = {t.transaction_id for t in (req.transaction_history or []) if t.transaction_id}
    return rid if rid in ids else None


async def analyze(req: AnalyzeTicketRequest) -> tuple[dict[str, Any], str]:
    """Run the full pipeline. Returns (response_dict, provider_label)."""
    txns = req.transaction_history or []

    # ── 0. Cache lookup (cost-aware) ─────────────────────────────────────
    key = _cache_key(req)
    cached = _CACHE.get(key)
    if cached is not None:
        _CACHE.move_to_end(key)
        resp, provider = cached
        return {**resp, "ticket_id": req.ticket_id}, f"{provider}+cache"

    # ── 1. Evidence agent (deterministic baseline) ───────────────────────
    base = ev.analyze_evidence(req)

    # ── 2. Reasoning agent (LLM, optional) ───────────────────────────────
    llm, provider = await reason_with_llm(req, base)
    llm = llm or {}

    # ── 3. Reconciler ────────────────────────────────────────────────────
    # case_type: trust LLM unless deterministic flagged phishing (safety wins).
    final_case = base.case_type
    if base.case_type != CaseType.phishing_or_social_engineering and llm.get("case_type"):
        try:
            final_case = CaseType(llm["case_type"])
        except ValueError:
            final_case = base.case_type

    # If the case_type changed, recompute the evidence basis for coherence.
    if final_case != base.case_type and final_case != CaseType.phishing_or_social_engineering:
        rid, verdict, codes, conf, amount = ev.match_transaction(req, txns, final_case)
    else:
        rid = base.relevant_transaction_id
        verdict = base.evidence_verdict
        codes = list(base.reason_codes)
        conf = base.confidence
        amount = base.matched_amount

    # Let the LLM refine relevant_transaction_id / verdict only with valid values.
    llm_rid = _valid_txn_id(llm.get("relevant_transaction_id"), req)
    if "relevant_transaction_id" in llm and final_case != CaseType.phishing_or_social_engineering:
        # Keep deterministic "inconsistent/ambiguous→null" decisions; otherwise honour LLM.
        if base.evidence_verdict != EvidenceVerdict.inconsistent:
            rid = llm_rid
    if llm.get("evidence_verdict") and base.evidence_verdict != EvidenceVerdict.inconsistent:
        try:
            verdict = EvidenceVerdict(llm["evidence_verdict"])
        except ValueError:
            pass

    # Routing / severity / escalation — ALWAYS deterministic policy.
    department = ev.DEPARTMENT_BY_CASE[final_case]
    severity = ev.derive_severity(final_case, verdict, rid, amount)
    human_review = ev.derive_human_review(final_case, verdict, severity, rid)

    # ── 4. Text fields: prefer LLM prose, fall back to safe templates ────
    lang = rp.detect_language(req.complaint, req.language)
    agent_summary = llm.get("agent_summary") or rp.build_summary(final_case, rid, amount, verdict)
    next_action = llm.get("recommended_next_action") or rp.build_next_action(final_case, rid, verdict)
    customer_reply = llm.get("customer_reply") or rp.build_reply(final_case, rid, lang, verdict)

    # ── 4b. Safety agent (reflection: audit + repair) ────────────────────
    reply_result = safety.sanitize_reply(customer_reply, lang)
    action_result = safety.sanitize_action(next_action)
    safety_flags = reply_result.violations + action_result.violations

    # ── reason codes + confidence ────────────────────────────────────────
    reason_codes: list[str] = []
    for c in (llm.get("reason_codes") or []) + codes:
        if c and c not in reason_codes:
            reason_codes.append(c)
    if not reason_codes:
        reason_codes = [final_case.value]
    confidence = llm.get("confidence", conf)

    # ── 5. Assemble (Pydantic validates in the route handler) ────────────
    response = {
        "ticket_id": req.ticket_id,
        "relevant_transaction_id": rid,
        "evidence_verdict": verdict.value,
        "case_type": final_case.value,
        "severity": severity.value,
        "department": department.value,
        "agent_summary": agent_summary.strip(),
        "recommended_next_action": action_result.text,
        "customer_reply": reply_result.text,
        "human_review_required": human_review,
        "confidence": round(float(confidence), 2),
        "reason_codes": reason_codes[:6],
    }
    if safety_flags:
        provider = f"{provider}+safety_repaired"

    # ── store in cache (keyed without ticket_id) ─────────────────────────
    _CACHE[key] = ({**response, "ticket_id": "__cached__"}, provider)
    _CACHE.move_to_end(key)
    while len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)

    return response, provider
