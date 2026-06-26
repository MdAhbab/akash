// LiveTable — live-updating ticket list with animated new-row entrances.
import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SeverityBadge, CaseTag, DeptTag } from '../ui/Badge.jsx';
import { cn } from '../../lib/cn.js';
import { timeAgo } from '../../lib/format.js';

const COL_HEADS = ['ID', 'Message', 'Case', 'Severity', 'Department', 'Conf.', 'Time'];

function ConfBar({ value }) {
  // confidence 0-1 rendered as a small bar
  const pct = Math.round((value ?? 0) * 100);
  const color =
    pct >= 80 ? '#5FB587' : pct >= 60 ? '#E0B23C' : '#F0743A';
  return (
    <span className="flex items-center gap-2 tnum">
      <span
        className="inline-block h-1 w-10 overflow-hidden rounded-full"
        style={{ background: 'var(--line-strong)' }}
      >
        <span
          className="block h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      <span className="w-8 text-right text-xs text-muted">{pct}%</span>
    </span>
  );
}

function TableRow({ ticket, isNew }) {
  const isCritical = ticket.severity === 'critical';
  const isFlagged = ticket.human_review_required;

  return (
    <motion.tr
      layout
      initial={isNew ? { opacity: 0, x: -16 } : false}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative border-b border-hairline transition-colors duration-200',
        'hover:bg-violet/5',
        isCritical && 'border-l-2',
      )}
      style={isCritical ? { borderLeftColor: '#FF3B5C' } : {}}
    >
      {/* ID */}
      <td className="py-3 pl-4 pr-3 align-middle">
        <Link
          to={`/ticket/${ticket.ticket_id}`}
          data-cursor
          className="flex items-center gap-2 font-mono text-xs text-violet hover:underline"
        >
          {isFlagged && (
            <span className="relative flex h-2 w-2 flex-none">
              <span className="animate-pulse-critical absolute inline-flex h-full w-full rounded-full bg-sev-critical opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sev-critical" />
            </span>
          )}
          {ticket.ticket_id}
        </Link>
      </td>

      {/* Message snippet */}
      <td className="max-w-[240px] py-3 pr-3 align-middle">
        <span className="block truncate text-sm text-ink" title={ticket.message}>
          {ticket.agent_summary || ticket.message}
        </span>
        {ticket.locale && ticket.locale !== 'en' && (
          <span className="label mt-0.5 text-champagne">{ticket.locale}</span>
        )}
      </td>

      {/* Case */}
      <td className="py-3 pr-3 align-middle">
        <CaseTag caseType={ticket.case_type} />
      </td>

      {/* Severity */}
      <td className="py-3 pr-3 align-middle">
        <SeverityBadge severity={ticket.severity} />
      </td>

      {/* Department */}
      <td className="py-3 pr-3 align-middle">
        <DeptTag dept={ticket.department} />
      </td>

      {/* Confidence */}
      <td className="py-3 pr-3 align-middle">
        <ConfBar value={ticket.confidence} />
      </td>

      {/* Time */}
      <td className="py-3 pr-4 align-middle">
        <span className="tnum text-xs text-faint">{timeAgo(ticket.created_at)}</span>
      </td>
    </motion.tr>
  );
}

export default function LiveTable({ tickets = [], isLoading }) {
  const [newIds, setNewIds] = useState(new Set());
  const prevIds = useRef(new Set());

  useEffect(() => {
    const currentIds = new Set(tickets.map((t) => t.ticket_id));
    const added = new Set();
    currentIds.forEach((id) => {
      if (!prevIds.current.has(id)) added.add(id);
    });
    if (added.size > 0) {
      setNewIds(added);
      const timer = setTimeout(() => setNewIds(new Set()), 2000);
      prevIds.current = currentIds;
      return () => clearTimeout(timer);
    }
    prevIds.current = currentIds;
  }, [tickets]);

  if (tickets.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="label text-faint">No tickets match filters</div>
        <p className="text-sm text-muted">
          No tickets yet — classify one in the{' '}
          <Link to="/playground" data-cursor className="text-violet hover:underline">
            Playground
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[800px] border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {COL_HEADS.map((h) => (
              <th
                key={h}
                className="pb-2 pr-3 text-left align-bottom first:pl-4"
              >
                <span className="label">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false} mode="popLayout">
            {tickets.slice(0, 20).map((ticket) => (
              <TableRow
                key={ticket.ticket_id}
                ticket={ticket}
                isNew={newIds.has(ticket.ticket_id)}
              />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      {tickets.length > 20 && (
        <div className="py-3 pl-4 text-xs text-faint">
          Showing 20 of {tickets.length} tickets
        </div>
      )}
    </div>
  );
}
