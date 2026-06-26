import { SEVERITY_COLOR, DEPT_COLOR, CASE_COLOR, label } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

export function SeverityBadge({ severity, className }) {
  const color = SEVERITY_COLOR[severity] || '#8A857C';
  const critical = severity === 'critical';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tnum',
        critical && 'animate-pulse-critical',
        className,
      )}
      style={{ color, background: `${color}1a`, border: `1px solid ${color}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label.severity(severity)}
    </span>
  );
}

export function Tag({ children, color = '#8A857C', className }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', className)}
      style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}
    >
      {children}
    </span>
  );
}

export const CaseTag = ({ caseType, className }) => (
  <Tag color={CASE_COLOR[caseType] || '#8A857C'} className={className}>
    {label.case(caseType)}
  </Tag>
);

export const DeptTag = ({ dept, className }) => (
  <Tag color={DEPT_COLOR[dept] || '#8A857C'} className={className}>
    {label.dept(dept)}
  </Tag>
);
