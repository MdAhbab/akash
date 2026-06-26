/**
 * CaseMixDonut — Animated SVG donut chart for case-type mix.
 * Segments colored by CASE_COLOR, with a legend + tnum counts.
 * Animates stroke-dashoffset on scroll into view via framer-motion.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CASE_COLOR, label } from '../../lib/format.js';

const CASE_KEYS = ['wrong_transfer', 'payment_failed', 'refund_request', 'phishing_or_social_engineering', 'other'];

const R = 70;        // outer radius
const r = 44;        // inner radius
const CX = 90;
const CY = 90;
const GAP = 2.5;     // degrees gap between segments

function polarToXY(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function arcPath(cx, cy, outerR, innerR, startDeg, endDeg) {
  const o1 = polarToXY(cx, cy, outerR, startDeg);
  const o2 = polarToXY(cx, cy, outerR, endDeg);
  const i1 = polarToXY(cx, cy, innerR, endDeg);
  const i2 = polarToXY(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

export default function CaseMixDonut({ byCase = [] }) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    const map = Object.fromEntries(byCase.map((d) => [d.case_type, d.n]));
    return CASE_KEYS.map((k) => ({ key: k, n: map[k] || 0 })).filter((d) => d.n > 0);
  }, [byCase]);

  const total = data.reduce((s, d) => s + d.n, 0) || 1;

  const segments = useMemo(() => {
    let angle = 0;
    return data.map((d, i) => {
      const deg = (d.n / total) * (360 - data.length * GAP);
      const start = angle + i * GAP;
      const end = start + deg;
      angle += deg;
      return { ...d, start, end };
    });
  }, [data, total]);

  const VW = 180;
  const VH = 180;

  return (
    <div ref={ref} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
      {/* SVG donut */}
      <div className="shrink-0">
        <svg
          width={VW}
          height={VH}
          viewBox={`0 0 ${VW} ${VH}`}
          className="overflow-visible"
        >
          {total === 1 && data.length === 0 && (
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--line-strong)" strokeWidth={R - r} />
          )}
          {segments.map((seg, i) => (
            <motion.path
              key={seg.key}
              d={arcPath(CX, CY, R, r, seg.start, seg.end)}
              fill={CASE_COLOR[seg.key] || '#8A857C'}
              opacity={0}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={inView ? { opacity: 0.9, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />
          ))}
          {/* center total */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-display font-semibold tnum"
            style={{ fill: 'rgb(var(--text-primary))', fontSize: 22, fontFamily: 'Clash Display, sans-serif', fontFeatureSettings: '"tnum" 1' }}
          >
            {total}
          </text>
          <text
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            style={{ fill: 'rgb(var(--text-muted))', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Satoshi, sans-serif' }}
          >
            TOTAL
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0">
        {segments.map((seg) => {
          const pct = ((seg.n / total) * 100).toFixed(1);
          return (
            <div key={seg.key} className="flex items-center gap-2.5 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: CASE_COLOR[seg.key] || '#8A857C' }}
              />
              <span className="min-w-0 truncate text-xs text-muted">{label.case(seg.key)}</span>
              <span className="ml-auto font-mono text-xs tnum text-ink shrink-0">{seg.n}</span>
              <span className="w-10 text-right font-mono text-xs tnum text-faint shrink-0">{pct}%</span>
            </div>
          );
        })}
        {segments.length === 0 && (
          <span className="text-xs text-faint">No data</span>
        )}
      </div>
    </div>
  );
}
