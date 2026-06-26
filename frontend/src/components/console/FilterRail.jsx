// FilterRail - left rail (desktop) / top horizontal scroll chips (mobile)
import { cn } from '../../lib/cn.js';

const CASE_TYPES = [
  { value: 'wrong_transfer', label: 'Wrong Transfer' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'refund_request', label: 'Refund Request' },
  { value: 'phishing_or_social_engineering', label: 'Phishing' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low', color: '#5FB587' },
  { value: 'medium', label: 'Medium', color: '#E0B23C' },
  { value: 'high', label: 'High', color: '#F0743A' },
  { value: 'critical', label: 'Critical', color: '#FF3B5C' },
];

const DEPARTMENTS = [
  { value: 'customer_support', label: 'Support', color: '#34C7E0' },
  { value: 'dispute_resolution', label: 'Disputes', color: '#7A5CFF' },
  { value: 'payments_ops', label: 'Payments', color: '#E0B23C' },
  { value: 'fraud_risk', label: 'Fraud', color: '#FF3D81' },
];

function Chip({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      data-cursor
      className={cn(
        'relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-300',
        active
          ? 'border-transparent text-base'
          : 'border-hairline bg-transparent text-muted hover:border-line hover:text-ink',
      )}
      style={active ? { background: `${color}22`, borderColor: `${color}66`, color } : {}}
    >
      {color && (
        <span
          className="h-1.5 w-1.5 flex-none rounded-full"
          style={{ background: active ? color : 'currentColor', opacity: active ? 1 : 0.4 }}
        />
      )}
      {children}
    </button>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="space-y-2">
      <div className="label pl-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function FilterRail({ filters, onChange }) {
  const toggle = (key, val) => {
    onChange((prev) => ({ ...prev, [key]: prev[key] === val ? '' : val }));
  };
  const reset = () => onChange({ case_type: '', severity: '', department: '' });
  const hasFilter = filters.case_type || filters.severity || filters.department;

  return (
    <aside className="w-full">
      {/* Mobile: horizontal scroll strip */}
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar lg:hidden">
        <button
          onClick={reset}
          data-cursor
          className={cn(
            'flex-none rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
            !hasFilter
              ? 'border-violet/60 bg-violet/10 text-violet'
              : 'border-hairline text-muted hover:border-line',
          )}
        >
          All
        </button>
        {SEVERITIES.map((s) => (
          <Chip
            key={s.value}
            active={filters.severity === s.value}
            onClick={() => toggle('severity', s.value)}
            color={s.color}
          >
            {s.label}
          </Chip>
        ))}
        {DEPARTMENTS.map((d) => (
          <Chip
            key={d.value}
            active={filters.department === d.value}
            onClick={() => toggle('department', d.value)}
            color={d.color}
          >
            {d.label}
          </Chip>
        ))}
        {CASE_TYPES.map((c) => (
          <Chip
            key={c.value}
            active={filters.case_type === c.value}
            onClick={() => toggle('case_type', c.value)}
            color="#8A857C"
          >
            {c.label}
          </Chip>
        ))}
      </div>

      {/* Desktop: vertical rail */}
      <div className="hidden lg:flex lg:flex-col lg:gap-8">
        <div className="flex items-center justify-between">
          <span className="label">01 - Filters</span>
          {hasFilter && (
            <button
              onClick={reset}
              data-cursor
              className="text-xs text-violet hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        <FilterGroup label="Severity">
          {SEVERITIES.map((s) => (
            <Chip
              key={s.value}
              active={filters.severity === s.value}
              onClick={() => toggle('severity', s.value)}
              color={s.color}
            >
              {s.label}
            </Chip>
          ))}
        </FilterGroup>

        <div className="hairline" />

        <FilterGroup label="Department">
          {DEPARTMENTS.map((d) => (
            <Chip
              key={d.value}
              active={filters.department === d.value}
              onClick={() => toggle('department', d.value)}
              color={d.color}
            >
              {d.label}
            </Chip>
          ))}
        </FilterGroup>

        <div className="hairline" />

        <FilterGroup label="Case Type">
          <Chip
            active={!filters.case_type}
            onClick={reset}
            color="#7A5CFF"
          >
            All
          </Chip>
          {CASE_TYPES.map((c) => (
            <Chip
              key={c.value}
              active={filters.case_type === c.value}
              onClick={() => toggle('case_type', c.value)}
              color="#8A857C"
            >
              {c.label}
            </Chip>
          ))}
        </FilterGroup>

        {hasFilter && (
          <div className="rounded-xl border border-violet/20 bg-violet/5 p-3 text-xs text-violet">
            <span className="font-semibold">Filtered view</span>
            <p className="mt-0.5 text-violet/70">Click any chip to remove</p>
          </div>
        )}
      </div>
    </aside>
  );
}
