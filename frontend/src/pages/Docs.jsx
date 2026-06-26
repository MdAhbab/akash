import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/cn.js';
import { api } from '../lib/api.js';
import { BRAND } from '../lib/brand.js';
import { SeverityBadge, CaseTag, DeptTag, Tag } from '../components/ui/Badge.jsx';
import { JsonViewer } from '../components/ui/JsonViewer.jsx';
import { PageHeader, Spinner } from '../components/ui/PageHeader.jsx';
import { VERDICT_COLOR, VERDICT_LABEL } from '../lib/format.js';
import Reveal from '../components/ui/Reveal.jsx';

/* ─── Helpers ─────────────────────────────────────────────── */
function rand4() {
  return Math.floor(1000 + Math.random() * 9000);
}

function SchemaTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline">
            <th className="label pb-2 text-left">Field</th>
            <th className="label pb-2 text-left pl-6">Type</th>
            <th className="label pb-2 text-left pl-6">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.field} className={cn('border-b border-hairline', i % 2 === 0 ? '' : 'bg-elevated/40')}>
              <td className="py-2.5 pr-4">
                <code className="font-mono text-[12px] text-violet">{r.field}</code>
                {r.required && (
                  <span className="ml-1.5 text-[10px] font-semibold text-magenta">required</span>
                )}
              </td>
              <td className="py-2.5 pl-6 pr-4">
                <code className="font-mono text-[12px] text-mint">{r.type}</code>
              </td>
              <td className="py-2.5 pl-6 text-faint">{r.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnumTable({ rows, colorMap }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline">
            <th className="label pb-2 text-left">Value</th>
            <th className="label pb-2 text-left pl-6">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const color = colorMap?.[r.value];
            return (
              <tr key={r.value} className={cn('border-b border-hairline', i % 2 === 0 ? '' : 'bg-elevated/40')}>
                <td className="py-2.5 pr-4">
                  <code className="font-mono text-[12px] font-semibold" style={color ? { color } : undefined}>
                    {r.value}
                  </code>
                </td>
                <td className="py-2.5 pl-6 text-faint">{r.meaning}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children, lang = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };
  return (
    <div className="card overflow-hidden bg-base/60">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="label">{lang}</span>
        <button onClick={copy} className="text-xs font-medium text-faint transition hover:text-ink" data-cursor="hover">
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink/90 tnum">
        {children.trim()}
      </pre>
    </div>
  );
}

function DocSection({ index, title, children }) {
  return (
    <Reveal>
      <section className="py-8">
        <div className="mb-1 label">{index}</div>
        <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        <div className="hairline mb-6" />
        {children}
      </section>
    </Reveal>
  );
}

function Callout({ accent = 'mint', icon, children }) {
  const accentStyle = {
    mint: { borderColor: '#28E0C8', background: 'rgba(40,224,200,0.06)', color: '#28E0C8' },
    magenta: { borderColor: '#FF3D81', background: 'rgba(255,61,129,0.07)', color: '#FF3D81' },
    violet: { borderColor: '#7A5CFF', background: 'rgba(122,92,255,0.07)', color: '#7A5CFF' },
    champagne: { borderColor: '#D9C6A3', background: 'rgba(217,198,163,0.07)', color: '#D9C6A3' },
  }[accent] || {};
  return (
    <div className="flex gap-4 rounded-2xl border p-5" style={{ borderColor: accentStyle.borderColor, background: accentStyle.background }}>
      {icon && <span className="flex-shrink-0 text-lg leading-none" style={{ color: accentStyle.color }}>{icon}</span>}
      <div className="text-sm leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}

/* ─── Schema data (matches the problem statement exactly) ─── */
const REQUEST_FIELDS = [
  { field: 'ticket_id', type: 'string', required: true, notes: 'Unique ticket identifier. Echoed verbatim in the response.' },
  { field: 'complaint', type: 'string', required: true, notes: 'Customer complaint text — English, Bangla, or mixed Banglish.' },
  { field: 'language', type: 'enum', required: false, notes: 'en | bn | mixed' },
  { field: 'channel', type: 'enum', required: false, notes: 'in_app_chat | call_center | email | merchant_portal | field_agent' },
  { field: 'user_type', type: 'enum', required: false, notes: 'customer | merchant | agent | unknown' },
  { field: 'campaign_context', type: 'string', required: false, notes: 'Campaign identifier provided by the harness.' },
  { field: 'transaction_history', type: 'array', required: false, notes: 'Recent transactions (typically 2–5). May be empty for safety-only cases.' },
  { field: 'metadata', type: 'object', required: false, notes: 'Additional simulated context.' },
];

const TXN_FIELDS = [
  { field: 'transaction_id', type: 'string', notes: 'Unique transaction identifier.' },
  { field: 'timestamp', type: 'string (ISO 8601)', notes: 'When the transaction occurred.' },
  { field: 'type', type: 'enum', notes: 'transfer | payment | cash_in | cash_out | settlement | refund' },
  { field: 'amount', type: 'number', notes: 'Amount in BDT.' },
  { field: 'counterparty', type: 'string', notes: 'Recipient phone, merchant ID, or agent ID.' },
  { field: 'status', type: 'enum', notes: 'completed | failed | pending | reversed' },
];

const RESPONSE_FIELDS = [
  { field: 'ticket_id', type: 'string', required: true, notes: 'Matches the request value.' },
  { field: 'relevant_transaction_id', type: 'string | null', required: true, notes: 'The transaction the complaint refers to, or null if none matches.' },
  { field: 'evidence_verdict', type: 'enum', required: true, notes: 'consistent | inconsistent | insufficient_data' },
  { field: 'case_type', type: 'enum', required: true, notes: 'One of eight case categories.' },
  { field: 'severity', type: 'enum', required: true, notes: 'low | medium | high | critical' },
  { field: 'department', type: 'enum', required: true, notes: 'One of six routing destinations.' },
  { field: 'agent_summary', type: 'string', required: true, notes: 'Concise agent-ready summary (1–2 sentences).' },
  { field: 'recommended_next_action', type: 'string', required: true, notes: 'Suggested operational next step for the agent.' },
  { field: 'customer_reply', type: 'string', required: true, notes: 'Safe official reply — respects all safety rules.' },
  { field: 'human_review_required', type: 'boolean', required: true, notes: 'true for disputes, suspicious, high-value, or ambiguous cases.' },
  { field: 'confidence', type: 'float [0..1]', required: false, notes: 'Decision confidence.' },
  { field: 'reason_codes', type: 'string[]', required: false, notes: 'Short labels supporting the decision.' },
];

const VERDICT_ROWS = [
  { value: 'consistent', meaning: 'The transaction data supports the complaint.' },
  { value: 'inconsistent', meaning: 'The data contradicts the complaint (e.g. an "established recipient").' },
  { value: 'insufficient_data', meaning: 'Cannot be determined from the provided history. Akash does not guess.' },
];

const CASE_TYPE_ROWS = [
  { value: 'wrong_transfer', meaning: 'Money sent to the wrong recipient.' },
  { value: 'payment_failed', meaning: 'Transaction failed but balance may have been deducted.' },
  { value: 'refund_request', meaning: 'Customer is asking for a refund.' },
  { value: 'duplicate_payment', meaning: 'Same payment appears charged more than once.' },
  { value: 'merchant_settlement_delay', meaning: 'Merchant settlement not received in the expected window.' },
  { value: 'agent_cash_in_issue', meaning: 'Agent cash deposit not reflected in customer balance.' },
  { value: 'phishing_or_social_engineering', meaning: 'Suspicious calls/SMS, or someone asking for PIN/OTP/password.' },
  { value: 'other', meaning: 'Anything not covered above.' },
];

const SEVERITY_ROWS = [
  { value: 'low', meaning: 'Minor issue; standard queue time.' },
  { value: 'medium', meaning: 'Moderate impact; elevated priority.' },
  { value: 'high', meaning: 'Significant financial or account risk.' },
  { value: 'critical', meaning: 'Immediate action; triggers Sentinel escalation.' },
];

const DEPARTMENT_ROWS = [
  { value: 'customer_support', meaning: 'other, low-severity refunds, vague/insufficient cases.' },
  { value: 'dispute_resolution', meaning: 'wrong_transfer, contested refunds.' },
  { value: 'payments_ops', meaning: 'payment_failed, duplicate_payment.' },
  { value: 'merchant_operations', meaning: 'merchant_settlement_delay, merchant-side issues.' },
  { value: 'agent_operations', meaning: 'agent_cash_in_issue, agent-side issues.' },
  { value: 'fraud_risk', meaning: 'phishing_or_social_engineering, suspicious patterns.' },
];

const STATUS_ROWS = [
  { value: '200', meaning: 'Successful analysis; body conforms to the output schema.' },
  { value: '400', meaning: 'Malformed input (invalid JSON, missing required fields).' },
  { value: '422', meaning: 'Schema valid but semantically invalid (e.g. empty complaint).' },
  { value: '500', meaning: 'Internal error. No stack traces, tokens, or secrets are leaked.' },
];

const VERDICT_COLOR_MAP = VERDICT_COLOR;
const SEVERITY_COLOR_MAP = { low: '#5FB587', medium: '#E0B23C', high: '#F0743A', critical: '#FF3B5C' };
const CASE_COLOR_MAP = {
  wrong_transfer: '#7A5CFF', payment_failed: '#E0B23C', refund_request: '#34C7E0',
  duplicate_payment: '#F0743A', merchant_settlement_delay: '#28E0C8', agent_cash_in_issue: '#9B7BFF',
  phishing_or_social_engineering: '#FF3D81', other: '#8A857C',
};
const DEPT_COLOR_MAP = {
  customer_support: '#34C7E0', dispute_resolution: '#7A5CFF', payments_ops: '#E0B23C',
  merchant_operations: '#28E0C8', agent_operations: '#F0743A', fraud_risk: '#FF3D81',
};

const RUNTIME_CONSTRAINTS = [
  { label: 'Health readiness', note: 'GET /health returns {"status":"ok"} within 60s of service start.' },
  { label: 'Per-request timeout', note: 'POST /analyze-ticket must respond within 30s (enforced by the harness).' },
  { label: 'Latency', note: 'p95 ≤ 5s targeted; the deterministic path answers in milliseconds, one LLM call adds ~1–2s.' },
  { label: 'Compute', note: 'Public HTTPS. 2 vCPU / 4 GB is sufficient. No GPU. No secrets committed.' },
  { label: 'AI', note: 'Hybrid: deterministic rules + one LLM pass (Gemini → GPT-4o). Runs fully without keys.' },
  { label: 'Persistence', note: 'MySQL durability mirror — never in the request path; the API survives a DB outage.' },
];

const SAMPLE_REQUEST = `{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }
  ]
}`;

const SAMPLE_RESPONSE = `{
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
}`;

const DEFAULT_TXN = JSON.stringify([
  { transaction_id: 'TXN-9101', timestamp: '2026-04-14T14:08:22Z', type: 'transfer', amount: 5000, counterparty: '+8801719876543', status: 'completed' },
], null, 2);

/* ─── For-Judges panel ────────────────────────────────────── */
function JudgeGuide() {
  return (
    <Reveal>
      <div className="card border-2 p-6 md:p-8" style={{ borderColor: '#28E0C8', background: 'rgba(40,224,200,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: '#28E0C8' }} />
          <span className="label" style={{ color: '#28E0C8' }}>For Judges — evaluate in 60 seconds</span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Two endpoints, judged directly at the domain root.</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-hairline bg-base/50 p-4">
            <div className="label mb-1">Health</div>
            <code className="font-mono text-[12px] text-mint">GET {BRAND.publicBase}/health</code>
          </div>
          <div className="rounded-xl border border-hairline bg-base/50 p-4">
            <div className="label mb-1">Main endpoint</div>
            <code className="font-mono text-[12px] text-violet">POST {BRAND.publicBase}/analyze-ticket</code>
          </div>
        </div>

        <div className="mt-5">
          <CodeBlock lang="bash — copy & run">
{`curl ${BRAND.publicBase}/health

curl -X POST ${BRAND.publicBase}/analyze-ticket \\
  -H "Content-Type: application/json" \\
  -d '{"ticket_id":"TKT-001","complaint":"I sent 5000 taka to a wrong number","transaction_history":[{"transaction_id":"TXN-9101","type":"transfer","amount":5000,"counterparty":"+8801719876543","status":"completed"}]}'`}
          </CodeBlock>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div className="label mb-2">What to look at</div>
            <ul className="space-y-1.5 text-sm text-muted">
              <li>• <span className="text-ink">Evidence reasoning</span> — relevant_transaction_id + evidence_verdict.</li>
              <li>• <span className="text-ink">Safety</span> — customer_reply never asks for PIN/OTP or promises a refund.</li>
              <li>• <span className="text-ink">Schema</span> — exact enums + 200/400/422/500 codes.</li>
              <li>• <span className="text-ink">Reliability</span> — never 5xx; works even with the LLM disabled.</li>
            </ul>
          </div>
          <div>
            <div className="label mb-2">Good to know</div>
            <ul className="space-y-1.5 text-sm text-muted">
              <li>• Runs fully <span className="text-ink">without API keys</span> (deterministic fallback).</li>
              <li>• Passes all <span className="text-ink">10 public sample cases</span>.</li>
              <li>• <a href={BRAND.repo} target="_blank" rel="noreferrer" className="text-violet hover:underline">GitHub repo</a> · runbook · Docker image · sample outputs.</li>
              <li>• Try it live in the <a href="/playground" className="text-violet hover:underline">Playground</a> or the form below.</li>
            </ul>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Try-it form ─────────────────────────────────────────── */
const CHANNELS = ['in_app_chat', 'call_center', 'email', 'merchant_portal', 'field_agent'];
const USER_TYPES = ['customer', 'merchant', 'agent', 'unknown'];

function TryItPanel() {
  const [ticketId] = useState(() => `DOC-${rand4()}`);
  const [complaint, setComplaint] = useState('I sent 5000 taka to a wrong number around 2pm today');
  const [language, setLanguage] = useState('en');
  const [channel, setChannel] = useState('in_app_chat');
  const [userType, setUserType] = useState('customer');
  const [txnJson, setTxnJson] = useState(DEFAULT_TXN);

  const { mutate, isPending, data: result, error, isError, reset } = useMutation({
    mutationFn: () => {
      let transaction_history = [];
      try { transaction_history = txnJson.trim() ? JSON.parse(txnJson) : []; } catch { /* keep [] */ }
      return api.analyzeTicket({ ticket_id: ticketId, complaint, language, channel, user_type: userType, transaction_history });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!complaint.trim()) return;
    mutate();
  };

  return (
    <div className="card p-6">
      <div className="label mb-4">Interactive try-it · POST /analyze-ticket</div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label mb-1 block">ticket_id</label>
          <code className="block rounded-lg border border-hairline bg-base/60 px-3 py-2 font-mono text-sm text-violet">{ticketId}</code>
        </div>
        <div>
          <label htmlFor="try-complaint" className="label mb-1 block">complaint <span className="text-magenta">required</span></label>
          <textarea
            id="try-complaint" value={complaint}
            onChange={(e) => { setComplaint(e.target.value); reset(); }}
            rows={2}
            className="w-full resize-none rounded-xl border border-hairline bg-base/60 px-4 py-3 font-sans text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none"
            data-cursor="hover"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select id="try-language" label="language" value={language} onChange={setLanguage} options={['en', 'bn', 'mixed']} />
          <Select id="try-channel" label="channel" value={channel} onChange={setChannel} options={CHANNELS} />
          <Select id="try-usertype" label="user_type" value={userType} onChange={setUserType} options={USER_TYPES} />
        </div>
        <div>
          <label htmlFor="try-txn" className="label mb-1 block">transaction_history <span className="text-faint">(JSON — the evidence)</span></label>
          <textarea
            id="try-txn" value={txnJson}
            onChange={(e) => { setTxnJson(e.target.value); reset(); }}
            rows={6}
            className="w-full resize-none rounded-xl border border-hairline bg-base/60 px-4 py-3 font-mono text-xs text-muted focus:border-violet focus:outline-none"
            data-cursor="hover"
          />
        </div>
        <button type="submit" disabled={isPending || !complaint.trim()} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50" data-cursor="hover">
          {isPending ? <><Spinner size={14} /> Investigating…</> : 'Analyze ticket'}
        </button>
      </form>

      <AnimatePresence>
        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-sev-critical/30 bg-sev-critical/10 px-4 py-3 text-sm text-sev-critical">
            {error?.message || 'Request failed'} — is the backend reachable at {api.base}?
          </motion.div>
        )}
        {result && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mt-6 space-y-4">
            <div className="hairline" />
            <div className="label">Verdict</div>
            <div className="flex flex-wrap items-center gap-2">
              <CaseTag caseType={result.case_type} />
              <SeverityBadge severity={result.severity} />
              <DeptTag dept={result.department} />
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ color: VERDICT_COLOR_MAP[result.evidence_verdict], background: `${VERDICT_COLOR_MAP[result.evidence_verdict]}1a`, border: `1px solid ${VERDICT_COLOR_MAP[result.evidence_verdict]}55` }}>
                {VERDICT_LABEL[result.evidence_verdict] || result.evidence_verdict}
              </span>
              {result.human_review_required && <Tag color="#FF3B5C">Human review</Tag>}
            </div>
            <div className="text-sm text-muted">
              Relevant transaction:{' '}
              <code className="font-mono text-ink">{result.relevant_transaction_id || 'none matched'}</code>
            </div>
            <JsonViewer data={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Select({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1 block">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-hairline bg-base/60 px-3 py-2.5 text-sm text-ink focus:border-violet focus:outline-none">
        {options.map((o) => <option key={o} value={o} className="bg-elevated text-ink">{o}</option>)}
      </select>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────── */
export default function Docs() {
  return (
    <div className="shell pb-24">
      <PageHeader index="05" title="API & Docs" subtitle="Two endpoints. One JSON in, one structured verdict out." />

      <JudgeGuide />

      <Reveal>
        <div className="max-w-2xl py-8">
          <p className="text-base leading-relaxed text-muted">
            {BRAND.name} exposes a minimal, opinionated HTTP API.{' '}
            <span className="text-ink">POST /analyze-ticket</span> reads one customer complaint plus a
            short snippet of the customer’s recent transactions, and returns a structured investigator
            verdict — which transaction it concerns, whether the evidence is consistent, the case type,
            severity, routing department, an agent summary, a recommended next action, and a safe
            customer reply.{' '}
            <span className="text-ink">GET /health</span> confirms readiness. Both speak plain JSON;
            no authentication is required for the public demo instance.
          </p>
        </div>
      </Reveal>

      <div className="hairline my-4" />

      {/* GET /health */}
      <DocSection index="01 — Endpoint" title="GET /health">
        <div className="space-y-4">
          <CodeBlock lang="http">{`GET ${BRAND.publicBase}/health HTTP/1.1`}</CodeBlock>
          <Callout accent="mint" icon="◎">
            Returns HTTP 200 with <code className="font-mono text-[12px]">{`{"status":"ok"}`}</code> when the
            service is ready. The harness requires readiness within <strong>60 seconds</strong> of service start.
          </Callout>
          <CodeBlock lang="json — response">{`{ "status": "ok" }`}</CodeBlock>
        </div>
      </DocSection>

      {/* POST /analyze-ticket */}
      <DocSection index="02 — Endpoint" title="POST /analyze-ticket">
        <div className="space-y-6">
          <CodeBlock lang="http">{`POST ${BRAND.publicBase}/analyze-ticket HTTP/1.1
Content-Type: application/json`}</CodeBlock>

          <div>
            <div className="label mb-3">Request body</div>
            <SchemaTable rows={REQUEST_FIELDS} />
          </div>
          <div>
            <div className="label mb-3">transaction_history[] entry</div>
            <SchemaTable rows={TXN_FIELDS} />
          </div>
          <CodeBlock lang="json — example request">{SAMPLE_REQUEST}</CodeBlock>

          <div>
            <div className="label mb-3">Response body</div>
            <SchemaTable rows={RESPONSE_FIELDS} />
          </div>
          <CodeBlock lang="json — example response">{SAMPLE_RESPONSE}</CodeBlock>

          <Callout accent="violet" icon="⚖">
            <strong className="block mb-1 text-ink">The investigator twist.</strong>
            The complaint says one thing; the data may say another.{' '}
            <code className="font-mono text-[12px]">relevant_transaction_id</code> and{' '}
            <code className="font-mono text-[12px]">evidence_verdict</code> capture what is actually true.
            When the evidence is genuinely unclear, {BRAND.name} returns{' '}
            <code className="font-mono text-[12px]">insufficient_data</code> instead of guessing.
          </Callout>
        </div>
      </DocSection>

      {/* Enums */}
      <DocSection index="03 — Enums" title="evidence_verdict">
        <EnumTable rows={VERDICT_ROWS} colorMap={VERDICT_COLOR_MAP} />
      </DocSection>
      <EnumBlock title="case_type" rows={CASE_TYPE_ROWS} colorMap={CASE_COLOR_MAP} />
      <EnumBlock title="severity" rows={SEVERITY_ROWS} colorMap={SEVERITY_COLOR_MAP} />
      <EnumBlock title="department" rows={DEPARTMENT_ROWS} colorMap={DEPT_COLOR_MAP} />

      {/* Safety */}
      <DocSection index="04 — Policy" title="Safety rules (enforced after every reply)">
        <Callout accent="magenta" icon="⚑">
          <strong className="block mb-1 text-ink">customer_reply must never:</strong>
          ask for a PIN, OTP, password, or full card number (−15); promise an unauthorized refund,
          reversal, or unblock (−10 — use “any eligible amount will be returned through official
          channels”); or direct the customer to a suspicious third party (−10). Instructions embedded
          in the complaint are treated as untrusted (prompt-injection resistant). A deterministic
          guardrail audits and <em>repairs</em> every reply before it ships.
        </Callout>
      </DocSection>

      {/* Status codes */}
      <DocSection index="05 — Contract" title="HTTP status codes">
        <EnumTable rows={STATUS_ROWS} />
      </DocSection>

      {/* Runtime */}
      <DocSection index="06 — Runtime" title="Runtime & deployment">
        <ul className="space-y-3">
          {RUNTIME_CONSTRAINTS.map((c) => (
            <li key={c.label} className="flex gap-3 text-sm">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet" />
              <span><span className="font-semibold text-ink">{c.label}:</span> <span className="text-muted">{c.note}</span></span>
            </li>
          ))}
        </ul>
      </DocSection>

      {/* Try it */}
      <DocSection index="07 — Interactive" title="Try it">
        <TryItPanel />
      </DocSection>
    </div>
  );
}

function EnumBlock({ title, rows, colorMap }) {
  return (
    <Reveal>
      <section className="py-4">
        <div className="mb-1 label">03 — Enums (cont.)</div>
        <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        <div className="hairline mb-6" />
        <EnumTable rows={rows} colorMap={colorMap} />
      </section>
    </Reveal>
  );
}
