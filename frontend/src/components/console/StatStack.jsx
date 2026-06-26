// StatStack - right-rail real-time statistics panel.
import { motion, AnimatePresence } from 'framer-motion';
import { StatTile, useCountUp } from '../ui/StatTile.jsx';
import { SEVERITY_COLOR, DEPT_COLOR, label } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const SEV_ORDER = ['critical', 'high', 'medium', 'low'];
const DEPT_ORDER = ['customer_support', 'dispute_resolution', 'payments_ops', 'fraud_risk'];

// Animated stacked bar for severity distribution
function SeverityBar({ bySeverity }) {
  const total = (bySeverity ?? []).reduce((sum, d) => sum + d.n, 0) || 1;
  const sorted = SEV_ORDER.map((s) => ({
    severity: s,
    n: bySeverity?.find((d) => d.severity === s)?.n ?? 0,
  }));

  return (
    <div className="space-y-3">
      <div className="label">Severity Mix</div>
      {/* Stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-elevated">
        {sorted.map(({ severity, n }) => (
          <motion.div
            key={severity}
            className="h-full"
            initial={{ width: 0 }}
            animate={{ width: `${(n / total) * 100}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: SEVERITY_COLOR[severity] }}
            title={`${label.severity(severity)}: ${n}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {sorted.map(({ severity, n }) => (
          <div key={severity} className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: SEVERITY_COLOR[severity] }}
              />
              <span className="text-xs text-muted">{label.severity(severity)}</span>
            </div>
            <span className="tnum text-xs font-semibold text-ink">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Department load bars
function DeptBars({ byDept }) {
  const maxN = Math.max(...(byDept ?? []).map((d) => d.n), 1);

  return (
    <div className="space-y-3">
      <div className="label">Department Load</div>
      <div className="space-y-2.5">
        {DEPT_ORDER.map((dept) => {
          const n = byDept?.find((d) => d.department === dept)?.n ?? 0;
          const pct = (n / maxN) * 100;
          const color = DEPT_COLOR[dept];
          return (
            <div key={dept} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{label.dept(dept)}</span>
                <span className="tnum text-xs font-semibold text-ink">{n}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-elevated">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Critical-in-queue counter with pulse
function CriticalCounter({ bySeverity }) {
  const critCount = bySeverity?.find((d) => d.severity === 'critical')?.n ?? 0;
  const display = useCountUp(critCount);

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all duration-500',
        critCount > 0
          ? 'border-sev-critical/40 bg-sev-critical/5'
          : 'border-hairline bg-surface',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="label" style={critCount > 0 ? { color: '#FF3B5C' } : {}}>
          04 - Critical Queue
        </div>
        {critCount > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-critical absolute inline-flex h-full w-full rounded-full bg-sev-critical opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sev-critical" />
          </span>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={critCount}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.35 }}
          className="mt-2 font-display text-4xl font-semibold tnum"
          style={{ color: critCount > 0 ? '#FF3B5C' : 'rgb(var(--text-primary))' }}
        >
          {display}
        </motion.div>
      </AnimatePresence>
      {critCount === 0 ? (
        <p className="mt-1 text-xs text-faint">No critical tickets in queue</p>
      ) : (
        <p className="mt-1 text-xs" style={{ color: '#FF3B5C80' }}>
          Requires immediate attention
        </p>
      )}
    </div>
  );
}

// Latency display
function LatencyTile({ latency }) {
  const avg = latency?.avg ?? 0;
  const max = latency?.max ?? 0;
  const avgDisplay = useCountUp(avg);

  // Color the latency based on performance
  const color = avg < 50 ? '#5FB587' : avg < 200 ? '#E0B23C' : '#F0743A';

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="label mb-2">05 - Latency</div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold tnum" style={{ color }}>
          {avgDisplay}
        </span>
        <span className="text-sm text-muted">ms avg</span>
      </div>
      <div className="mt-1 text-xs text-faint tnum">
        max {max}ms
      </div>
      <div className="mt-3 h-0.5 w-8 rounded-full" style={{ background: color }} />
    </div>
  );
}

export default function StatStack({ stats }) {
  const { total, flagged, openReviews, bySeverity, byDept, latency } = stats ?? {};

  return (
    <aside className="flex flex-col gap-4">
      <div className="label">03 - Real-Time Stats</div>

      {/* Mobile: horizontal snap carousel */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar lg:hidden">
        <div className="w-48 flex-none">
          <StatTile
            label="Total Tickets"
            value={total ?? 0}
            sub="all time"
            accent="rgb(var(--accent-violet))"
          />
        </div>
        <div className="w-48 flex-none">
          <StatTile
            label="Flagged"
            value={flagged ?? 0}
            sub="needs review"
            accent="#FF3B5C"
          />
        </div>
        <div className="w-48 flex-none">
          <StatTile
            label="Open Reviews"
            value={openReviews ?? 0}
            sub="in sentinel"
            accent="#F0743A"
          />
        </div>
        <div className="w-48 flex-none">
          <StatTile
            label="Avg Latency"
            value={latency?.avg ?? 0}
            suffix="ms"
            accent="#5FB587"
          />
        </div>
      </div>

      {/* Desktop: vertical stack */}
      <div className="hidden space-y-4 lg:block">
        {/* Top 3 stat tiles */}
        <StatTile
          label="01 - Total Tickets"
          value={total ?? 0}
          sub="classified by AI"
          accent="rgb(var(--accent-violet))"
        />

        <StatTile
          label="02 - Flagged"
          value={flagged ?? 0}
          sub="requires human review"
          accent="#FF3D81"
        />

        <StatTile
          label="03 - Open Reviews"
          value={openReviews ?? 0}
          sub="in sentinel queue"
          accent="#F0743A"
        />

        <div className="hairline" />

        {/* Severity distribution */}
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <SeverityBar bySeverity={bySeverity} />
        </div>

        <div className="hairline" />

        {/* Department load */}
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <DeptBars byDept={byDept} />
        </div>

        <div className="hairline" />

        {/* Latency */}
        <LatencyTile latency={latency} />

        <div className="hairline" />

        {/* Critical counter */}
        <CriticalCounter bySeverity={bySeverity} />
      </div>
    </aside>
  );
}
