/**
 * AreaTrend - Volume / severity sparkline area chart.
 * Takes stats.recent (newest-first array of {created_at, severity}) and buckets
 * them into N ordered time bands, then draws a stacked area / bar column per band
 * colored by severity. Animates in on scroll via framer-motion path draw.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SEVERITY_COLOR } from '../../lib/format.js';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const BUCKET_COUNT = 20;

function bucket(recent, n) {
  // recent is newest-first; reverse to chronological
  const items = [...recent].reverse();
  const total = items.length;
  if (total === 0) return Array.from({ length: n }, () => ({ critical: 0, high: 0, medium: 0, low: 0 }));

  const size = Math.ceil(total / n);
  return Array.from({ length: n }, (_, i) => {
    const slice = items.slice(i * size, (i + 1) * size);
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    slice.forEach((t) => { if (counts[t.severity] !== undefined) counts[t.severity]++; });
    return counts;
  });
}

function buildPath(points, width, height) {
  if (points.length < 2) return '';
  const step = width / (points.length - 1);
  let d = `M ${0} ${height - points[0]}`;
  points.forEach((p, i) => {
    if (i === 0) return;
    const x = i * step;
    const px = (i - 1) * step;
    const cx = px + step / 2;
    d += ` C ${cx} ${height - points[i - 1]}, ${cx} ${height - p}, ${x} ${height - p}`;
  });
  return d;
}

export default function AreaTrend({ recent = [] }) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const W = 560;
  const H = 120;
  const PAD = 2;

  const buckets = useMemo(() => bucket(recent, BUCKET_COUNT), [recent]);

  const maxTotal = useMemo(() =>
    Math.max(1, ...buckets.map((b) => SEVERITIES.reduce((s, k) => s + b[k], 0))),
    [buckets]
  );

  // For each severity build cumulative top edges
  const barWidth = (W - PAD * 2) / BUCKET_COUNT;

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: H + 24 }}>
      {/* Y-axis hairline ticks */}
      <div className="pointer-events-none absolute inset-0">
        {[0, 0.5, 1].map((t) => (
          <div
            key={t}
            className="absolute w-full"
            style={{
              top: `${(1 - t) * H}px`,
              borderTop: '1px solid var(--line-subtle)',
            }}
          />
        ))}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H + 4}`} preserveAspectRatio="none" className="block">
        {buckets.map((b, i) => {
          const total = SEVERITIES.reduce((s, k) => s + b[k], 0);
          const x = PAD + i * barWidth;
          let accum = 0;
          return (
            <g key={i}>
              {SEVERITIES.map((sev) => {
                const val = b[sev];
                if (val === 0) return null;
                const h = (val / maxTotal) * (H - 4);
                const y = H - accum - h;
                accum += h;
                return (
                  <motion.rect
                    key={sev}
                    x={x + 1}
                    y={y}
                    width={barWidth - 2}
                    height={h}
                    fill={SEVERITY_COLOR[sev]}
                    rx={1.5}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.02,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ transformOrigin: `${x + barWidth / 2}px ${H}px` }}
                    opacity={0.88}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="absolute bottom-0 right-0 flex items-center gap-3 pb-1">
        {SEVERITIES.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
            <span className="label" style={{ fontSize: '0.6rem' }}>{s}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
