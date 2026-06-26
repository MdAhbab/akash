// Console — Command Center (F2). Live operations dashboard.
// Three-zone layout: left filter rail / center flow+table / right stat stack.
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { PageHeader, PageLoader } from '../components/ui/PageHeader.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';

import FilterRail from '../components/console/FilterRail.jsx';
import FlowViz from '../components/console/FlowViz.jsx';
import LiveTable from '../components/console/LiveTable.jsx';
import StatStack from '../components/console/StatStack.jsx';

// Pulse dot for "live" indicator
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
    </span>
  );
}

// Error state with retry
function ErrorState({ error, retry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="label text-faint">Data Unavailable</div>
      <p className="max-w-sm text-sm text-muted">
        {error?.message || 'Could not connect to the backend.'}
      </p>
      <button
        onClick={retry}
        data-cursor
        className="btn btn-ghost text-sm"
      >
        Retry
      </button>
      <p className="text-xs text-faint">
        Or classify a ticket in the{' '}
        <Link to="/playground" data-cursor className="text-violet hover:underline">
          Playground
        </Link>{' '}
        first.
      </p>
    </div>
  );
}

export default function Console() {
  const [filters, setFilters] = useState({
    case_type: '',
    severity: '',
    department: '',
  });

  // Clean filter params — strip empty strings before sending
  const ticketParams = useCallback(() => {
    const p = {};
    if (filters.case_type) p.case_type = filters.case_type;
    if (filters.severity) p.severity = filters.severity;
    if (filters.department) p.department = filters.department;
    p.limit = 20;
    return p;
  }, [filters]);

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: statsRefetch,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.stats(),
    refetchInterval: 5000,
    retry: 2,
  });

  const {
    data: ticketsData,
    isLoading: ticketsLoading,
    error: ticketsError,
    refetch: ticketsRefetch,
  } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.tickets(ticketParams()),
    refetchInterval: 5000,
    retry: 2,
  });

  const isLoading = statsLoading && ticketsLoading;
  const hasError = statsError && ticketsError;

  const tickets = ticketsData?.tickets ?? [];
  const stats = statsData ?? null;

  function retryAll() {
    statsRefetch();
    ticketsRefetch();
  }

  if (isLoading) {
    return (
      <div className="shell">
        <PageHeader
          index="02"
          title="Command Center"
          subtitle="Live ticket operations — every complaint investigated, routed, and flagged in milliseconds."
        />
        <PageLoader label="Connecting to live feed" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="shell">
        <PageHeader
          index="02"
          title="Command Center"
          subtitle="Live ticket operations — every complaint investigated, routed, and flagged in milliseconds."
        />
        <ErrorState error={ticketsError || statsError} retry={retryAll} />
      </div>
    );
  }

  return (
    <div className="shell pb-24">
      <PageHeader
        index="02"
        title="Command Center"
        subtitle="Live ticket operations — every message, sorted and routed in milliseconds."
      />

      {/* Live status strip */}
      <Reveal y={12} delay={0.05}>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="label text-mint">Live Feed</span>
            <span className="label text-faint">· polled every 5s</span>
          </div>
          <div className="flex items-center gap-4">
            {stats && (
              <div className="flex items-center gap-4">
                <span className="tnum text-xs text-muted">
                  <span className="text-ink font-semibold">{stats.total ?? 0}</span> total
                </span>
                <span className="tnum text-xs text-muted">
                  <span className="font-semibold" style={{ color: '#FF3B5C' }}>
                    {stats.flagged ?? 0}
                  </span>{' '}
                  flagged
                </span>
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* Mobile filter chips — rendered inside FilterRail, above main content */}
      <div className="mb-6 lg:hidden">
        <FilterRail filters={filters} onChange={setFilters} />
      </div>

      {/* Main 3-zone layout */}
      <div className="flex gap-8 lg:items-start">
        {/* LEFT — filter rail (desktop only) */}
        <Reveal
          y={16}
          delay={0.1}
          className="hidden w-52 shrink-0 lg:block"
        >
          <FilterRail filters={filters} onChange={setFilters} />
        </Reveal>

        {/* CENTER — flow viz + table */}
        <div className="min-w-0 flex-1">
          {/* Flow visualization */}
          <Reveal y={20} delay={0.15}>
            <section aria-label="Live ticket flow visualization">
              <div className="mb-3 flex items-center justify-between">
                <span className="label">02 — Live Flow</span>
                <span className="label text-faint">Tickets routing by department</span>
              </div>
              {/* Compact banner on mobile, full viz on desktop */}
              <div className="h-36 lg:h-52">
                <FlowViz byDept={stats?.byDept ?? []} />
              </div>
            </section>
          </Reveal>

          {/* Divider */}
          <div className="hairline my-6" />

          {/* Live ticket table */}
          <Reveal y={20} delay={0.2}>
            <section aria-label="Live ticket table" aria-live="polite">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="label">03 — Ticket Stream</span>
                  {ticketsLoading && (
                    <span className="inline-block h-1 w-1 animate-ping rounded-full bg-violet" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {tickets.length > 0 && (
                    <span className="tnum text-xs text-faint">
                      {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {/* Severity legend strip */}
                  <div className="hidden items-center gap-2 sm:flex">
                    {[
                      ['#5FB587', 'Low'],
                      ['#E0B23C', 'Med'],
                      ['#F0743A', 'High'],
                      ['#FF3B5C', 'Crit'],
                    ].map(([color, l]) => (
                      <div key={l} className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="label text-faint">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
                <LiveTable tickets={tickets} isLoading={ticketsLoading} />
              </div>

              {tickets.length === 0 && !ticketsLoading && !ticketsError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-center"
                >
                  <p className="text-sm text-muted">
                    No tickets yet — classify one in the{' '}
                    <Link
                      to="/playground"
                      data-cursor
                      className="text-violet underline-offset-2 hover:underline"
                    >
                      Playground
                    </Link>
                  </p>
                </motion.div>
              )}
            </section>
          </Reveal>
        </div>

        {/* RIGHT — stat stack (desktop) */}
        <Reveal
          y={16}
          delay={0.12}
          className="hidden w-64 shrink-0 lg:block xl:w-72"
        >
          <StatStack stats={stats} />
        </Reveal>
      </div>

      {/* Mobile stat stack — horizontal tile carousel */}
      <div className="mt-8 lg:hidden">
        <div className="hairline mb-6" />
        <Reveal y={12}>
          <StatStack stats={stats} />
        </Reveal>
      </div>

      {/* Bottom meta strip */}
      <div className="hairline mt-16" />
      <div className="mt-4 flex items-center justify-between">
        <span className="label text-faint">
          Akash · Command Center · F2
        </span>
        <span className="label text-faint">
          Sentinel →{' '}
          <Link to="/sentinel" data-cursor className="text-violet hover:underline">
            review queue
          </Link>
        </span>
      </div>
    </div>
  );
}
