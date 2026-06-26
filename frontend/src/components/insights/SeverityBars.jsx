/**
 * SeverityBars - Vertical bar chart for severity distribution.
 * Bars colored by SEVERITY_COLOR, animate scaleY on scroll into view.
 * Hairline grid lines for editorial feel.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SEVERITY_COLOR, label } from '../../lib/format.js';

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

export default function SeverityBars({ bySeverity = [] }) {
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
    const map = Object.fromEntries(bySeverity.map((d) => [d.severity, d.n]));
    return SEVERITY_ORDER.map((k) => ({ key: k, n: map[k] || 0 }));
  }, [bySeverity]);

  const max = Math.max(1, ...data.map((d) => d.n));
  const H = 120;
  const BAR_W = 48;
  const GAP = 20;
  const W = data.length * (BAR_W + GAP) - GAP;

  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref} className="w-full">
      <div className="relative w-full overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${W + 8} ${H + 28}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible block"
          style={{ minWidth: 180 }}
        >
          {/* hairline grid */}
          {gridLines.map((t) => {
            const y = H - t * H;
            return (
              <g key={t}>
                <line x1={0} y1={y} x2={W + 8} y2={y} stroke="var(--line-subtle)" strokeWidth={1} />
                <text
                  x={W + 10}
                  y={y + 4}
                  style={{ fill: 'rgb(var(--text-muted))', fontSize: 8, fontFamily: 'JetBrains Mono, monospace', fontFeatureSettings: '"tnum" 1' }}
                >
                  {Math.round(t * max)}
                </text>
              </g>
            );
          })}

          {/* bars */}
          {data.map((d, i) => {
            const x = i * (BAR_W + GAP);
            const barH = (d.n / max) * H;
            const y = H - barH;
            const color = SEVERITY_COLOR[d.key];
            return (
              <g key={d.key}>
                {/* bg track */}
                <rect x={x} y={0} width={BAR_W} height={H} rx={4} fill="var(--line-subtle)" />
                {/* animated bar */}
                <motion.rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH || 1}
                  rx={4}
                  fill={color}
                  opacity={0.85}
                  initial={{ scaleY: 0 }}
                  animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: `${x + BAR_W / 2}px ${H}px` }}
                />
                {/* count label above bar */}
                <motion.text
                  x={x + BAR_W / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="tnum"
                  style={{
                    fill: color,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    fontFeatureSettings: '"tnum" 1',
                  }}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 + 0.4 }}
                >
                  {d.n}
                </motion.text>
                {/* severity label */}
                <text
                  x={x + BAR_W / 2}
                  y={H + 16}
                  textAnchor="middle"
                  style={{
                    fill: 'rgb(var(--text-muted))',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: 'Satoshi, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  {d.key}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
