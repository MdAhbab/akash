import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/cn.js';
import { api } from '../lib/api.js';
import { SEVERITY_COLOR, DEPT_COLOR, label, timeAgo, countdown } from '../lib/format.js';
import { SeverityBadge, CaseTag, DeptTag, Tag } from '../components/ui/Badge.jsx';
import { ConfidenceDial, SeverityGauge } from '../components/ui/Gauge.jsx';
import { JsonViewer } from '../components/ui/JsonViewer.jsx';
import { PageHeader, PageLoader, Spinner } from '../components/ui/PageHeader.jsx';
import Reveal from '../components/ui/Reveal.jsx';

/* ─── Routing path stepper ─────────────────────────────────── */
function RoutingStepper({ dept, humanReview }) {
  const steps = [
    { id: 'received', label: 'Received' },
    { id: 'classified', label: 'Classified' },
    { id: 'routed', label: `Routed → ${label.dept(dept)}` },
    ...(humanReview ? [{ id: 'flagged', label: 'Flagged' }, { id: 'sentinel', label: 'Sentinel', critical: true }] : []),
  ];

  return (
    <div className="relative flex items-center gap-0 overflow-x-auto no-scrollbar py-2">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const deptColor = dept ? DEPT_COLOR[dept] : undefined;
        return (
          <div key={step.id} className="flex flex-shrink-0 items-center">
            {/* Node */}
            <div className="relative flex flex-col items-center gap-1.5">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold',
                  step.critical
                    ? 'animate-pulse-critical border-sev-critical bg-sev-critical/10 text-sev-critical'
                    : i === steps.length - 1
                    ? 'border-mint bg-mint/10 text-mint'
                    : 'border-line bg-elevated text-muted',
                )}
                style={i === 2 && deptColor ? { borderColor: deptColor, color: deptColor, background: `${deptColor}18` } : undefined}
              >
                {i + 1}
              </motion.div>
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 + 0.1, duration: 0.4 }}
                className={cn(
                  'max-w-[80px] text-center text-[10px] leading-tight',
                  step.critical ? 'font-semibold text-sev-critical' : 'text-faint',
                )}
              >
                {step.label}
              </motion.span>
            </div>
            {/* Connector line */}
            {!isLast && (
              <div className="relative mx-1 mt-[-14px] flex-shrink-0" style={{ width: 32 }}>
                <div className="h-px w-full bg-line" />
                <motion.div
                  className="absolute inset-0 h-px origin-left"
                  style={{ background: step.critical ? '#FF3B5C' : deptColor || 'rgb(var(--accent-mint))' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.12 + 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── SLA countdown (live) ─────────────────────────────────── */
function SLATimer({ slaDue }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = countdown(slaDue);
  const isOverdue = new Date(slaDue).getTime() < Date.now();
  return (
    <span className={cn('font-mono tnum text-sm font-medium', isOverdue ? 'text-sev-critical' : 'text-mint')}>
      {isOverdue ? 'OVERDUE ' : ''}{remaining}
    </span>
  );
}

/* ─── Indicator chip humanizer ──────────────────────────────── */
function humanizeIndicator(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Method chip ───────────────────────────────────────────── */
function MethodChip({ method }) {
  const map = { rules: '#34C7E0', gemma: '#7A5CFF', hybrid: '#D9C6A3' };
  const color = map[method] || '#8A857C';
  return (
    <Tag color={color}>{method}</Tag>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function TicketDetail() {
  const { id } = useParams();

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.ticket(id),
    retry: 1,
  });

  const replyMutation = useMutation({
    mutationFn: () => api.reply(id),
  });

  if (isLoading) {
    return (
      <div className="shell">
        <PageHeader title={id} subtitle="Loading ticket…" />
        <PageLoader label="Fetching ticket" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="shell">
        <PageHeader title="Ticket not found" />
        <div className="py-16 text-center">
          <p className="mb-2 font-display text-3xl font-semibold text-muted">
            We lost this one.
          </p>
          <p className="mb-8 text-sm text-faint">
            {error?.message || 'Ticket does not exist or could not be loaded.'}
          </p>
          <Link to="/console" className="btn btn-ghost" data-cursor="hover">
            Back to Console
          </Link>
        </div>
      </div>
    );
  }

  const { ticket, classification: cls, review, replies } = data || {};
  const latestReply = replyMutation.data || (replies?.length ? replies[replies.length - 1] : null);

  return (
    <div className="shell pb-24">
      <PageHeader
        index="↩"
        title={ticket?.ticket_id || id}
        kicker="Ticket Detail"
        subtitle={`Received ${timeAgo(ticket?.received_at)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Left column ────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Original Message */}
          <Reveal>
            <section className="card p-6">
              <div className="label mb-4">Original Message</div>
              <p
                className={cn(
                  'text-base leading-relaxed text-ink',
                  ticket?.locale === 'bn' ? 'font-bn text-lg' : 'font-sans',
                )}
              >
                {ticket?.message || '—'}
              </p>
              <div className="hairline my-4" />
              <div className="flex flex-wrap gap-4">
                <div>
                  <div className="label mb-1">Channel</div>
                  <span className="font-mono text-sm text-muted">
                    {ticket?.channel || '—'}
                  </span>
                </div>
                <div>
                  <div className="label mb-1">Locale</div>
                  <span className="font-mono text-sm text-muted">
                    {ticket?.locale || '—'}
                  </span>
                </div>
                <div>
                  <div className="label mb-1">Received</div>
                  <span className="font-mono text-sm text-muted tnum">
                    {timeAgo(ticket?.received_at)}
                  </span>
                </div>
              </div>
            </section>
          </Reveal>

          {/* Classification panel */}
          {cls ? (
            <Reveal delay={0.05}>
              <section className="card p-6">
                <div className="label mb-5">Classification</div>
                <div className="flex flex-wrap gap-2 mb-5">
                  <CaseTag caseType={cls.case_type} />
                  <SeverityBadge severity={cls.severity} />
                  <DeptTag dept={cls.department} />
                  <MethodChip method={cls.method} />
                  {/* Safety chip */}
                  {cls.safety_passed !== undefined && (
                    <Tag color={cls.safety_passed ? '#28E0C8' : '#FF3B5C'}>
                      {cls.safety_passed ? 'Safety ✓ passed' : 'Safety ✗ failed'}
                    </Tag>
                  )}
                </div>

                {/* Human review pill */}
                {cls.human_review_required && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-5 inline-flex items-center gap-2 rounded-full border border-sev-critical/40 bg-sev-critical/10 px-4 py-2 text-sm font-semibold text-sev-critical animate-pulse-critical"
                  >
                    <span className="h-2 w-2 rounded-full bg-sev-critical" />
                    Escalated to Sentinel
                  </motion.div>
                )}

                {/* Agent summary */}
                {cls.agent_summary && (
                  <blockquote className="relative mb-5 border-l-2 border-violet pl-4 italic text-muted">
                    <span className="absolute -left-1 -top-2 font-serif text-3xl leading-none text-violet/30">"</span>
                    {cls.agent_summary}
                  </blockquote>
                )}

                <div className="hairline my-4" />

                {/* Routing path replay */}
                <div className="label mb-3">Routing Path</div>
                <RoutingStepper dept={cls.department} humanReview={cls.human_review_required} />
              </section>
            </Reveal>
          ) : (
            <Reveal delay={0.05}>
              <div className="card p-6 text-faint italic">
                No classification yet — run the triage agent.
              </div>
            </Reveal>
          )}

          {/* Review block */}
          {review && (
            <Reveal delay={0.1}>
              <section className="card p-6">
                <div className="label mb-5">Sentinel Review</div>
                <div className="flex flex-wrap items-start gap-6">
                  {/* Risk score bar */}
                  <div className="flex-1 min-w-[160px]">
                    <div className="label mb-2">Risk Score</div>
                    <div className="mb-1 font-mono text-2xl font-medium tnum text-ink">
                      {Math.round((review.risk_score || 0) * 100)}
                      <span className="text-sm text-faint">/100</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-elevated">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            review.risk_score > 0.75
                              ? '#FF3B5C'
                              : review.risk_score > 0.5
                              ? '#F0743A'
                              : '#5FB587',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(review.risk_score || 0) * 100}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>

                  {/* SLA */}
                  {review.sla_due && (
                    <div>
                      <div className="label mb-2">SLA Due</div>
                      <SLATimer slaDue={review.sla_due} />
                    </div>
                  )}

                  {/* Status */}
                  {review.status && (
                    <div>
                      <div className="label mb-2">Status</div>
                      <Tag color="#34C7E0">{review.status}</Tag>
                    </div>
                  )}
                </div>

                {/* Indicators */}
                {review.indicators?.length > 0 && (
                  <div className="mt-4">
                    <div className="label mb-2">Risk Indicators</div>
                    <div className="flex flex-wrap gap-2">
                      {review.indicators.map((ind) => (
                        <Tag key={ind} color="#FF3D81">
                          {humanizeIndicator(ind)}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasons */}
                {review.reasons?.length > 0 && (
                  <div className="mt-4">
                    <div className="label mb-2">Analysis</div>
                    <ul className="space-y-1">
                      {review.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm text-muted">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-magenta" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </Reveal>
          )}

          {/* Copilot reply */}
          <Reveal delay={0.15}>
            <section className="card p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="label mb-1">Copilot Reply</div>
                  <p className="text-sm text-faint">Safe, policy-compliant draft reply for this ticket.</p>
                </div>
                <button
                  className="btn btn-ghost"
                  data-cursor="hover"
                  onClick={() => replyMutation.mutate()}
                  disabled={replyMutation.isPending}
                >
                  {replyMutation.isPending ? (
                    <><Spinner size={14} /> Generating</>
                  ) : (
                    'Generate safe reply'
                  )}
                </button>
              </div>

              <AnimatePresence>
                {replyMutation.isError && (
                  <motion.div
                    key="reply-error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 rounded-xl border border-sev-critical/30 bg-sev-critical/10 px-4 py-3 text-sm text-sev-critical"
                  >
                    {replyMutation.error?.message || 'Failed to generate reply.'}
                  </motion.div>
                )}

                {latestReply && (
                  <motion.div
                    key="reply-result"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-3"
                  >
                    {/* Policy badge */}
                    <div className="flex items-center gap-2">
                      <Tag color={latestReply.policy_passed ? '#28E0C8' : '#FF3B5C'}>
                        {latestReply.policy_passed ? 'Policy ✓ passed' : 'Policy ✗ failed'}
                      </Tag>
                      {latestReply.method && <MethodChip method={latestReply.method} />}
                    </div>

                    {/* Draft */}
                    <div className="card rounded-2xl border-hairline bg-base/60 p-4">
                      <div className="label mb-2">Draft Reply</div>
                      <p className="text-sm leading-relaxed text-ink">{latestReply.draft}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!latestReply && !replyMutation.isPending && !replyMutation.isError && (
                <p className="text-sm text-faint italic">
                  Click "Generate safe reply" to produce a Copilot-drafted response.
                </p>
              )}
            </section>
          </Reveal>
        </div>

        {/* ── Right column ─────────────────────────────────── */}
        <div className="space-y-6">

          {/* Confidence dial + severity gauge side-by-side */}
          {cls && (
            <Reveal>
              <div className="card p-6">
                <div className="label mb-5">Classification Metrics</div>
                <div className="flex items-center justify-around gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <ConfidenceDial value={cls.confidence} size={100} />
                    <div className="label">Confidence</div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <SeverityGauge severity={cls.severity} height={100} />
                    <div className="label">Severity</div>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          {/* Raw JSON */}
          {cls && (
            <Reveal delay={0.05}>
              <JsonViewer data={cls} className="overflow-hidden" />
            </Reveal>
          )}

          {/* Back navigation */}
          <Reveal delay={0.1}>
            <div className="flex flex-col gap-2">
              <Link
                to="/console"
                className="btn btn-ghost w-full justify-center text-center"
                data-cursor="hover"
              >
                Back to Console
              </Link>
              <Link
                to="/sentinel"
                className="btn btn-ghost w-full justify-center text-center"
                data-cursor="hover"
              >
                Open Sentinel
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
