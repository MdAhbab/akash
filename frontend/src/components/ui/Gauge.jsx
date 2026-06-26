import { SEVERITY_COLOR } from '../../lib/format.js';

const STEPS = ['low', 'medium', 'high', 'critical'];

// Vertical severity gauge - fills to the active level.
export function SeverityGauge({ severity = 'low', height = 160 }) {
  const idx = STEPS.indexOf(severity);
  const color = SEVERITY_COLOR[severity] || '#8A857C';
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      <div className="flex h-full flex-col-reverse gap-1">
        {STEPS.map((s, i) => {
          const active = i <= idx;
          return (
            <div
              key={s}
              className="w-3 flex-1 rounded-sm transition-all duration-700"
              style={{
                background: active ? SEVERITY_COLOR[s] : 'var(--line-subtle)',
                opacity: active ? 1 : 0.5,
                boxShadow: active && s === severity ? `0 0 14px ${color}88` : 'none',
              }}
            />
          );
        })}
      </div>
      <div className="flex h-full flex-col-reverse justify-between py-0.5 text-[10px] uppercase tracking-wider text-faint">
        {STEPS.map((s) => (
          <span key={s} style={{ color: s === severity ? color : undefined }}>
            {s[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

// Circular confidence dial (SVG arc).
export function ConfidenceDial({ value = 0, size = 96 }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const offset = c * (1 - pct);
  const color = pct > 0.75 ? '#28E0C8' : pct > 0.5 ? '#7A5CFF' : '#E0B23C';
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-subtle)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-mono text-lg font-medium tnum">{Math.round(pct * 100)}</div>
        <div className="text-[9px] uppercase tracking-wider text-faint">conf</div>
      </div>
    </div>
  );
}
