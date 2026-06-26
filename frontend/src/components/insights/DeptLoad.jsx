/**
 * DeptLoad - Horizontal bar chart for department workload.
 * Bars colored by DEPT_COLOR, animate scaleX on scroll into view.
 * Full-width design: label | bar track with fill | count
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DEPT_COLOR, label } from '../../lib/format.js';

const DEPT_ORDER = ['customer_support', 'dispute_resolution', 'payments_ops', 'fraud_risk'];

export default function DeptLoad({ byDept = [] }) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    const map = Object.fromEntries(byDept.map((d) => [d.department, d.n]));
    return DEPT_ORDER.map((k) => ({ key: k, n: map[k] || 0 }));
  }, [byDept]);

  const max = Math.max(1, ...data.map((d) => d.n));

  return (
    <div ref={ref} className="flex flex-col gap-4 w-full">
      {data.map((d, i) => {
        const pct = (d.n / max) * 100;
        const color = DEPT_COLOR[d.key];

        return (
          <div key={d.key} className="group flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <span className="label text-muted" style={{ fontSize: '0.65rem' }}>
                  {label.dept(d.key)}
                </span>
              </div>
              <span
                className="font-mono text-sm tnum shrink-0"
                style={{ color, fontFeatureSettings: '"tnum" 1' }}
              >
                {d.n}
              </span>
            </div>

            {/* Track */}
            <div
              className="relative h-2 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--line-subtle)' }}
            >
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ background: color, opacity: 0.8 }}
                initial={{ width: '0%' }}
                animate={inView ? { width: `${pct}%` } : { width: '0%' }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            {/* subtle pct */}
            <div className="text-right font-mono text-[10px] tnum text-faint" style={{ fontFeatureSettings: '"tnum" 1' }}>
              {pct.toFixed(0)}% of peak
            </div>
          </div>
        );
      })}
    </div>
  );
}
