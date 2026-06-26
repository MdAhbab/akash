"""Extended (non-judged) endpoints that power the demo dashboard UI.

The hackathon judge only calls /health and /analyze-ticket. These extra routes
let the included React console / sentinel / insights pages run on REAL data
produced by the analyzer. They are pure reads over the in-memory store plus a
demo-friendly /sort-ticket alias.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Query

from .schemas import AnalyzeTicketRequest
from .store import store

router = APIRouter()


def _adapt_sort_body(body: dict[str, Any]) -> AnalyzeTicketRequest:
    """Map the UI's {message, locale, channel, transaction_history} shape onto
    the canonical analyze-ticket request."""
    complaint = body.get("complaint") or body.get("message") or ""
    language = body.get("language") or body.get("locale")
    channel = body.get("channel")
    # The UI uses 'app'/'sms' shorthands; map to the official channel enum-ish.
    channel_map = {"app": "in_app_chat", "sms": "in_app_chat"}
    if channel in channel_map:
        channel = channel_map[channel]
    return AnalyzeTicketRequest(
        ticket_id=body.get("ticket_id") or "T-DEMO",
        complaint=complaint,
        language=language,
        channel=channel,
        user_type=body.get("user_type"),
        campaign_context=body.get("campaign_context"),
        transaction_history=body.get("transaction_history"),
        metadata=body.get("metadata"),
    )


@router.get("/tickets")
def list_tickets(
    case_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
) -> dict[str, Any]:
    return {"tickets": store.list(case_type, severity, department, limit)}


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str) -> dict[str, Any]:
    item = store.get(ticket_id)
    if not item:
        raise HTTPException(404, "Ticket not found.")
    return item


@router.post("/tickets/{ticket_id}/reply")
def regenerate_reply(ticket_id: str) -> dict[str, Any]:
    item = store.get(ticket_id)
    if not item:
        raise HTTPException(404, "Ticket not found.")
    return {"ticket_id": ticket_id, "customer_reply": item.get("customer_reply")}


@router.get("/stats")
def stats() -> dict[str, Any]:
    return store.stats()


@router.get("/reviews")
def reviews() -> dict[str, Any]:
    return {"reviews": store.reviews()}


@router.post("/reviews/{ticket_id}/status")
def set_review_status(ticket_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    status = (payload or {}).get("status", "resolved")
    if not store.set_review_status(ticket_id, status):
        raise HTTPException(404, "Ticket not found.")
    return {"ticket_id": ticket_id, "status": status}


@router.get("/insights/summary")
def insights_summary() -> dict[str, Any]:
    s = store.stats()
    anomalies = store.anomalies()
    total = s["total"]
    if total == 0:
        narrative = "No tickets analyzed yet. Run a few through the Playground to see trends."
    else:
        top_case = s["byCase"][0]["key"] if s["byCase"] else "—"
        narrative = (
            f"{total} tickets analyzed. The most common case type is "
            f"'{top_case.replace('_', ' ')}', with {s['flagged']} flagged for review "
            f"and average latency of {s['latency']['avg']} ms."
        )
    return {"stats": s, "narrative": narrative, "anomalies": anomalies, "window": "last 1000 tickets"}
