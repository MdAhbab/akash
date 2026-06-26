/**
 * Sentinel Review Queue — sorted list of flagged tickets.
 * Each card: ticket_id, SeverityBadge, risk bar, message snippet,
 * indicator Tags, SLA countdown (1s interval), action buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { countdown, SEVERITY_COLOR } from '../../lib/format.js';
import { SeverityBadge, Tag } from '../ui/Badge.jsx';
import { Spinner } from '../ui/PageHeader.jsx';
import { api } from '../../lib/api.js';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/cn.js';

const INDICATOR_LABELS = {
  otp_request: 'OTP Request',
  urgency: 'Urgency',
  impersonation: 'Impersonation',
  link_bait: 'Suspicious Link',
  payout_bait: 'Reward Bait',
  account_threat: 'Account Threat',
  bn_scam: 'Bangla Scam',
};

const STATUS_COLORS = {
  open: '#7A5CFF',
  claimed: '#28E0C8',
  escalated: '#FF3B5C',
  safe: '#5FB587',
};

const STATUS_LABELS = {
  open: 'Open',
  claimed: 'Claimed',
  escalated: 'Escalated',
  safe: 'Safe',
};

/* Live SLA countdown — re-renders every second */
function SlaCountdown({ slaDue, className }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const val = countdown(slaDue);
  const overdue = slaDue && Date.now() > new Date(slaDue).getTime();

  return (
    <span
      className={cn(
        'tnum font-mono text-xs tabular-nums',
        overdue ? 'text-[#FF3B5C] animate-pulse-critical' : 'text-muted',
        className,
      )}
      aria-live="polite"
      aria-label={`SLA ${overdue ? 'overdue by' : 'in'} ${val}`}
    >
      {overdue ? '-' : ''}{val}
    </span>
  );
}

/* Risk score bar */
function RiskBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color =
    pct >= 90
      ? '#FF3B5C'
      : pct >= 70
      ? '#F0743A'
      : pct >= 40
      ? '#E0B23C'
      : '#5FB587';

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 flex-1 rounded-full"
        style={{ background: 'var(--line-strong)' }}
        role="presentation"
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="tnum font-mono text-xs text-muted w-8 text-right" aria-label={`Risk ${pct}%`}>
        {pct}%
      </span>
    </div>
  );
}

/* Single review card */
function ReviewCard({ review, index }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null); // which action is loading

  const act = useCallback(
    async (status) => {
      setPending(status);
      try {
        await api.setReviewStatus(review.ticket_id, status);
        await qc.invalidateQueries({ queryKey: ['reviews'] });
      } catch (e) {
        console.error('setReviewStatus failed', e);
      } finally {
        setPending(null);
      }
    },
    [review.ticket_id, qc],
  );

  const isCritical = review.severity === 'critical';
  const indicators = review.indicators || [];
  const statusColor = STATUS_COLORS[review.status] || '#8A857C';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'card relative overflow-hidden',
        'px-5 py-4 flex flex-col gap-3',
        isCritical && 'ring-1 ring-[#FF3B5C33]',
      )}
    >
      {/* Critical accent bar */}
      {isCritical && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5 animate-pulse-critical"
          style={{ background: '#FF3B5C' }}
          aria-hidden="true"
        />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            className="font-mono text-sm text-violet hover:text-ink transition-colors truncate"
            onClick={() => navigate(`/ticket/${review.ticket_id}`)}
            data-cursor="pointer"
            aria-label={`Open ticket ${review.ticket_id}`}
          >
            {review.ticket_id}
          </button>
          <SeverityBadge severity={review.severity} />
        </div>

        {/* Status chip */}
        <span
          className="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            color: statusColor,
            background: `${statusColor}14`,
            border: `1px solid ${statusColor}33`,
          }}
        >
          {STATUS_LABELS[review.status] || review.status}
        </span>
      </div>

      {/* Risk bar */}
      <RiskBar score={review.risk_score} />

      {/* Message snippet */}
      {review.message && (
        <p className="text-sm text-muted leading-relaxed line-clamp-2">
          {review.message}
        </p>
      )}

      {/* Agent summary if available */}
      {review.agent_summary && (
        <p className="text-xs text-faint italic leading-relaxed border-l-2 pl-2"
          style={{ borderColor: 'var(--line-strong)' }}>
          {review.agent_summary}
        </p>
      )}

      {/* Indicator tags */}
      {indicators.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Threat indicators">
          {indicators.map((key) => (
            <Tag
              key={key}
              color={key === 'otp_request' ? '#FF3B5C' : key === 'impersonation' ? '#F0743A' : '#E0B23C'}
              role="listitem"
            >
              {INDICATOR_LABELS[key] || key}
            </Tag>
          ))}
        </div>
      )}

      {/* Reasons */}
      {review.reasons && review.reasons.length > 0 && (
        <ul className="text-xs text-faint space-y-0.5 list-none pl-0">
          {review.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 leading-snug">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
              {r}
            </li>
          ))}
        </ul>
      )}

      {/* Footer: SLA + actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="label" style={{ fontSize: '0.6rem' }}>SLA</span>
          <SlaCountdown slaDue={review.sla_due} />
        </div>

        <div className="flex items-center gap-2">
          {review.status !== 'claimed' && review.status !== 'safe' && (
            <button
              className="btn btn-ghost py-1.5 px-3 text-xs min-w-[3rem] min-h-[2.5rem]"
              onClick={() => act('claimed')}
              disabled={!!pending}
              data-cursor="pointer"
              aria-label="Claim this ticket"
            >
              {pending === 'claimed' ? <Spinner size={12} /> : 'Claim'}
            </button>
          )}
          {review.status !== 'escalated' && review.status !== 'safe' && (
            <button
              className="btn py-1.5 px-3 text-xs min-h-[2.5rem]"
              style={{
                background: '#FF3B5C18',
                color: '#FF3B5C',
                border: '1px solid #FF3B5C44',
                borderRadius: '999px',
                minWidth: '5rem',
              }}
              onClick={() => act('escalated')}
              disabled={!!pending}
              data-cursor="pointer"
              aria-label="Escalate this ticket"
            >
              {pending === 'escalated' ? <Spinner size={12} /> : 'Escalate'}
            </button>
          )}
          {review.status !== 'safe' && (
            <button
              className="btn py-1.5 px-3 text-xs min-h-[2.5rem]"
              style={{
                background: '#5FB58718',
                color: '#5FB587',
                border: '1px solid #5FB58744',
                borderRadius: '999px',
                minWidth: '5.5rem',
              }}
              onClick={() => act('safe')}
              disabled={!!pending}
              data-cursor="pointer"
              aria-label="Mark ticket as safe"
            >
              {pending === 'safe' ? <Spinner size={12} /> : 'Mark safe'}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function ReviewQueue({ reviews = [] }) {
  const sorted = [...reviews].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

  if (sorted.length === 0) return null;

  return (
    <section aria-label="Review queue">
      <div className="flex items-center justify-between mb-4">
        <h2 className="label" style={{ fontSize: '0.7rem', letterSpacing: '0.16em' }}>
          Review Queue
        </h2>
        <span className="tnum text-xs text-muted">
          {sorted.length} case{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        className="flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar"
        style={{ maxHeight: 'min(70vh, 640px)' }}
      >
        <AnimatePresence mode="popLayout">
          {sorted.map((r, i) => (
            <ReviewCard key={r.ticket_id} review={r} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
