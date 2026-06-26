/**
 * Insights — F4: Analytics & Trends
 * Editorial data-report aesthetic. SVG charts, no external chart library.
 * Both Obsidian + Porcelain themes.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn.js';
import { api } from '../lib/api.js';
import { PageHeader, PageLoader } from '../components/ui/PageHeader.jsx';
import { StatTile } from '../components/ui/StatTile.jsx';
import Reveal from '../components/ui/Reveal.jsx';

import AreaTrend from '../components/insights/AreaTrend.jsx';
import CaseMixDonut from '../components/insights/CaseMixDonut.jsx';
import SeverityBars from '../components/insights/SeverityBars.jsx';
import DeptLoad from '../components/insights/DeptLoad.jsx';
import Funnel from '../components/insights/Funnel.jsx';

/* ─── Anomaly chip ───────────────────────────────────────────────────────── */
const ANOMALY_LABEL = {
  volume_spike:   'Volume spike',
  phishing_surge: 'Phishing surge',
  critical_load:  'Critical load',
};

function humanizeAnomaly(type) {
  return ANOMALY_LABEL[type] || String(type).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function AnomalyChip({ anomaly }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-1 rounded-lg border px-3.5 py-2.5"
      style={{
        borderColor: 'rgb(var(--accent-magenta) / 0.35)',
        background: 'rgb(var(--accent-magenta) / 0.06)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse-critical"
          style={{ background: 'rgb(var(--accent-magenta))' }}
        />
        <span
          className="label"
          style={{ color: 'rgb(var(--accent-magenta))', fontSize: '0.65rem' }}
        >
          {humanizeAnomaly(anomaly.type)}
        </span>
        {anomaly.day && (
          <span className="font-mono text-[10px] tnum text-faint ml-1">{anomaly.day}</span>
        )}
      </div>
      {anomaly.detail && (
        <p className="text-xs leading-snug text-muted">{anomaly.detail}</p>
      )}
    </motion.div>
  );
}

function CalmChip() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5"
      style={{
        borderColor: 'rgb(var(--accent-mint) / 0.3)',
        background: 'rgb(var(--accent-mint) / 0.06)',
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: 'rgb(var(--accent-mint))' }}
      />
      <span className="text-xs" style={{ color: 'rgb(var(--accent-mint))' }}>
        No anomalies in the last 7 days
      </span>
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────────────────────────── */
function ChartCard({ title, caption, children, className }) {
  return (
    <Reveal>
      <div className={cn('card p-6 md:p-8', className)}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="label mb-1">{caption}</div>
            <h3
              className="font-display text-base font-semibold leading-snug"
              style={{ color: 'rgb(var(--text-primary))' }}
            >
              {title}
            </h3>
          </div>
        </div>
        <div className="hairline mb-6" />
        {children}
      </div>
    </Reveal>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyInsights() {
  return (
    <Reveal>
      <div className="flex flex-col items-start gap-4 py-20">
        <div className="hairline w-12 mb-2" style={{ borderColor: 'rgb(var(--champagne))' }} />
        <p
          className="font-serif text-2xl leading-snug"
          style={{ color: 'rgb(var(--text-secondary))' }}
        >
          No data yet — classify tickets in the Playground to generate insights.
        </p>
        <Link
          to="/playground"
          className="btn btn-ghost mt-2"
          data-cursor="true"
        >
          Open Playground
        </Link>
      </div>
    </Reveal>
  );
}

/* ─── Error state ────────────────────────────────────────────────────────── */
function ErrorState({ retry }) {
  return (
    <div className="py-16 flex flex-col gap-4">
      <p className="text-muted">Failed to load insights data.</p>
      <button className="btn btn-ghost w-fit" onClick={retry} data-cursor="true">
        Retry
      </button>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Insights() {
  const statsQ = useQuery({ queryKey: ['stats'], queryFn: api.stats, staleTime: 30_000 });
  const insightsQ = useQuery({ queryKey: ['insights'], queryFn: api.insights, staleTime: 60_000 });

  const isLoading = statsQ.isLoading || insightsQ.isLoading;
  const isError = statsQ.isError || insightsQ.isError;

  const stats = statsQ.data;
  const insights = insightsQ.data;

  const retry = () => {
    statsQ.refetch();
    insightsQ.refetch();
  };

  // Compose unified stats (prefer insights.stats if available, fall back to direct stats)
  const s = insights?.stats || stats;

  const total = s?.total ?? 0;
  const flagged = s?.flagged ?? 0;
  const openReviews = s?.openReviews ?? 0;
  const latencyAvg = s?.latency?.avg ?? 0;
  const bySeverity = s?.bySeverity ?? [];
  const byCase = s?.byCase ?? [];
  const byDept = s?.byDept ?? [];
  const recent = s?.recent ?? [];

  const narrative = insights?.narrative ?? '';
  const anomalies = insights?.anomalies ?? [];

  return (
    <div className="shell">
      <PageHeader
        index="04"
        title="Insights"
        subtitle="What the data is telling you — trends, case mix, and anomalies."
      />

      {isLoading && <PageLoader label="Loading insights" />}
      {!isLoading && isError && <ErrorState retry={retry} />}

      {!isLoading && !isError && (
        <>
          {/* ── NARRATIVE + ANOMALIES ──────────────────────────────── */}
          {(narrative || anomalies.length > 0) && (
            <Reveal>
              <section className="mb-16 grid gap-8 lg:grid-cols-[1fr_320px]">
                {/* Pull-quote */}
                <div className="relative">
                  {/* editorial rule */}
                  <div
                    className="absolute -left-6 top-0 bottom-0 w-px hidden lg:block"
                    style={{ background: 'rgb(var(--champagne) / 0.4)' }}
                  />
                  {narrative ? (
                    <blockquote>
                      <p
                        className="font-serif text-[clamp(1.2rem,2.5vw,1.75rem)] leading-[1.45] tracking-[-0.01em]"
                        style={{ color: 'rgb(var(--text-secondary))' }}
                      >
                        {narrative}
                      </p>
                      {insights?.window && (
                        <footer className="mt-4 label text-faint">
                          Window: {insights.window}
                        </footer>
                      )}
                    </blockquote>
                  ) : (
                    <p className="text-muted text-sm italic">No narrative generated yet.</p>
                  )}
                </div>

                {/* Anomaly chips */}
                <div className="flex flex-col gap-3">
                  <div className="label mb-1">Anomalies detected</div>
                  {anomalies.length > 0 ? (
                    anomalies.map((a, i) => <AnomalyChip key={i} anomaly={a} />)
                  ) : (
                    <CalmChip />
                  )}
                </div>
              </section>
            </Reveal>
          )}

          {/* ── Empty state ────────────────────────────────────────── */}
          {total === 0 && <EmptyInsights />}

          {total > 0 && (
            <>
              {/* ── KPI ROW ──────────────────────────────────────────── */}
              <Reveal>
                <section className="mb-12">
                  <div className="label mb-4">Key metrics</div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatTile
                      label="Classified"
                      value={total}
                      accent="rgb(var(--accent-violet))"
                    />
                    <StatTile
                      label="Flagged"
                      value={flagged}
                      accent="rgb(var(--accent-magenta))"
                    />
                    <StatTile
                      label="Open Reviews"
                      value={openReviews}
                      accent="rgb(var(--champagne))"
                    />
                    <StatTile
                      label="Avg latency"
                      value={latencyAvg}
                      suffix="ms"
                      decimals={0}
                      accent="rgb(var(--accent-mint))"
                    />
                  </div>
                </section>
              </Reveal>

              {/* ── CHART ROW 1: Volume + Case Mix ───────────────────── */}
              <div className="mb-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
                <ChartCard
                  title="Volume & Severity Over Time"
                  caption="01 — Trend"
                >
                  {recent.length > 0 ? (
                    <AreaTrend recent={recent} />
                  ) : (
                    <p className="text-xs text-faint">No recent data to plot.</p>
                  )}
                  <p className="mt-4 text-xs text-faint leading-relaxed">
                    Bucketed from the latest {recent.length} tickets, newest right.
                    Bars are colored by severity.
                  </p>
                </ChartCard>

                <ChartCard
                  title="Case-Type Mix"
                  caption="02 — Distribution"
                >
                  <CaseMixDonut byCase={byCase} />
                </ChartCard>
              </div>

              {/* ── CHART ROW 2: Severity + Dept ─────────────────────── */}
              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Severity Distribution"
                  caption="03 — Severity"
                >
                  <SeverityBars bySeverity={bySeverity} />
                </ChartCard>

                <ChartCard
                  title="Department Workload"
                  caption="04 — Routing"
                >
                  <DeptLoad byDept={byDept} />
                </ChartCard>
              </div>

              {/* ── FUNNEL: full width ────────────────────────────────── */}
              <div className="mb-16">
                <ChartCard
                  title="Triage Funnel"
                  caption="05 — Pipeline"
                  className="max-w-2xl"
                >
                  <Funnel
                    total={total}
                    flagged={flagged}
                    openReviews={openReviews}
                  />
                  <p className="mt-6 text-xs text-faint leading-relaxed">
                    Received = all incoming tickets. Classified = machine-sorted.
                    Flagged = critical or phishing cases. Open = awaiting human review.
                  </p>
                </ChartCard>
              </div>

              {/* ── Editorial footer rule ─────────────────────────────── */}
              <Reveal>
                <div className="hairline mb-6" />
                <div className="flex items-center justify-between pb-16">
                  <span className="label text-faint">Akash · Insights · F4</span>
                  <span className="font-mono text-xs tnum text-faint">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </Reveal>
            </>
          )}
        </>
      )}
    </div>
  );
}
