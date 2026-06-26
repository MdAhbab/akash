/**
 * Sentinel — Fraud & Phishing Review Console (F3).
 * Layout: PageHeader → [Radar | ReviewQueue] → PatternStrip
 * Both themes; reduced-motion safe; responsive (375px–1440px).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { api } from '../lib/api.js';
import { PageHeader, PageLoader } from '../components/ui/PageHeader.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import Radar from '../components/sentinel/Radar.jsx';
import ReviewQueue from '../components/sentinel/ReviewQueue.jsx';
import PatternStrip from '../components/sentinel/PatternStrip.jsx';

/* Detect reduced-motion preference once at module level */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Critical blips count indicator for the header */
function CriticalPulse({ count }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold animate-pulse-critical"
      style={{
        color: '#FF3B5C',
        background: '#FF3B5C14',
        border: '1px solid #FF3B5C44',
      }}
      role="status"
      aria-live="polite"
      aria-label={`${count} critical case${count !== 1 ? 's' : ''} awaiting review`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B5C]" aria-hidden="true" />
      {count} critical
    </span>
  );
}

/* Empty state */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      {/* Minimal radar ring as decoration */}
      <div
        className="mb-8 relative"
        style={{ width: 80, height: 80 }}
        aria-hidden="true"
      >
        {[1, 0.66, 0.33].map((scale, i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid var(--line-subtle)',
              transform: `scale(${scale})`,
              transformOrigin: 'center',
            }}
          />
        ))}
        <span
          className="absolute inset-0 flex items-center justify-center font-display text-xl"
          style={{ color: 'var(--accent-mint)' }}
        >
          &#10003;
        </span>
      </div>
      <p className="font-display text-xl font-semibold text-ink">
        All clear
      </p>
      <p className="mt-2 text-muted max-w-xs text-sm">
        No cases awaiting review. Sentinel is monitoring for new threats.
      </p>
    </motion.div>
  );
}

/* Error state */
function ErrorState({ error, retry }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-4 py-20 text-center"
    >
      <p className="text-sm text-muted">
        Failed to load reviews
        {error?.message ? `: ${error.message}` : '.'}
      </p>
      <button className="btn btn-ghost py-2 px-4 text-sm" onClick={retry} data-cursor="pointer">
        Retry
      </button>
    </motion.div>
  );
}

export default function Sentinel() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => api.reviews(),
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const reviews = useMemo(() => data?.reviews ?? [], [data]);

  const criticalCount = useMemo(
    () => reviews.filter((r) => r.severity === 'critical').length,
    [reviews],
  );

  return (
    <div className="shell">
      {/* Page header row: header + critical counter */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          index="03"
          title="Sentinel"
          subtitle="Every phishing and critical case, surfaced for human review."
        />
        {!isLoading && !isError && criticalCount > 0 && (
          <div className="pt-28 pb-10 md:pt-36 md:pb-14 flex items-end">
            <CriticalPulse count={criticalCount} />
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && <PageLoader label="Scanning for threats" />}

      {/* Error */}
      {isError && !isLoading && (
        <ErrorState error={error} retry={refetch} />
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {reviews.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/*
               * Main layout:
               * lg+: radar left (~40%), queue right (~60%)
               * <lg: radar square at top, queue as full-width list
               */}
              <Reveal y={20}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-8 lg:gap-10 items-start">
                  {/* Left column: Radar + legend */}
                  <div>
                    <div
                      className="label mb-4"
                      style={{ fontSize: '0.7rem', letterSpacing: '0.16em' }}
                    >
                      Threat Radar
                    </div>

                    {/* Radar container — square ratio, centred on mobile */}
                    <div
                      className="relative w-full max-w-[380px] lg:max-w-none mx-auto lg:mx-0"
                      style={{
                        borderRadius: '50%',
                      }}
                    >
                      {/* Outer ambient glow */}
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          boxShadow: criticalCount > 0
                            ? '0 0 48px -8px rgba(255,59,92,0.3)'
                            : '0 0 32px -8px rgba(122,92,255,0.18)',
                        }}
                        aria-hidden="true"
                      />
                      <Radar
                        reviews={reviews}
                        reducedMotion={prefersReducedMotion}
                      />
                    </div>

                    {/* Severity legend */}
                    <div className="mt-5 flex items-center gap-4 flex-wrap">
                      {[
                        { label: 'Critical', color: '#FF3B5C' },
                        { label: 'High', color: '#F0743A' },
                        { label: 'Medium', color: '#E0B23C' },
                        { label: 'Low', color: '#5FB587' },
                      ].map((item) => (
                        <span
                          key={item.label}
                          className="flex items-center gap-1.5 text-xs text-muted"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: item.color }}
                            aria-hidden="true"
                          />
                          {item.label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-faint">
                      Inner ring = higher risk. Click any blip to open ticket.
                    </p>

                    {prefersReducedMotion && (
                      <p className="mt-2 text-xs text-faint">
                        Sweep paused (prefers-reduced-motion active).
                      </p>
                    )}
                  </div>

                  {/* Right column: Review Queue */}
                  <div>
                    <ReviewQueue reviews={reviews} />
                  </div>
                </div>
              </Reveal>

              {/* Section divider */}
              <div className="hairline my-8 lg:my-12" />

              {/* Threat Patterns Strip */}
              <Reveal y={12} delay={0.1}>
                <div
                  className="card px-6 py-5"
                  style={{ borderRadius: '16px' }}
                >
                  <PatternStrip reviews={reviews} />
                </div>
              </Reveal>

              {/* Bottom breathing room */}
              <div className="h-16" />
            </>
          )}
        </>
      )}
    </div>
  );
}
