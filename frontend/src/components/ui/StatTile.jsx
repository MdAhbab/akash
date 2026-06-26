import { useEffect, useRef, useState } from 'react';

// Animated count-up number tile.
export function StatTile({ label, value, suffix = '', sub, accent = 'var(--accent-violet)', decimals = 0 }) {
  const display = useCountUp(typeof value === 'number' ? value : 0, decimals);
  const isNum = typeof value === 'number';
  return (
    <div className="card p-5">
      <div className="label mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold tnum" style={{ color: 'rgb(var(--text-primary))' }}>
          {isNum ? display : value}
        </span>
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
      <div className="mt-3 h-0.5 w-10 rounded-full" style={{ background: accent }} />
    </div>
  );
}

export function useCountUp(target, decimals = 0, duration = 1000) {
  const [val, setVal] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); return; }
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, decimals, duration]);
  return val.toFixed(decimals);
}
