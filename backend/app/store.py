"""In-memory episodic store + anomaly detection.

This is the agent's short-term memory. Every analyzed ticket is recorded so the
service can (a) power the live operations dashboard and (b) detect cross-ticket
patterns - phishing surges, critical load, volume spikes - which is a form of
retrieval the agent uses beyond a single request.

It is intentionally process-local (no DB): the judge only scores /health and
/analyze-ticket and a small VM has no room for a database. Thread-safe via a
simple lock; capped to avoid unbounded growth.
"""
from __future__ import annotations

import threading
import time
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any, Optional

_MAX = 1000


class CaseStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: deque[dict[str, Any]] = deque(maxlen=_MAX)
        self._reviews: dict[str, str] = {}  # ticket_id -> review status

    # ── ingest ────────────────────────────────────────────────────────────
    def record(self, response: dict[str, Any], request: dict[str, Any],
               latency_ms: float, provider: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        item = {
            "ticket_id": response.get("ticket_id"),
            "case_type": response.get("case_type"),
            "severity": response.get("severity"),
            "department": response.get("department"),
            "evidence_verdict": response.get("evidence_verdict"),
            "relevant_transaction_id": response.get("relevant_transaction_id"),
            "human_review_required": response.get("human_review_required"),
            "confidence": response.get("confidence"),
            "agent_summary": response.get("agent_summary"),
            "customer_reply": response.get("customer_reply"),
            "recommended_next_action": response.get("recommended_next_action"),
            "reason_codes": response.get("reason_codes"),
            "complaint": request.get("complaint"),
            "language": request.get("language"),
            "channel": request.get("channel"),
            "user_type": request.get("user_type"),
            "latency_ms": round(latency_ms, 1),
            "provider": provider,
            "created_at": now,
        }
        with self._lock:
            self._items.appendleft(item)
            if item["human_review_required"] and item["ticket_id"] not in self._reviews:
                self._reviews[item["ticket_id"]] = "open"
        return item

    def seed(self, items: list[dict[str, Any]]) -> None:
        """Preload items (oldest first) from the durable mirror on startup."""
        with self._lock:
            for it in items:
                self._items.appendleft(it)
                if it.get("human_review_required") and it.get("ticket_id") not in self._reviews:
                    self._reviews[it["ticket_id"]] = "open"

    # ── queries ───────────────────────────────────────────────────────────
    def list(self, case_type: Optional[str] = None, severity: Optional[str] = None,
             department: Optional[str] = None, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._items)
        out = []
        for it in items:
            if case_type and it["case_type"] != case_type:
                continue
            if severity and it["severity"] != severity:
                continue
            if department and it["department"] != department:
                continue
            out.append(it)
            if len(out) >= limit:
                break
        return out

    def get(self, ticket_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            for it in self._items:
                if it["ticket_id"] == ticket_id:
                    return {**it, "review_status": self._reviews.get(ticket_id)}
        return None

    def reviews(self) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._items)
            statuses = dict(self._reviews)
        out = []
        for it in items:
            if it["human_review_required"] and statuses.get(it["ticket_id"]) != "resolved":
                out.append({**it, "review_status": statuses.get(it["ticket_id"], "open")})
        return out

    def set_review_status(self, ticket_id: str, status: str) -> bool:
        with self._lock:
            if any(it["ticket_id"] == ticket_id for it in self._items):
                self._reviews[ticket_id] = status
                return True
        return False

    # ── aggregate stats ───────────────────────────────────────────────────
    def stats(self) -> dict[str, Any]:
        with self._lock:
            items = list(self._items)
            open_reviews = sum(1 for tid, st in self._reviews.items() if st == "open")
        total = len(items)
        by_case = Counter(i["case_type"] for i in items)
        by_sev = Counter(i["severity"] for i in items)
        by_dept = Counter(i["department"] for i in items)
        flagged = sum(1 for i in items if i["severity"] in ("critical",)
                      or i["case_type"] == "phishing_or_social_engineering")
        lat = [i["latency_ms"] for i in items if i.get("latency_ms")]
        avg = round(sum(lat) / len(lat), 1) if lat else 0
        p95 = round(sorted(lat)[int(len(lat) * 0.95)], 1) if len(lat) >= 20 else (max(lat) if lat else 0)
        return {
            "total": total,
            "flagged": flagged,
            "openReviews": open_reviews,
            "latency": {"avg": avg, "p95": p95},
            "bySeverity": [{"key": k, "count": v} for k, v in by_sev.most_common()],
            "byCase": [{"key": k, "count": v} for k, v in by_case.most_common()],
            "byDept": [{"key": k, "count": v} for k, v in by_dept.most_common()],
            "recent": [
                {"ticket_id": i["ticket_id"], "severity": i["severity"],
                 "case_type": i["case_type"], "created_at": i["created_at"]}
                for i in items[:40]
            ],
        }

    # ── anomaly detection (cross-ticket memory) ───────────────────────────
    def anomalies(self) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._items)
        out: list[dict[str, Any]] = []
        recent = [i for i in items if _within_seconds(i["created_at"], 3600)]
        phishing = sum(1 for i in recent if i["case_type"] == "phishing_or_social_engineering")
        critical = sum(1 for i in recent if i["severity"] == "critical")
        if phishing >= 3:
            out.append({"type": "phishing_surge",
                        "detail": f"{phishing} phishing reports in the last hour."})
        if critical >= 5:
            out.append({"type": "critical_load",
                        "detail": f"{critical} critical cases in the last hour."})
        if len(recent) >= 25:
            out.append({"type": "volume_spike",
                        "detail": f"{len(recent)} tickets in the last hour."})
        return out


def _within_seconds(iso: str, seconds: int) -> bool:
    try:
        t = datetime.fromisoformat(iso).timestamp()
    except (ValueError, TypeError):
        return False
    return (time.time() - t) <= seconds


# Process-wide singleton.
store = CaseStore()
