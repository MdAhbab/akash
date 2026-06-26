/**
 * Threat Patterns Strip - aggregate indicator frequencies across all reviews.
 * Horizontal bar/legend showing which indicators are most common right now.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const INDICATOR_META = {
  otp_request:    { label: 'OTP Request',    color: '#FF3B5C' },
  urgency:        { label: 'Urgency',         color: '#F0743A' },
  impersonation:  { label: 'Impersonation',   color: '#FF3D81' },
  link_bait:      { label: 'Suspicious Link', color: '#E0B23C' },
  payout_bait:    { label: 'Reward Bait',     color: '#7A5CFF' },
  account_threat: { label: 'Account Threat',  color: '#F0743A' },
  bn_scam:        { label: 'Bangla Scam',     color: '#34C7E0' },
};

export default function PatternStrip({ reviews = [] }) {
  const patterns = useMemo(() => {
    const counts = {};
    for (const r of reviews) {
      for (const key of r.indicators || []) {
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return entries.map(([key, count]) => ({
      key,
      count,
      pct: (count / max) * 100,
      ...(INDICATOR_META[key] || { label: key, color: '#8A857C' }),
    }));
  }, [reviews]);

  if (patterns.length === 0) return null;

  return (
    <section aria-label="Threat pattern frequencies" className="mt-2">
      <div className="label mb-4" style={{ fontSize: '0.7rem', letterSpacing: '0.16em' }}>
        Active Threat Patterns
      </div>

      {/* Desktop: compact horizontal bars */}
      <div className="hidden lg:flex items-end gap-4 flex-wrap">
        {patterns.map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-1.5 min-w-[80px]"
          >
            {/* bar */}
            <div
              className="w-full relative"
              style={{
                height: `${Math.max(p.pct * 0.48 + 4, 6)}px`,
                background: `${p.color}22`,
                borderRadius: '2px 2px 0 0',
              }}
            >
              <motion.div
                className="absolute inset-x-0 bottom-0"
                style={{ background: p.color, borderRadius: '2px 2px 0 0' }}
                initial={{ height: 0 }}
                animate={{ height: `${p.pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            {/* label */}
            <div
              className="text-center"
              style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: p.color, textTransform: 'uppercase', fontWeight: 600 }}
            >
              {p.label}
            </div>
            <div className="tnum text-center text-xs text-muted" style={{ fontSize: '0.65rem' }}>
              ×{p.count}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mobile: horizontal rows */}
      <div className="flex flex-col gap-2 lg:hidden">
        {patterns.map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <span
              className="shrink-0 text-xs font-semibold"
              style={{ color: p.color, width: '110px', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              {p.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--line-strong)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: p.color }}
                initial={{ width: 0 }}
                animate={{ width: `${p.pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="tnum text-xs text-muted w-6 text-right shrink-0">×{p.count}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
