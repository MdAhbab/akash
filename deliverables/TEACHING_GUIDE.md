# Teaching Guide — understand the whole thing in plain English

This walks you through what you're submitting so you can explain it confidently.

---

## 1. The problem in one paragraph

A fintech (think bKash) is drowning in support tickets during a campaign. They
want a **copilot** that reads each complaint plus the customer's recent
transactions, figures out **what really happened**, decides **which team** should
handle it, and writes a **safe** reply — never asking for a PIN/OTP and never
promising a refund it can't authorize. You build an API with two endpoints:
`/health` and `/analyze-ticket`.

## 2. Why it's an *investigator*, not a classifier

The trick: the complaint and the data can disagree. "I sent money to the wrong
person!" — but the history shows you've sent to that exact number five times
before. A naive classifier confirms the dispute. A good investigator says
*"inconsistent — flag for human review."* That judgement is worth the most points
(35/100), and it lives in two response fields: `relevant_transaction_id` and
`evidence_verdict`.

## 3. How our service thinks (the pipeline)

Imagine an assembly line with five stations:

1. **Evidence station (rules).** Reads the numbers. Pulls the amount out of the
   complaint (even Bangla digits), finds the matching transaction, and decides
   consistent / inconsistent / insufficient. No internet needed.
2. **Reasoning station (AI).** Sends everything to Gemini (or OpenAI if Gemini is
   down) for one quick pass to understand tricky wording and write nice text.
3. **Reconciler.** Combines the two — but the *routing, urgency, and escalation*
   are always decided by the rules, so the AI can't send a fraud case to the
   wrong desk.
4. **Safety station.** Re-reads the customer reply and **fixes** anything unsafe
   (deletes "share your OTP", rewrites "we'll refund you").
5. **Schema station.** Stamps the output into the exact shape the judge expects.

If the AI is slow or offline, stations 1, 3, 4, 5 still produce a correct, safe
answer instantly. That's why it never crashes or times out.

## 4. What makes it "agentic" (5 features)

- **Tools** — small skills the agent calls (look up a transaction, classify,
  check safety).
- **MCP** — those same tools are published over the Model Context Protocol, so
  other AI agents (any MCP-compatible client) can use your investigator.
- **Planner** — the five-station pipeline with automatic provider fallback.
- **Reflection** — the safety station critiques and repairs its own draft.
- **Memory** — it remembers cases and spots patterns (a phishing surge, a
  critical-load spike) across many tickets.

(See `AGENTIC_AI.md` for the exact files.)

## 5. The two models (and why)

- **Gemini 3.5 Flash** — primary. Fast + cheap + good at Bangla. One call per
  ticket, well under a cent.
- **GPT-4o** — backup, only if Gemini fails.
- **Rules engine** — the safety net that needs no model at all.

## 6. How it's deployed

A tiny Google Cloud VM (e2-micro) runs the API in Docker behind nginx, with a
free Let's Encrypt HTTPS certificate, at **akash.2haas.com**. One command,
`sudo python3 deploy/run_onVM.py`, installs everything, adds swap so the build
fits in 1 GB RAM, and turns it on. Judges just call the URL.

## 7. Security you should know about

- Your real API keys are **never** in GitHub. They live in a `.env` file that git
  ignores. The repo only has `*.env.example` with blanks.
- If you ever need to give judges a key (Docker fallback only), use the form's
  **private** field, and **rotate the key** after judging.

---

## 8. ≤90-second architecture video script

> "This is QueueStorm, an investigator copilot for fintech support. It exposes
> two endpoints: `/health` and `/analyze-ticket`.
>
> When a ticket arrives, a deterministic evidence engine first reads the
> complaint and the transaction history — it extracts the amount, even in Bangla
> digits, and finds the transaction the customer means. It decides whether the
> data is consistent with the claim, inconsistent — like repeated transfers to a
> 'wrong' number — or insufficient.
>
> Then one LLM pass, Gemini Flash with an OpenAI fallback, refines the
> classification and drafts the summary and reply. But routing, severity, and
> escalation stay deterministic, so the model can never mis-route or break the
> schema.
>
> A safety guardrail then audits and repairs the reply: it strips any request for
> a PIN or OTP, rewrites refund promises into 'any eligible amount will be
> returned through official channels', and ignores prompt-injection in the
> complaint.
>
> The agent's tools are also exposed over MCP, and a memory layer detects
> phishing surges across tickets. It's deployed on a GCP e2-micro behind nginx
> with HTTPS at akash.2haas.com, in a 150-megabyte image. It passes all ten
> public sample cases and answers in milliseconds when the LLM is offline."

(That's ~90 seconds at a normal pace. Show: the Playground analyzing a wrong-
transfer-with-inconsistent-evidence case, then the JSON, then `/health`.)

---

## 9. If a judge asks "what would you improve?"

- Persist analytics to a small DB for multi-instance deployments.
- Add a learned classifier as a third opinion alongside rules + LLM.
- Expand Bangla/Banglish lexical coverage and add transliteration.
- Add request-level rate limiting and structured audit logging.
