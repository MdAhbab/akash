"""Safe, multilingual response templates (English + Bangla).

These are (a) the deterministic fallback when the LLM is unavailable and
(b) the guaranteed-safe baseline the safety guardian falls back to if it has to
strip an unsafe LLM reply. Every template here already complies with Section 8.
"""
from __future__ import annotations

import re
from typing import Optional

from ..schemas import CaseType, EvidenceVerdict

# Credential-safety reminder appended to customer-facing replies.
SAFE_REMINDER = {
    "en": "Please do not share your PIN, OTP, or password with anyone.",
    "bn": "অনুগ্রহ করে কারো সাথে আপনার পিন, ওটিপি বা পাসওয়ার্ড শেয়ার করবেন না।",
}

# "We never ask" assurance used for phishing replies.
NEVER_ASK = {
    "en": "We never ask for your PIN, OTP, or password under any circumstances.",
    "bn": "আমরা কখনোই আপনার পিন, ওটিপি বা পাসওয়ার্ড চাই না।",
}


def detect_language(text: str, declared: Optional[str]) -> str:
    """Pick the reply language: honour declared 'bn', else sniff Bangla script."""
    if declared in {"en", "bn"}:
        return declared
    if declared == "mixed":
        # Mixed → match dominant script of the complaint.
        pass
    bangla = len(re.findall(r"[ঀ-৿]", text or ""))
    latin = len(re.findall(r"[A-Za-z]", text or ""))
    return "bn" if bangla > latin else "en"


def _txn_ref(lang: str, txn_id: Optional[str]) -> str:
    if not txn_id:
        return ""
    return f" {txn_id}" if lang == "en" else f" {txn_id}"


def build_summary(case_type: CaseType, txn_id: Optional[str], amount: Optional[float],
                  verdict: EvidenceVerdict) -> str:
    amt = f"{int(amount)} BDT " if amount else ""
    ref = f" ({txn_id})" if txn_id else ""
    base = {
        CaseType.wrong_transfer: f"Customer reports a {amt}transfer{ref} sent to the wrong recipient.",
        CaseType.payment_failed: f"Customer reports a {amt}payment{ref} that failed but may have deducted balance.",
        CaseType.refund_request: f"Customer requests a refund of {amt}for a completed payment{ref}.",
        CaseType.duplicate_payment: f"Customer reports a duplicate {amt}payment{ref}.",
        CaseType.merchant_settlement_delay: f"Merchant reports a delayed {amt}settlement{ref}.",
        CaseType.agent_cash_in_issue: f"Customer reports a {amt}agent cash-in{ref} not reflected in balance.",
        CaseType.phishing_or_social_engineering: "Customer reports a suspicious contact requesting credentials (likely social engineering).",
        CaseType.other: "Customer raised a concern without enough detail to identify a specific transaction.",
    }[case_type]
    if verdict == EvidenceVerdict.inconsistent:
        base += " Transaction evidence appears to contradict the claim; flagged for review."
    elif verdict == EvidenceVerdict.insufficient_data and case_type != CaseType.phishing_or_social_engineering:
        base += " Evidence is insufficient to confirm a specific transaction."
    return base


def build_next_action(case_type: CaseType, txn_id: Optional[str],
                      verdict: EvidenceVerdict) -> str:
    ref = txn_id or "the relevant transaction"
    if verdict == EvidenceVerdict.insufficient_data and case_type in (
        CaseType.wrong_transfer, CaseType.other, CaseType.duplicate_payment
    ):
        return ("Reply to the customer requesting specific details (transaction ID, amount, "
                "counterparty and approximate time) before opening any dispute.")
    return {
        CaseType.wrong_transfer: f"Verify {ref} with the customer and initiate the wrong-transfer dispute workflow per policy.",
        CaseType.payment_failed: f"Investigate the ledger status of {ref}. If balance was deducted on a failed payment, trigger the standard reversal flow within SLA.",
        CaseType.refund_request: "Inform the customer that refund eligibility depends on the merchant's policy and guide them to the official process.",
        CaseType.duplicate_payment: f"Verify the suspected duplicate {ref} with payments operations and the biller before any reversal.",
        CaseType.merchant_settlement_delay: f"Route {ref} to merchant operations to check the settlement batch and communicate a revised ETA.",
        CaseType.agent_cash_in_issue: f"Investigate the pending status of {ref} with agent operations and confirm the settlement state within SLA.",
        CaseType.phishing_or_social_engineering: "Escalate to the fraud risk team immediately and log the reported contact for pattern analysis.",
        CaseType.other: "Reply to the customer requesting specific details so the case can be identified and routed.",
    }[case_type]


