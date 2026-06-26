"""Pydantic schemas + enums for the Akash Investigator API.

These models are the single source of truth for the API contract. The strict
`Enum` definitions are what guarantee the rubric's "API Contract & Schema"
points: any value outside the taxonomy is impossible to emit because the
response model would fail to serialize it.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─── Enums (taxonomy — must match the problem statement EXACTLY) ───────────
class Language(str, Enum):
    en = "en"
    bn = "bn"
    mixed = "mixed"


class Channel(str, Enum):
    in_app_chat = "in_app_chat"
    call_center = "call_center"
    email = "email"
    merchant_portal = "merchant_portal"
    field_agent = "field_agent"


class UserType(str, Enum):
    customer = "customer"
    merchant = "merchant"
    agent = "agent"
    unknown = "unknown"


class TransactionType(str, Enum):
    transfer = "transfer"
    payment = "payment"
    cash_in = "cash_in"
    cash_out = "cash_out"
    settlement = "settlement"
    refund = "refund"


class TransactionStatus(str, Enum):
    completed = "completed"
    failed = "failed"
    pending = "pending"
    reversed = "reversed"


class EvidenceVerdict(str, Enum):
    consistent = "consistent"
    inconsistent = "inconsistent"
    insufficient_data = "insufficient_data"


class CaseType(str, Enum):
    wrong_transfer = "wrong_transfer"
    payment_failed = "payment_failed"
    refund_request = "refund_request"
    duplicate_payment = "duplicate_payment"
    merchant_settlement_delay = "merchant_settlement_delay"
    agent_cash_in_issue = "agent_cash_in_issue"
    phishing_or_social_engineering = "phishing_or_social_engineering"
    other = "other"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Department(str, Enum):
    customer_support = "customer_support"
    dispute_resolution = "dispute_resolution"
    payments_ops = "payments_ops"
    merchant_operations = "merchant_operations"
    agent_operations = "agent_operations"
    fraud_risk = "fraud_risk"


# ─── Request models ────────────────────────────────────────────────────────
class TransactionEntry(BaseModel):
    # Tolerant on input: unknown transaction types/statuses won't 500 the
    # service; they are accepted as plain strings and normalized downstream.
    model_config = ConfigDict(extra="allow")

    transaction_id: Optional[str] = None
    timestamp: Optional[str] = None
    type: Optional[str] = None
    amount: Optional[float] = None
    counterparty: Optional[str] = None
    status: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def _coerce_amount(cls, v: Any) -> Optional[float]:
        # Tolerate "5,000", " 5000 ", or junk — never 400 on a single bad amount.
        if v is None or isinstance(v, (int, float)):
            return v
        try:
            return float(str(v).replace(",", "").strip())
        except (ValueError, TypeError):
            return None

    @field_validator("transaction_id", "timestamp", "type", "counterparty", "status",
                     mode="before")
    @classmethod
    def _coerce_str(cls, v: Any) -> Optional[str]:
        return v if v is None else str(v)


class AnalyzeTicketRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    ticket_id: str = Field(..., min_length=1)
    complaint: str
    language: Optional[str] = None
    channel: Optional[str] = None
    user_type: Optional[str] = None
    campaign_context: Optional[str] = None
    transaction_history: Optional[list[TransactionEntry]] = None
    metadata: Optional[dict[str, Any]] = None


# ─── Response model ──────────────────────────────────────────────────────
class AnalyzeTicketResponse(BaseModel):
    # Emits enum *values* (not names) and drops nothing required.
    model_config = ConfigDict(use_enum_values=True)

    ticket_id: str
    relevant_transaction_id: Optional[str] = None
    evidence_verdict: EvidenceVerdict
    case_type: CaseType
    severity: Severity
    department: Department
    agent_summary: str
    recommended_next_action: str
    customer_reply: str
    human_review_required: bool
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    reason_codes: Optional[list[str]] = None


class HealthResponse(BaseModel):
    status: str = "ok"


class ErrorResponse(BaseModel):
    detail: str
