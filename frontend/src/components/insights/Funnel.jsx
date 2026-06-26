/**
 * Funnel - Triage funnel: 4 descending stages with tapering widths.
 * Stages: Received → Classified → Flagged → Open Reviews
 * Shows count + drop-off % between stages.
 * Animates scaleX on scroll into view.
 */
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const STAGES = [
  { key: 'received',    label: 'Received',     accent: 'rgb(var(--accent-violet))' },
  { key: 'classified',  label: 'Classified',   accent: 'rgb(var(--accent-mint))' },
  { key: 'flagged',     label: 'Flagged',      accent: 'rgb(var(--accent-magenta))' },
  { key: 'open',        label: 'Open Reviews', accent: 'rgb(var(--champagne))' },
];

function dropOff(a, b) {
  if (!a || a === 0) return null;
  const pct = (((a - b) / a) * 100).toFixed(0);
  return `${pct}% drop`;
}

export default function Funnel({ total = 0, flagged = 0, openReviews = 0 }) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const values = {
    received: total,
    classified: total,   // all received are classified
    flagged: flagged,
    open: openReviews,
  };

  const maxVal = Math.max(total, 1);

  return (
    <div ref={ref} className="flex flex-col gap-0 w-full">
      {STAGES.map((stage, i) => {
        const val = values[stage.key];
        const widthPct = Math.max(18, (val / maxVal) * 100);
        const prevVal = i > 0 ? values[STAGES[i - 1].key] : null;
        const drop = i > 0 ? dropOff(prevVal, val) : null;

        return (
          <div key={stage.key} className="flex flex-col">
            {/* connector + drop-off annotation */}
            {drop && (
              <div className="flex items-center gap-3 py-1.5 pl-4">
                <div className="h-4 w-px" style={{ background: 'var(--line-strong)' }} />
                <span
                  className="font-mono text-[10px] tnum"
                  style={{ color: 'rgb(var(--text-muted))', fontFeatureSettings: '"tnum" 1' }}
                >
                  {drop}
                </span>
              </div>
            )}

            {/* stage row */}
            <div className="group flex items-center gap-4">
              {/* index */}
              <span
                className="label shrink-0 w-3"
                style={{ fontSize: '0.6rem', color: stage.accent }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* tapered bar */}
              <div className="flex-1">
                <motion.div
                  className="relative overflow-hidden"
                  style={{
                    transformOrigin: 'left center',
                    width: `${widthPct}%`,
                    height: 32,
                    background: stage.accent,
                    opacity: 0.82,
                    borderRadius: 3,
                  }}
                  initial={{ scaleX: 0 }}
                  animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
                  transition={{ duration: 0.8, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              {/* label + count */}
              <div className="shrink-0 flex flex-col items-end min-w-[80px]">
                <span className="label" style={{ fontSize: '0.6rem' }}>{stage.label}</span>
                <motion.span
                  className="font-display text-xl font-semibold tnum"
                  style={{ color: stage.accent, fontFeatureSettings: '"tnum" 1' }}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.15 + 0.3 }}
                >
                  {val.toLocaleString()}
                </motion.span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
