"""Safety guardian - deterministic post-processor (the reflection / guardrail step).

Runs AFTER any LLM output and BEFORE the response leaves the service. It is the
last line of defence for the rubric's three hard safety penalties:

  -15  asking for PIN / OTP / password / full card number
  -10  promising an unauthorized refund / reversal / unblock / recovery
  -10  directing the customer to a suspicious third party

Strategy: detect → repair, never just detect. If an unsafe pattern is found we
rewrite or strip the offending text and substitute compliant language, so the
customer_reply that ships is *always* safe regardless of what the model wrote.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .reply import SAFE_REMINDER

# ── credential REQUEST patterns (asking for secrets) ──────────────────────
# We must distinguish a *request* ("share your OTP") from a *warning*
# ("never share your OTP"). Warnings are safe and must be preserved.
_CRED_WORDS = r"(pin|otp|one[- ]time password|password|cvv|full card number|card number|secret code)"
_REQUEST_VERBS = r"(share|provide|give|send|tell|enter|type|confirm|verify|need|require|what is|what's|reply with|forward)"
_WARNING_CONTEXT = r"(do not|don't|never|do n't|not share|won't ask|will not ask|we never|don’t)"

CRED_REQUEST_RE = re.compile(
    rf"\b{_REQUEST_VERBS}\b[^.?!]{{0,40}}\b(your |the |me your )?{_CRED_WORDS}",
    re.IGNORECASE,
)
WARNING_RE = re.compile(_WARNING_CONTEXT, re.IGNORECASE)

# ── unauthorized action / definitive promises ─────────────────────────────
UNAUTHORIZED_RES = [
    (re.compile(r"\bwe (will|'ll|have|are going to|are) (refund(ed)?|reverse[d]?|reversing|return(ed)?|"
                r"unblock(ed)?|restore[d]?|credit(ed)?|recover(ed)?)\b", re.IGNORECASE),
     "any eligible amount will be returned through official channels"),
    # Note the negative lookbehind: the APPROVED safe phrase "any eligible amount
    # will be returned through official channels" must NOT be flagged.
    (re.compile(r"\b(?<!eligible )(your |the )?(money|amount|balance|fund[s]?) (will be|has been|is) (refunded|reversed|returned|credited|restored)\b",
                re.IGNORECASE),
     "any eligible amount will be returned through official channels"),
    (re.compile(r"\b(i|we) (guarantee|assure|promise)\b[^.?!]*", re.IGNORECASE),
     "our team will review your case"),
    (re.compile(r"\byour (account|card) (has been|is now|will be) (unblocked|unlocked|restored|reactivated)\b",
                re.IGNORECASE),
     "our team will review your account status through official channels"),
]

# ── third-party redirection (anything that isn't an official channel) ─────
THIRD_PARTY_RES = [
    re.compile(r"\bcall (this|the following) number\b[^.?!]*", re.IGNORECASE),
    re.compile(r"\b(whatsapp|telegram|facebook|messenger|imo) (us|the agent|this)\b[^.?!]*", re.IGNORECASE),
    re.compile(r"\bcontact (the )?(agent|caller|third[- ]party|that person|this person|him|her) (directly|on)\b[^.?!]*",
               re.IGNORECASE),
    re.compile(r"\bvisit (https?://)?(?!.*official)[a-z0-9.-]+\.(com|net|xyz|info|link)\b[^.?!]*", re.IGNORECASE),
]


@dataclass
class SafetyResult:
    text: str
    violations: list[str] = field(default_factory=list)
    repaired: bool = False


def _strip_sentence(text: str, span: tuple[int, int]) -> str:
    """Remove the sentence containing the matched span."""
    start, end = span
    s = text.rfind(".", 0, start)
    s = s + 1 if s != -1 else 0
    e = text.find(".", end)
    e = e + 1 if e != -1 else len(text)
    return (text[:s] + text[e:]).strip()


def sanitize_reply(text: str, lang: str = "en") -> SafetyResult:
    """Scan + repair a customer-facing reply. Always returns safe text."""
    if not text:
        text = ""
    violations: list[str] = []
    repaired = False
    out = text

    # 1) Credential requests → strip the offending sentence (unless it is a warning).
    for m in list(CRED_REQUEST_RE.finditer(out)):
        # Look at the sentence around the match; keep it if it's a warning.
        s = out.rfind(".", 0, m.start()) + 1
        e = out.find(".", m.end())
        sentence = out[s: e if e != -1 else len(out)]
        if WARNING_RE.search(sentence):
            continue
        out = _strip_sentence(out, m.span())
        violations.append("credential_request_removed")
        repaired = True

    # 2) Unauthorized promises → replace with compliant phrasing.
    for pattern, replacement in UNAUTHORIZED_RES:
        if pattern.search(out):
            out = pattern.sub(replacement, out)
            violations.append("unauthorized_action_softened")
            repaired = True

    # 3) Third-party redirection → strip.
    for pattern in THIRD_PARTY_RES:
        m = pattern.search(out)
        if m:
            out = _strip_sentence(out, m.span())
            violations.append("third_party_redirect_removed")
            repaired = True

    # 4) Guarantee the credential-safety reminder is present.
    reminder = SAFE_REMINDER.get(lang, SAFE_REMINDER["en"])
    has_reminder = ("do not share" in out.lower() or "শেয়ার করবেন না" in out
                    or "never ask" in out.lower() or "কখনোই" in out)
    if not has_reminder:
        out = f"{out.strip()} {reminder}".strip()
        repaired = True

    out = re.sub(r"\s{2,}", " ", out).strip()
    return SafetyResult(text=out, violations=violations, repaired=repaired)


def sanitize_action(text: str) -> SafetyResult:
    """Lighter pass for recommended_next_action (internal-facing, but still must
    not promise unauthorized actions)."""
    if not text:
        return SafetyResult(text="Route to the appropriate team for review.", repaired=True)
    out = text
    violations: list[str] = []
    repaired = False
    for pattern, replacement in UNAUTHORIZED_RES:
        if pattern.search(out):
            out = pattern.sub(replacement, out)
            violations.append("unauthorized_action_softened")
            repaired = True
    return SafetyResult(text=out.strip(), violations=violations, repaired=repaired)


def audit_only(text: str) -> list[str]:
    """Return a list of violation labels without modifying text (for tests/metrics)."""
    found: list[str] = []
    for m in CRED_REQUEST_RE.finditer(text or ""):
        s = text.rfind(".", 0, m.start()) + 1
        e = text.find(".", m.end())
        sentence = text[s: e if e != -1 else len(text)]
        if not WARNING_RE.search(sentence):
            found.append("credential_request")
            break
    for pattern, _ in UNAUTHORIZED_RES:
        if pattern.search(text or ""):
            found.append("unauthorized_action")
            break
    for pattern in THIRD_PARTY_RES:
        if pattern.search(text or ""):
            found.append("third_party_redirect")
            break
    return found
