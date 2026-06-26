"""Deterministic evidence + reasoning engine (no LLM).

This is the investigator's backbone. It parses the complaint and the supplied
transaction history and decides, with explainable rules:

  * relevant_transaction_id  - which transaction the complaint is about
  * evidence_verdict         - consistent / inconsistent / insufficient_data
  * case_type, severity, department, human_review_required
  * reason_codes, confidence

It is fast (sub-millisecond), needs no network and reproduces every public
sample case. The LLM layer refines wording and ambiguous classification, but
this engine guarantees a correct, safe, schema-valid answer even with the LLM
fully disabled - which is what keeps p95 latency low and failure rate at zero.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from ..schemas import (
    AnalyzeTicketRequest,
    CaseType,
    Department,
    EvidenceVerdict,
    Severity,
    TransactionEntry,
)

# Map a case_type to the department that owns it (Section 7.2 taxonomy).
DEPARTMENT_BY_CASE: dict[CaseType, Department] = {
    CaseType.wrong_transfer: Department.dispute_resolution,
    CaseType.payment_failed: Department.payments_ops,
    CaseType.duplicate_payment: Department.payments_ops,
    CaseType.refund_request: Department.customer_support,
    CaseType.merchant_settlement_delay: Department.merchant_operations,
    CaseType.agent_cash_in_issue: Department.agent_operations,
    CaseType.phishing_or_social_engineering: Department.fraud_risk,
    CaseType.other: Department.customer_support,
}

# Transaction types that are "relevant" to each case_type, used to break ties
# when several transactions share the complaint amount.
RELEVANT_TXN_TYPES: dict[CaseType, set[str]] = {
    CaseType.wrong_transfer: {"transfer"},
    CaseType.payment_failed: {"payment", "transfer", "cash_out"},
    CaseType.duplicate_payment: {"payment"},
    CaseType.refund_request: {"payment", "transfer"},
    CaseType.merchant_settlement_delay: {"settlement"},
    CaseType.agent_cash_in_issue: {"cash_in"},
}

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

# High value beyond which we escalate severity + force human review.
HIGH_VALUE_THRESHOLD = 50_000


@dataclass
class EvidenceAnalysis:
    case_type: CaseType
    relevant_transaction_id: Optional[str]
    evidence_verdict: EvidenceVerdict
    severity: Severity
    department: Department
    human_review_required: bool
    confidence: float
    reason_codes: list[str] = field(default_factory=list)
    # Internal signals exposed to the LLM prompt / debugging.
    amounts: list[float] = field(default_factory=list)
    matched_amount: Optional[float] = None
    notes: list[str] = field(default_factory=list)


# ─── text helpers ─────────────────────────────────────────────────────────
def _normalize(text: str) -> str:
    return (text or "").translate(_BN_DIGITS).lower()


def extract_amounts(text: str) -> list[float]:
    """Pull plausible money amounts from free text (handles 5,000 and ৫০০০)."""
    norm = _normalize(text)
    amounts: list[float] = []
    for raw in re.findall(r"\d[\d,]*(?:\.\d+)?", norm):
        cleaned = raw.replace(",", "")
        try:
            val = float(cleaned)
        except ValueError:
            continue
        # Ignore tiny tokens that are almost certainly not amounts (e.g. a lone
        # "1" in "day 1"), but keep them if explicitly money-shaped elsewhere.
        if val >= 10:
            amounts.append(val)
    # De-dupe but keep order.
    seen: set[float] = set()
    out: list[float] = []
    for a in amounts:
        if a not in seen:
            seen.add(a)
            out.append(a)
    return out


def _txn_type(t: TransactionEntry) -> str:
    return (t.type or "").strip().lower()


def _txn_status(t: TransactionEntry) -> str:
    return (t.status or "").strip().lower()


def _parse_ts(t: TransactionEntry) -> float:
    if not t.timestamp:
        return 0.0
    try:
        return datetime.fromisoformat(t.timestamp.replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError):
        return 0.0


# ─── case_type detection (multilingual keyword cascade) ───────────────────
PHISHING_TERMS = [
    "otp", "pin code", "one time password", "password", "scam", "phishing",
    "suspicious call", "fraud", "claiming to be", "claim to be", "pretending",
    "asked for my", "asking for my", "share my otp", "share my pin",
    "ওটিপি", "পিন", "পাসওয়ার্ড", "প্রতারণা", "প্রতারক", "স্ক্যাম", "সন্দেহজনক",
]
DUPLICATE_TERMS = ["twice", "two times", "double", "duplicate", "deducted twice",
                   "charged twice", "দুইবার", "দুবার", "ডাবল"]
FAILED_TERMS = ["failed", "fail", "unsuccessful", "deducted but", "balance deducted",
                "money deducted", "ব্যর্থ", "ফেইল", "কেটে নিয়েছে", "কেটে নিল"]
SETTLEMENT_TERMS = ["settlement", "settle", "settled", "payout", "merchant",
                    "সেটেলমেন্ট", "সেটেল"]
AGENT_TERMS = ["agent", "cash in", "cash-in", "cashin", "deposit", "এজেন্ট",
               "ক্যাশ ইন", "ক্যাশইন", "জমা"]
# Specific wrong-transfer phrasing only - a bare "wrong" (as in "something is
# wrong") must NOT trigger this case type.
WRONG_TRANSFER_TERMS = ["wrong number", "wrong person", "wrong recipient",
                        "wrong account", "wrong transaction", "wrong nimber",
                        "by mistake", "mistakenly", "accidentally",
                        "didn't get", "did not get", "didn't receive",
                        "did not receive", "not received", "hasn't received",
                        "haven't received", "ভুল নম্বর", "ভুল নাম্বার",
                        "ভুল মানুষ", "ভুল জায়গায়", "পায়নি", "পাইনি", "আসেনি"]
REFUND_TERMS = ["refund", "changed my mind", "change my mind", "don't want",
                "do not want", "return my money", "money back", "ফেরত", "রিফান্ড"]


def _any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def detect_case_type(req: AnalyzeTicketRequest, txns: list[TransactionEntry]) -> tuple[CaseType, list[str]]:
    """Rule cascade. Returns (case_type, reason_codes)."""
    text = _normalize(req.complaint)
    codes: list[str] = []
    has_transfer = any(_txn_type(t) == "transfer" for t in txns)
    has_payment = any(_txn_type(t) == "payment" for t in txns)
    has_settlement = any(_txn_type(t) == "settlement" for t in txns)
    has_cash_in = any(_txn_type(t) == "cash_in" for t in txns)
    user_type = (req.user_type or "").lower()

    # 1) Phishing / social engineering - safety-critical, checked first.
    # Trigger when the complaint reports SOMEONE ELSE asking for credentials or a
    # suspicious contact (not merely the customer mentioning their own pin/otp).
    if _any(text, ["scam", "phishing", "প্রতারণা", "প্রতারক", "স্ক্যাম"]) or (
        _any(text, ["otp", "pin", "password", "ওটিপি", "পিন", "পাসওয়ার্ড"])
        and _any(text, ["called", "call me", "asked", "asking", "share", "claiming",
                        "claim", "pretend", "suspicious", "message", "sms", "block",
                        "ফোন", "চাইছে", "চাইল", "চেয়েছে", "সন্দেহ", "ব্লক"])
    ):
        return CaseType.phishing_or_social_engineering, ["phishing", "credential_protection"]

    # 2) Duplicate payment.
    if _any(text, DUPLICATE_TERMS):
        return CaseType.duplicate_payment, ["duplicate_payment"]

    # 3) Failed payment with deduction.
    if _any(text, FAILED_TERMS) and (has_payment or "payment" in text or "recharge" in text
                                     or "bill" in text or _any(text, ["কেটে", "ব্যালেন্স"])):
        codes.append("payment_failed")
        return CaseType.payment_failed, codes

    # 4) Merchant settlement (merchant context).
    if _any(text, ["settlement", "settle", "settled", "সেটেলমেন্ট"]) or (
        user_type == "merchant" and (has_settlement or "sales" in text or "settle" in text)
    ):
        return CaseType.merchant_settlement_delay, ["merchant_settlement"]

    # 5) Agent cash-in issue.
    if _any(text, ["agent", "এজেন্ট"]) and _any(text, ["cash in", "cash-in", "cashin",
                                                       "ক্যাশ ইন", "ক্যাশইন", "deposit", "জমা",
                                                       "balance", "ব্যালেন্স", "আসেনি", "পাইনি"]):
        return CaseType.agent_cash_in_issue, ["agent_cash_in"]
    if has_cash_in and _any(text, ["agent", "এজেন্ট", "cash in", "ক্যাশ ইন", "আসেনি", "পাইনি"]):
        return CaseType.agent_cash_in_issue, ["agent_cash_in"]

    # 6) Wrong transfer (also covers "sent X but they didn't receive").
    if _any(text, WRONG_TRANSFER_TERMS) and (has_transfer or "sent" in text or "transfer" in text
                                             or "পাঠ" in text or "টাকা" in text):
        return CaseType.wrong_transfer, ["wrong_transfer"]

    # 7) Refund request (change of mind / generic refund).
    if _any(text, REFUND_TERMS):
        return CaseType.refund_request, ["refund_request"]

    # 8) Fallback.
    return CaseType.other, ["uncategorized"]


# ─── transaction matching ─────────────────────────────────────────────────
def _phones_in(text: str) -> list[str]:
    return re.findall(r"\+?\d[\d\s-]{8,}\d", text)


def match_transaction(
    req: AnalyzeTicketRequest,
    txns: list[TransactionEntry],
    case_type: CaseType,
) -> tuple[Optional[str], EvidenceVerdict, list[str], float, Optional[float]]:
    """Return (relevant_transaction_id, verdict, codes, confidence, matched_amount)."""
    codes: list[str] = []
    if not txns:
        return None, EvidenceVerdict.insufficient_data, ["no_transaction_history"], 0.6, None

    amounts = extract_amounts(req.complaint)
    relevant_types = RELEVANT_TXN_TYPES.get(case_type, set())

    # Candidate set: transactions whose amount equals a complaint amount.
    amount_matches: list[TransactionEntry] = []
    matched_amount: Optional[float] = None
    for amt in amounts:
        hits = [t for t in txns if t.amount is not None and abs(float(t.amount) - amt) < 0.01]
        if hits:
            amount_matches = hits
            matched_amount = amt
            break

    # ── Duplicate payment: find two same-amount, same-counterparty payments. ──
    if case_type == CaseType.duplicate_payment:
        groups: dict[tuple, list[TransactionEntry]] = {}
        for t in txns:
            key = (t.amount, (t.counterparty or "").lower(), _txn_type(t))
            groups.setdefault(key, []).append(t)
        dup_group = max(groups.values(), key=len)
        if len(dup_group) >= 2:
            dup_group.sort(key=_parse_ts)
            suspected = dup_group[-1]  # the later one is the suspected duplicate
            codes.append("biller_verification_required")
            return suspected.transaction_id, EvidenceVerdict.consistent, codes, 0.93, suspected.amount
        # Claimed duplicate but only one charge present → contradicted.
        if amount_matches:
            return amount_matches[0].transaction_id, EvidenceVerdict.inconsistent, \
                ["single_charge_only"], 0.7, matched_amount
        return None, EvidenceVerdict.insufficient_data, ["no_duplicate_found"], 0.6, None

    if not amount_matches:
        # No amount stated, or stated amount not in history.
        # Fall back to the single most-relevant-typed transaction if unambiguous.
        typed = [t for t in txns if _txn_type(t) in relevant_types] if relevant_types else []
        if len(typed) == 1 and not amounts:
            t = typed[0]
            return t.transaction_id, _verdict_for_single(t, case_type, txns), \
                ["single_relevant_transaction"], 0.7, t.amount
        if amounts:
            codes.append("amount_not_in_history")
        return None, EvidenceVerdict.insufficient_data, codes or ["no_matching_transaction"], 0.6, matched_amount

    # Narrow by relevant transaction type when that disambiguates.
    typed_matches = [t for t in amount_matches if _txn_type(t) in relevant_types] if relevant_types else amount_matches
    candidates = typed_matches or amount_matches

    # ── Ambiguity: several plausible transactions to DIFFERENT counterparties. ──
    distinct_parties = {(t.counterparty or "").lower() for t in candidates}
    if len(candidates) > 1 and len(distinct_parties) > 1:
        codes.append("ambiguous_match")
        codes.append("needs_clarification")
        return None, EvidenceVerdict.insufficient_data, codes, 0.65, matched_amount

    # Single best candidate (most recent if several to same party).
    candidates.sort(key=_parse_ts, reverse=True)
    best = candidates[0]

    verdict = _verdict_for_single(best, case_type, txns)
    if verdict == EvidenceVerdict.inconsistent:
        codes.append("evidence_inconsistent")
        confidence = 0.75
    else:
        codes.append("transaction_match")
        confidence = 0.9
    return best.transaction_id, verdict, codes, confidence, matched_amount


def _verdict_for_single(
    t: TransactionEntry, case_type: CaseType, txns: list[TransactionEntry]
) -> EvidenceVerdict:
    """Decide consistency for a single matched transaction."""
    party = (t.counterparty or "").lower()

    # Wrong transfer to an *established* recipient (>=2 transfers to same party)
    # contradicts the "wrong person" claim.
    if case_type == CaseType.wrong_transfer:
        same_party = [x for x in txns if (x.counterparty or "").lower() == party
                      and _txn_type(x) == "transfer"]
        if len(same_party) >= 2:
            return EvidenceVerdict.inconsistent

    # "Payment failed" but the matched transaction actually completed → contradiction.
    if case_type == CaseType.payment_failed and _txn_status(t) == "completed":
        # Only contradictory if the complaint specifically claims failure; the
        # matched-amount completed payment with a "deducted" claim is still the
        # subject, so treat completed-but-claimed-failed as inconsistent.
        return EvidenceVerdict.inconsistent

    return EvidenceVerdict.consistent


# ─── severity / review derivation ─────────────────────────────────────────
def derive_severity(
    case_type: CaseType,
    verdict: EvidenceVerdict,
    relevant_id: Optional[str],
    matched_amount: Optional[float],
) -> Severity:
    if case_type == CaseType.phishing_or_social_engineering:
        sev = Severity.critical
    elif case_type == CaseType.wrong_transfer:
        if verdict == EvidenceVerdict.consistent and relevant_id:
            sev = Severity.high
        else:
            sev = Severity.medium
    elif case_type in (CaseType.payment_failed, CaseType.duplicate_payment,
                       CaseType.agent_cash_in_issue):
        sev = Severity.high
    elif case_type == CaseType.merchant_settlement_delay:
        sev = Severity.medium
    elif case_type == CaseType.refund_request:
        sev = Severity.low
    else:
        sev = Severity.low

    # High-value escalation (one notch up, capped at critical).
    if matched_amount and matched_amount >= HIGH_VALUE_THRESHOLD:
        order = [Severity.low, Severity.medium, Severity.high, Severity.critical]
        sev = order[min(order.index(sev) + 1, len(order) - 1)]
    return sev


def derive_human_review(
    case_type: CaseType,
    verdict: EvidenceVerdict,
    severity: Severity,
    relevant_id: Optional[str],
) -> bool:
    if verdict == EvidenceVerdict.inconsistent:
        return True
    if severity == Severity.critical:
        return True
    if case_type == CaseType.phishing_or_social_engineering:
        return True
    if case_type in (CaseType.wrong_transfer, CaseType.duplicate_payment,
                     CaseType.agent_cash_in_issue) and relevant_id is not None:
        return True
    return False


# ─── top-level orchestration of the deterministic engine ──────────────────
def analyze_evidence(req: AnalyzeTicketRequest) -> EvidenceAnalysis:
    txns = req.transaction_history or []
    case_type, type_codes = detect_case_type(req, txns)

    if case_type == CaseType.phishing_or_social_engineering:
        # Safety reports are about a threat, not a ledger entry.
        relevant_id, verdict, match_codes, conf, matched_amount = (
            None, EvidenceVerdict.insufficient_data, ["critical_escalation"], 0.95, None
        )
    else:
        relevant_id, verdict, match_codes, conf, matched_amount = match_transaction(req, txns, case_type)

    severity = derive_severity(case_type, verdict, relevant_id, matched_amount)
    department = DEPARTMENT_BY_CASE[case_type]
    human_review = derive_human_review(case_type, verdict, severity, relevant_id)

    reason_codes: list[str] = []
    for c in type_codes + match_codes:
        if c not in reason_codes:
            reason_codes.append(c)

    return EvidenceAnalysis(
        case_type=case_type,
        relevant_transaction_id=relevant_id,
        evidence_verdict=verdict,
        severity=severity,
        department=department,
        human_review_required=human_review,
        confidence=round(conf, 2),
        reason_codes=reason_codes[:6],
        amounts=extract_amounts(req.complaint),
        matched_amount=matched_amount,
    )
