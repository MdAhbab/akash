"""Validate the deterministic engine against the 10 public sample cases.

Run in pure deterministic mode (USE_LLM=false) so the test is offline,
fast and reproducible. We assert the rubric-critical fields:
relevant_transaction_id, evidence_verdict, case_type, department,
human_review_required - plus that every customer_reply is safe.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# Force deterministic mode BEFORE importing the app (no network calls).
os.environ["USE_LLM"] = "false"

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.agents.orchestrator import analyze  # noqa: E402
from app.agents.safety import audit_only  # noqa: E402
from app.schemas import AnalyzeTicketRequest, AnalyzeTicketResponse  # noqa: E402


def _load_cases() -> list[dict]:
    candidates = [
        ROOT.parent / "Instructions and Rubrics" / "SUST_Preli_Sample_Cases.json",
        ROOT.parent / "SUST_Preli_Sample_Cases.json",
        ROOT / "tests" / "SUST_Preli_Sample_Cases.json",
    ]
    for path in candidates:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))["cases"]
    raise FileNotFoundError("SUST_Preli_Sample_Cases.json not found in expected locations")


def _run(case_input: dict) -> dict:
    req = AnalyzeTicketRequest(**case_input)
    out, _ = asyncio.run(analyze(req))
    # Round-trip through the strict response schema (enum/field validation).
    return AnalyzeTicketResponse(**out).model_dump()


def test_all_samples():
    cases = _load_cases()
    failures = []
    for case in cases:
        got = _run(case["input"])
        exp = case["expected_output"]
        for field in ("relevant_transaction_id", "evidence_verdict", "case_type",
                      "department", "human_review_required"):
            if got[field] != exp[field]:
                failures.append(f"{case['id']} {field}: got {got[field]!r} != {exp[field]!r}")
        # Safety: reply must contain none of the three penalty patterns.
        v = audit_only(got["customer_reply"])
        if v:
            failures.append(f"{case['id']} unsafe reply: {v}")
    assert not failures, "\n".join(failures)


if __name__ == "__main__":
    # Allow running without pytest: `python tests/test_samples.py`
    cases = _load_cases()
    passed = 0
    for case in cases:
        got = _run(case["input"])
        exp = case["expected_output"]
        diffs = {f: (got[f], exp[f]) for f in
                 ("relevant_transaction_id", "evidence_verdict", "case_type",
                  "department", "human_review_required") if got[f] != exp[f]}
        unsafe = audit_only(got["customer_reply"])
        ok = not diffs and not unsafe
        passed += ok
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {case['id']} {case['label']}")
        if diffs:
            for f, (g, e) in diffs.items():
                print(f"        {f}: got {g!r} expected {e!r}")
        if unsafe:
            print(f"        UNSAFE: {unsafe}")
    print(f"\n{passed}/{len(cases)} sample cases match on rubric-critical fields.")
