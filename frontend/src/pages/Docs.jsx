import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/cn.js';
import { api } from '../lib/api.js';
import { SeverityBadge, CaseTag, DeptTag, Tag } from '../components/ui/Badge.jsx';
import { JsonViewer } from '../components/ui/JsonViewer.jsx';
import { PageHeader, Spinner } from '../components/ui/PageHeader.jsx';
import Reveal from '../components/ui/Reveal.jsx';

/* ─── Helpers ─────────────────────────────────────────────── */
function rand4() {
  return Math.floor(1000 + Math.random() * 9000);
}

/* ─── Schema table ────────────────────────────────────────── */
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

/* ─── Enum table ──────────────────────────────────────────── */
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
                  <code
                    className="font-mono text-[12px] font-semibold"
                    style={color ? { color } : undefined}
                  >
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

/* ─── Code block ──────────────────────────────────────────── */
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
        <button
          onClick={copy}
          className="text-xs font-medium text-faint transition hover:text-ink"
          data-cursor="hover"
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink/90 tnum">
        {children.trim()}
      </pre>
    </div>
  );
}

/* ─── Section wrapper ─────────────────────────────────────── */
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

/* ─── Callout ─────────────────────────────────────────────── */
function Callout({ accent = 'mint', icon, children }) {
  const colorMap = {
    mint: 'var(--accent-mint)',
    magenta: 'var(--accent-magenta)',
    violet: 'var(--accent-violet)',
    champagne: 'var(--champagne)',
  };
  const raw = colorMap[accent] || colorMap.mint;
  // Convert CSS var to inline style via inline custom prop fallback
  const accentStyle = {
    mint: { borderColor: '#28E0C8', background: 'rgba(40,224,200,0.06)', color: '#28E0C8' },
    magenta: { borderColor: '#FF3D81', background: 'rgba(255,61,129,0.07)', color: '#FF3D81' },
    violet: { borderColor: '#7A5CFF', background: 'rgba(122,92,255,0.07)', color: '#7A5CFF' },
    champagne: { borderColor: '#D9C6A3', background: 'rgba(217,198,163,0.07)', color: '#D9C6A3' },
  }[accent] || {};

  return (
    <div
      className="flex gap-4 rounded-2xl border p-5"
      style={{ borderColor: accentStyle.borderColor, background: accentStyle.background }}
    >
      {icon && (
        <span
          className="flex-shrink-0 text-lg leading-none"
          style={{ color: accentStyle.color }}
        >
          {icon}
        </span>
      )}
      <div className="text-sm leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}

/* ─── Schema data ─────────────────────────────────────────── */
const REQUEST_FIELDS = [
  { field: 'ticket_id', type: 'string', required: true, notes: 'Echoed verbatim in the response — use your own ID scheme.' },
  { field: 'message', type: 'string', required: true, notes: 'Raw customer message text. Bangla, English, or mixed.' },
  { field: 'channel', type: 'string', required: false, notes: 'app | sms | call_center | merchant_portal' },
  { field: 'locale', type: 'string', required: false, notes: 'bn | en | mixed — used to tune language handling.' },
];

const RESPONSE_FIELDS = [
  { field: 'ticket_id', type: 'string', required: false, notes: 'Echoed from the request.' },
  { field: 'case_type', type: 'enum', required: false, notes: 'One of five case categories.' },
  { field: 'severity', type: 'enum', required: false, notes: 'low | medium | high | critical' },
  { field: 'department', type: 'enum', required: false, notes: 'Routing destination for this ticket.' },
  { field: 'agent_summary', type: 'string', required: false, notes: 'One-sentence summary safe for an agent to read.' },
  { field: 'human_review_required', type: 'boolean', required: false, notes: 'true for critical or phishing tickets.' },
  { field: 'confidence', type: 'float [0..1]', required: false, notes: 'Classification confidence score.' },
];

const CASE_TYPE_ROWS = [
  { value: 'wrong_transfer', meaning: 'Money sent to the wrong recipient.' },
  { value: 'payment_failed', meaning: 'Transaction failed but balance may be deducted.' },
  { value: 'refund_request', meaning: 'Customer is asking for a refund.' },
  { value: 'phishing_or_social_engineering', meaning: 'Suspicious calls/SMS, or someone asking for PIN/OTP/password.' },
  { value: 'other', meaning: 'Anything not covered by the above categories.' },
];

const SEVERITY_ROWS = [
  { value: 'low', meaning: 'Minor issue; can be handled in standard queue time.' },
  { value: 'medium', meaning: 'Moderate impact; elevated priority.' },
  { value: 'high', meaning: 'Significant financial or account risk.' },
  { value: 'critical', meaning: 'Immediate action required; triggers Sentinel escalation.' },
];

const DEPARTMENT_ROWS = [
  { value: 'customer_support', meaning: 'other, low-severity refunds.' },
  { value: 'dispute_resolution', meaning: 'wrong_transfer, contested refunds.' },
  { value: 'payments_ops', meaning: 'payment_failed cases.' },
  { value: 'fraud_risk', meaning: 'phishing_or_social_engineering — all cases.' },
];

const SEVERITY_COLOR_MAP = {
  low: '#5FB587',
  medium: '#E0B23C',
  high: '#F0743A',
  critical: '#FF3B5C',
};

const CASE_COLOR_MAP = {
  wrong_transfer: '#7A5CFF',
  payment_failed: '#E0B23C',
  refund_request: '#34C7E0',
  phishing_or_social_engineering: '#FF3D81',
  other: '#8A857C',
};

const DEPT_COLOR_MAP = {
  customer_support: '#34C7E0',
  dispute_resolution: '#7A5CFF',
  payments_ops: '#E0B23C',
  fraud_risk: '#FF3D81',
};

const RUNTIME_CONSTRAINTS = [
  { label: 'Health endpoint', note: 'GET /health must respond in < 10 seconds.' },
  { label: 'Sort endpoint', note: 'POST /sort-ticket must respond in < 30 seconds.' },
  { label: 'Compute', note: 'Public HTTPS only. No GPU required. No secrets committed to the repo.' },
  { label: 'LLM', note: 'Optional — the system can run rules-only (fast path) or hybrid (LLM + rules).' },
  { label: 'Storage', note: 'SQLite for ticket persistence and analytics aggregation.' },
];

/* ─── Try-it form ─────────────────────────────────────────── */
function TryItPanel() {
  const [ticketId] = useState(() => `DOC-${rand4()}`);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('app');
  const [locale, setLocale] = useState('en');

  const { mutate, isPending, data: result, error, isError, reset } = useMutation({
    mutationFn: () =>
      api.sortTicket({ ticket_id: ticketId, channel, locale, message }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    mutate();
  };

  return (
    <div className="card p-6">
      <div className="label mb-4">Interactive Try-it</div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label mb-1 block">ticket_id</label>
          <code className="block rounded-lg border border-hairline bg-base/60 px-3 py-2 font-mono text-sm text-violet">
            {ticketId}
          </code>
        </div>

        <div>
          <label htmlFor="try-message" className="label mb-1 block">message <span className="text-magenta">required</span></label>
          <textarea
            id="try-message"
            value={message}
            onChange={(e) => { setMessage(e.target.value); reset(); }}
            rows={3}
            placeholder="e.g. ভুল নাম্বারে ৫০০০ টাকা চলে গেছে, ফেরত দিন"
            className="w-full resize-none rounded-xl border border-hairline bg-base/60 px-4 py-3 font-sans text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none"
            data-cursor="hover"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="try-channel" className="label mb-1 block">channel</label>
            <select
              id="try-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-base/60 px-3 py-2.5 text-sm text-ink focus:border-violet focus:outline-none"
            >
              <option value="app">app</option>
              <option value="sms">sms</option>
              <option value="call_center">call_center</option>
              <option value="merchant_portal">merchant_portal</option>
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="try-locale" className="label mb-1 block">locale</label>
            <select
              id="try-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-base/60 px-3 py-2.5 text-sm text-ink focus:border-violet focus:outline-none"
            >
              <option value="en">en</option>
              <option value="bn">bn</option>
              <option value="mixed">mixed</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || !message.trim()}
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          data-cursor="hover"
        >
          {isPending ? <><Spinner size={14} /> Classifying…</> : 'Classify'}
        </button>
      </form>

      <AnimatePresence>
        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-sev-critical/30 bg-sev-critical/10 px-4 py-3 text-sm text-sev-critical"
          >
            {error?.message || 'Request failed'}
          </motion.div>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 space-y-4"
          >
            <div className="hairline" />
            <div className="label">Classification Result</div>
            <div className="flex flex-wrap gap-2">
              <CaseTag caseType={result.case_type} />
              <SeverityBadge severity={result.severity} />
              <DeptTag dept={result.department} />
              {result.human_review_required && (
                <Tag color="#FF3B5C">Escalated to Sentinel</Tag>
              )}
            </div>
            <JsonViewer data={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function Docs() {
  return (
    <div className="shell pb-24">
      <PageHeader
        index="05"
        title="API & Docs"
        subtitle="Two endpoints. One JSON in, one JSON out."
      />

      {/* Overview */}
      <Reveal>
        <div className="max-w-2xl py-4">
          <p className="text-base leading-relaxed text-muted">
            QueueStorm exposes a minimal, opinionated HTTP API.{' '}
            <span className="text-ink">POST /sort-ticket</span> reads a raw customer message
            and returns a structured classification — case type, severity, routing department,
            a one-sentence agent summary, and a confidence score.{' '}
            <span className="text-ink">GET /health</span> confirms service liveness.
            Both endpoints speak plain JSON. No authentication required for the public demo instance.
          </p>
        </div>
      </Reveal>

      <div className="hairline my-8" />

      {/* ── GET /health ── */}
      <DocSection index="01 — Endpoint" title="GET /health">
        <div className="space-y-4">
          <CodeBlock lang="http">
{`GET ${api.base}/health HTTP/1.1`}
          </CodeBlock>
          <Callout accent="mint" icon="◎">
            Returns HTTP 200 with a JSON body when the service is operational.
            P99 response time target: <strong>&lt; 10 seconds</strong>. Use this endpoint for
            uptime monitoring, load-balancer health checks, and the Settings page live indicator.
          </Callout>
          <CodeBlock lang="json — response">
{`{
  "status": "ok"
}`}
          </CodeBlock>
        </div>
      </DocSection>

      {/* ── POST /sort-ticket ── */}
      <DocSection index="02 — Endpoint" title="POST /sort-ticket">
        <div className="space-y-6">
          <CodeBlock lang="http">
{`POST ${api.base}/sort-ticket HTTP/1.1
Content-Type: application/json`}
          </CodeBlock>

          {/* Request schema */}
          <div>
            <div className="label mb-3">Request Body</div>
            <SchemaTable rows={REQUEST_FIELDS} />
          </div>

          <CodeBlock lang="json — example request">
{`{
  "ticket_id": "T-001",
  "channel":   "app",
  "locale":    "en",
  "message":   "I sent 5000 taka to a wrong number this morning, please help me get it back"
}`}
          </CodeBlock>

          {/* Response schema */}
          <div>
            <div className="label mb-3">Response Body</div>
            <SchemaTable rows={RESPONSE_FIELDS} />
          </div>

          <CodeBlock lang="json — example response">
{`{
  "ticket_id":              "T-001",
  "case_type":              "wrong_transfer",
  "severity":               "high",
  "department":             "dispute_resolution",
  "agent_summary":          "Customer reports sending 5000 BDT to a wrong number and requests recovery.",
  "human_review_required":  true,
  "confidence":             0.85
}`}
          </CodeBlock>

          <Callout accent="champagne">
            P99 response time target: <strong>&lt; 30 seconds</strong>. The system
            runs a fast rules path (≈5ms), falling back to an LLM hybrid if needed (≈2–15s).
            The <code className="font-mono text-[12px] text-violet">method</code> field
            in stored ticket records indicates which path was taken.
          </Callout>
        </div>
      </DocSection>

      {/* ── Enums ── */}
      <DocSection index="03 — Enums" title="case_type">
        <EnumTable rows={CASE_TYPE_ROWS} colorMap={CASE_COLOR_MAP} />
      </DocSection>

      <Reveal>
        <section className="py-4">
          <div className="mb-1 label">03 — Enums (cont.)</div>
          <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">severity</h2>
          <div className="hairline mb-6" />
          <EnumTable rows={SEVERITY_ROWS} colorMap={SEVERITY_COLOR_MAP} />
        </section>
      </Reveal>

      <Reveal>
        <section className="py-4">
          <div className="mb-1 label">03 — Enums (cont.)</div>
          <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">department</h2>
          <div className="hairline mb-6" />
          <EnumTable rows={DEPARTMENT_ROWS} colorMap={DEPT_COLOR_MAP} />
        </section>
      </Reveal>

      {/* ── Safety rule ── */}
      <Reveal>
        <section className="py-8">
          <div className="mb-1 label">04 — Policy</div>
          <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">Safety Rule</h2>
          <div className="hairline mb-6" />
          <Callout accent="magenta" icon="⚑">
            <strong className="block mb-1 text-ink">The agent_summary field must NEVER instruct
            the customer to share their PIN, OTP, password, or full card number.</strong>
            This is enforced at runtime by a policy-safety check on every generated summary and draft reply.
            Any output violating this rule is flagged, blocked, and escalated to Sentinel.
            The <code className="font-mono text-[12px]">safety_passed</code> field
            in stored records tracks compliance per ticket.
          </Callout>
        </section>
      </Reveal>

      {/* ── Runtime constraints ── */}
      <DocSection index="05 — Deployment" title="Runtime Constraints">
        <ul className="space-y-3">
          {RUNTIME_CONSTRAINTS.map((c) => (
            <li key={c.label} className="flex gap-3 text-sm">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet mt-2" />
              <span>
                <span className="font-semibold text-ink">{c.label}:</span>{' '}
                <span className="text-muted">{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </DocSection>

      {/* ── Try it ── */}
      <Reveal>
        <section className="py-8">
          <div className="mb-1 label">06 — Interactive</div>
          <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">Try it</h2>
          <div className="hairline mb-6" />
          <TryItPanel />
        </section>
      </Reveal>
    </div>
  );
}