def build_reply(case_type: CaseType, txn_id: Optional[str], lang: str,
                verdict: EvidenceVerdict) -> str:
    ref = f" {txn_id}" if txn_id else ""
    reminder = SAFE_REMINDER[lang]

    if lang == "bn":
        templates = {
            CaseType.wrong_transfer: f"আপনার লেনদেন{ref} সম্পর্কে আমরা অবগত হয়েছি। আমাদের ডিসপিউট দল বিষয়টি যাচাই করে অফিসিয়াল চ্যানেলের মাধ্যমে আপনার সাথে যোগাযোগ করবে।",
            CaseType.payment_failed: f"আপনার লেনদেন{ref} এর কারণে ব্যালেন্স কেটে নেওয়া হয়ে থাকতে পারে বলে আমরা লক্ষ্য করেছি। আমাদের পেমেন্ট দল বিষয়টি যাচাই করবে এবং যেকোনো প্রযোজ্য অর্থ অফিসিয়াল চ্যানেলের মাধ্যমে ফেরত দেওয়া হবে।",
            CaseType.refund_request: "সম্পন্ন হওয়া মার্চেন্ট পেমেন্টের রিফান্ড মার্চেন্টের নিজস্ব নীতির উপর নির্ভর করে। অনুগ্রহ করে সরাসরি মার্চেন্টের সাথে যোগাযোগ করুন; প্রয়োজনে আমরা অফিসিয়াল চ্যানেলে সহায়তা করব।",
            CaseType.duplicate_payment: f"সম্ভাব্য ডুপ্লিকেট পেমেন্ট{ref} সম্পর্কে আমরা অবগত হয়েছি। আমাদের পেমেন্ট দল বিলারের সাথে যাচাই করবে এবং যেকোনো প্রযোজ্য অর্থ অফিসিয়াল চ্যানেলের মাধ্যমে ফেরত দেওয়া হবে।",
            CaseType.merchant_settlement_delay: f"আপনার সেটেলমেন্ট{ref} সম্পর্কে আমরা অবগত হয়েছি। আমাদের মার্চেন্ট অপারেশন্স দল ব্যাচের অবস্থা যাচাই করে অফিসিয়াল চ্যানেলে আপনাকে জানাবে।",
            CaseType.agent_cash_in_issue: f"আপনার লেনদেন{ref} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের এজেন্ট অপারেশন্স দল এটি দ্রুত যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে।",
            CaseType.phishing_or_social_engineering: f"কোনো তথ্য শেয়ার করার আগে যোগাযোগ করার জন্য ধন্যবাদ। {NEVER_ASK['bn']} কেউ আমাদের পরিচয় দিলেও এসব শেয়ার করবেন না। আমাদের ফ্রড দলকে বিষয়টি জানানো হয়েছে।",
            CaseType.other: "আপনার বার্তার জন্য ধন্যবাদ। দ্রুত সহায়তার জন্য অনুগ্রহ করে সংশ্লিষ্ট লেনদেন আইডি, পরিমাণ এবং কী সমস্যা হয়েছে তা জানান।",
        }
    else:
        templates = {
            CaseType.wrong_transfer: f"We have noted your concern about transaction{ref}. Our dispute team will review the case and contact you through official support channels.",
            CaseType.payment_failed: f"We have noted that transaction{ref} may have caused an unexpected balance deduction. Our payments team will review the case and any eligible amount will be returned through official channels.",
            CaseType.refund_request: "Thank you for reaching out. Refunds for completed merchant payments depend on the merchant's own policy. We recommend contacting the merchant through official channels and we can guide you if needed.",
            CaseType.duplicate_payment: f"We have noted the possible duplicate payment for transaction{ref}. Our payments team will verify with the biller and any eligible amount will be returned through official channels.",
            CaseType.merchant_settlement_delay: f"We have noted your concern about settlement{ref}. Our merchant operations team will check the batch status and update you on the expected settlement time through official channels.",
            CaseType.agent_cash_in_issue: f"We have noted your concern about transaction{ref}. Our agent operations team will verify it promptly and update you through official support channels.",
            CaseType.phishing_or_social_engineering: f"Thank you for reaching out before sharing any information. {NEVER_ASK['en']} Please do not share these with anyone, even if they claim to be from us. Our fraud team has been notified of this incident.",
            CaseType.other: "Thank you for reaching out. To help you faster, please share the transaction ID, the amount involved and a short description of what went wrong.",
        }

    body = templates[case_type]
    # Append the credential reminder unless it is already woven in (phishing).
    if case_type != CaseType.phishing_or_social_engineering:
        body = f"{body} {reminder}"
    return body
