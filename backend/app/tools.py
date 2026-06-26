"""Agent tools.

Each function here is a discrete, JSON-in/JSON-out capability the agent can
invoke. The SAME functions are exposed to external MCP clients by
`mcp_server/server.py`, so "the agent's tools" and "the MCP tools" are literally
one implementation. This is the tool-use + MCP agentic feature.
"""
from __future__ import annotations

from typing import Any, Optional

from .agents import evidence as ev
from .agents import safety
from .schemas import AnalyzeTicketRequest, TransactionEntry


def _to_entries(history: list[dict[str, Any]] | None) -> list[TransactionEntry]:
    return [TransactionEntry(**t) for t in (history or [])]


def lookup_transactions(
    transaction_history: list[dict[str, Any]] | None,
    amount: Optional[float] = None,
    txn_type: Optional[str] = None,
    status: Optional[str] = None,
) -> dict[str, Any]:
    """Filter a transaction history by amount / type / status."""
    txns = _to_entries(transaction_history)
    out = []
    for t in txns:
        if amount is not None and (t.amount is None or abs(float(t.amount) - amount) > 0.01):
            continue
        if txn_type and (t.type or "").lower() != txn_type.lower():
            continue
        if status and (t.status or "").lower() != status.lower():
            continue
        out.append(t.model_dump())
    return {"count": len(out), "transactions": out}


def match_transaction(complaint: str, transaction_history: list[dict[str, Any]] | None,
                      case_type: Optional[str] = None) -> dict[str, Any]:
    """Identify the transaction a complaint refers to and the evidence verdict."""
    req = AnalyzeTicketRequest(ticket_id="tool", complaint=complaint,
                               transaction_history=_to_entries(transaction_history))
    txns = req.transaction_history or []
    ct, _codes = ev.detect_case_type(req, txns)
    if case_type:
        try:
            ct = ev.CaseType(case_type)
        except ValueError:
            pass
    rid, verdict, codes, conf, amount = ev.match_transaction(req, txns, ct)
    return {
        "case_type": ct.value,
        "relevant_transaction_id": rid,
        "evidence_verdict": verdict.value,
        "matched_amount": amount,
        "confidence": conf,
        "reason_codes": codes,
    }


def classify_case(complaint: str, transaction_history: list[dict[str, Any]] | None = None,
                  user_type: Optional[str] = None) -> dict[str, Any]:
    """Full deterministic classification (case_type, severity, department, etc.)."""
    req = AnalyzeTicketRequest(ticket_id="tool", complaint=complaint, user_type=user_type,
                               transaction_history=_to_entries(transaction_history))
    a = ev.analyze_evidence(req)
    return {
        "case_type": a.case_type.value,
        "relevant_transaction_id": a.relevant_transaction_id,
        "evidence_verdict": a.evidence_verdict.value,
        "severity": a.severity.value,
        "department": a.department.value,
        "human_review_required": a.human_review_required,
        "confidence": a.confidence,
        "reason_codes": a.reason_codes,
    }


def check_safety(text: str, language: str = "en") -> dict[str, Any]:
    """Audit text for the three safety penalties without modifying it."""
    violations = safety.audit_only(text)
    return {"safe": len(violations) == 0, "violations": violations}


# Tool catalogue (name → callable + JSON schema) used by the MCP server.
TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "lookup_transactions",
        "description": "Filter a customer's transaction history by amount, type, or status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transaction_history": {"type": "array", "items": {"type": "object"}},
                "amount": {"type": "number"},
                "txn_type": {"type": "string"},
                "status": {"type": "string"},
            },
            "required": ["transaction_history"],
        },
    },
    {
        "name": "match_transaction",
        "description": "Identify which transaction a complaint refers to and the evidence verdict.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "complaint": {"type": "string"},
                "transaction_history": {"type": "array", "items": {"type": "object"}},
                "case_type": {"type": "string"},
            },
            "required": ["complaint", "transaction_history"],
        },
    },
    {
        "name": "classify_case",
        "description": "Classify a complaint into case_type, severity, department and escalation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "complaint": {"type": "string"},
                "transaction_history": {"type": "array", "items": {"type": "object"}},
                "user_type": {"type": "string"},
            },
            "required": ["complaint"],
        },
    },
    {
        "name": "check_safety",
        "description": "Audit a reply for credential requests, unauthorized promises, or third-party redirection.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "language": {"type": "string"},
            },
            "required": ["text"],
        },
    },
]

TOOL_IMPL = {
    "lookup_transactions": lookup_transactions,
    "match_transaction": match_transaction,
    "classify_case": classify_case,
    "check_safety": check_safety,
}
