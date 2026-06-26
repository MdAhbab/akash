# Submission Form - ready-to-paste answers

Fill the official form with these. Replace bracketed `[…]` items with your real
values. **Do not** put real API keys anywhere except the form's private field.

---

**Team name / Team ID:** `[your registered team name]` / `[your team id]`

**GitHub repository URL:** `https://github.com/MdAhbab/akash`
> If private, grant read access to organizer handle **`bipulhf`** before the deadline.

**Submission path:** Endpoint URL (primary) - Docker fallback also provided.

**Public endpoint base URL:** `https://akash.2haas.com`
- Health: `https://akash.2haas.com/health`
- Main: `POST https://akash.2haas.com/analyze-ticket`

**Docker build/run command (fallback):**
```
cd backend
docker build -t akash-api .
docker run -p 8000:8000 -e PORT=8000 --env-file judging.env akash-api
# health: http://localhost:8000/health
```

**Required environment variable names (names only):**
`PORT`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
`USE_LLM`, `LLM_TIMEOUT_SECONDS`, `REQUEST_BUDGET_SECONDS`, `DB_BACKEND`,
`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB`
> The service also runs fully **without** any keys (`USE_LLM=false`) and
> **without** a database (`DB_BACKEND=memory`) - both are optional enhancements.

**Secrets for judging (private field only, if Docker fallback is used):**
```
GEMINI_API_KEY=[real temporary key]
OPENAI_API_KEY=[real temporary key]
```
> Use temporary, limited-quota keys; rotate/revoke after evaluation.

**Sample request:**
```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today.",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "transaction_history": [
    {"transaction_id":"TXN-9101","timestamp":"2026-04-14T14:08:22Z","type":"transfer","amount":5000,"counterparty":"+8801719876543","status":"completed"}
  ]
}
```

**Sample response:**
```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports a 5000 BDT transfer (TXN-9101) sent to the wrong recipient.",
  "recommended_next_action": "Verify TXN-9101 with the customer and initiate the wrong-transfer dispute workflow per policy.",
  "customer_reply": "We have noted your concern about transaction TXN-9101. Our dispute team will review the case and contact you through official support channels. Please do not share your PIN, OTP, or password with anyone.",
  "human_review_required": true,
  "confidence": 0.9,
  "reason_codes": ["wrong_transfer", "transaction_match"]
}
```

**AI/model usage explanation:**
> Hybrid rule + AI. A deterministic engine performs evidence matching (it alone
> selects `relevant_transaction_id`, so the model cannot hallucinate one),
> routing, severity, escalation and safety. One LLM pass (Google
> `gemini-3.5-flash`, falling back to OpenAI `gpt-4o`) refines classification and
> drafts the summary/reply, bounded by a total time budget. The service runs
> correctly even with both LLMs unavailable. Stack: FastAPI + MySQL (the DB is a
> durability mirror, never in the request path).

**Safety logic explanation:**
> Three rules enforced deterministically after the LLM: (1) never request
> PIN/OTP/password/card - a linter distinguishes requests from warnings and
> strips requests; (2) never promise unauthorized refunds/reversals - rewritten
> to "any eligible amount will be returned through official channels"; (3) never
> redirect to third parties - only official channels. The complaint is treated as
> untrusted (prompt-injection resistant). High-risk/ambiguous cases are escalated
> to human review.

**Known limitations:**
> Deterministic Bangla/Banglish keyword coverage is broad but not exhaustive (the
> LLM covers the rest). Ambiguous multi-transaction cases return
> `insufficient_data` rather than guessing. Analytics are session-scoped (no DB).

**No real customer data:** Confirmed - only synthetic data used.

**No secrets committed:** Confirmed - `.env`, `judging.env`, `API Keys.txt` are
gitignored; repo ships only `*.env.example` placeholders.

**Architecture video link:** `[paste your ≤90s video URL - script in TEACHING_GUIDE.md]`
