// Display helpers: labels, colors, formatters for the domain enums.

export const SEVERITY_COLOR = {
  low: '#5FB587',
  medium: '#E0B23C',
  high: '#F0743A',
  critical: '#FF3B5C',
};

export const DEPT_COLOR = {
  customer_support: '#34C7E0',
  dispute_resolution: '#7A5CFF',
  payments_ops: '#E0B23C',
  merchant_operations: '#28E0C8',
  agent_operations: '#F0743A',
  fraud_risk: '#FF3D81',
};

export const CASE_COLOR = {
  wrong_transfer: '#7A5CFF',
  payment_failed: '#E0B23C',
  refund_request: '#34C7E0',
  duplicate_payment: '#F0743A',
  merchant_settlement_delay: '#28E0C8',
  agent_cash_in_issue: '#9B7BFF',
  phishing_or_social_engineering: '#FF3D81',
  other: '#8A857C',
};

// Evidence verdict — the investigator headline (consistent / inconsistent / insufficient).
export const VERDICT_COLOR = {
  consistent: '#5FB587',
  inconsistent: '#F0743A',
  insufficient_data: '#8A857C',
};

export const VERDICT_LABEL = {
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  insufficient_data: 'Insufficient data',
};

const TITLE = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const label = {
  case: (c) => TITLE(c),
  severity: (s) => TITLE(s),
  dept: (d) => TITLE(d),
};

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso.includes('Z') || iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - t.getTime()) / 1000;
  if (diff < 60) return `${Math.max(0, Math.floor(diff))}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function countdown(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const diff = Math.floor((t - Date.now()) / 1000);
  const sign = diff < 0 ? '-' : '';
  const a = Math.abs(diff);
  const m = String(Math.floor(a / 60)).padStart(2, '0');
  const s = String(a % 60).padStart(2, '0');
  return `${sign}${m}:${s}`;
}

// Full investigator cases: complaint + transaction history, so the demo shows
// the "investigator twist" (relevant transaction + evidence verdict), not just
// keyword classification. Shapes match POST /analyze-ticket exactly.
export const SAMPLE_CASES = [
  {
    label: 'Wrong transfer (evidence matches)',
    language: 'en', channel: 'in_app_chat', user_type: 'customer',
    complaint: 'I sent 5000 taka to a wrong number around 2pm today. The number was supposed to be 01712345678 but I think I typed it wrong. The person isn\'t responding. Please help me get my money back.',
    transaction_history: [
      { transaction_id: 'TXN-9101', timestamp: '2026-04-14T14:08:22Z', type: 'transfer', amount: 5000, counterparty: '+8801719876543', status: 'completed' },
      { transaction_id: 'TXN-9087', timestamp: '2026-04-13T18:12:00Z', type: 'cash_in', amount: 10000, counterparty: 'AGENT-512', status: 'completed' },
    ],
  },
  {
    label: 'Wrong transfer (contradicted)',
    language: 'en', channel: 'in_app_chat', user_type: 'customer',
    complaint: 'I sent 2000 to the wrong person by mistake. Please reverse it.',
    transaction_history: [
      { transaction_id: 'TXN-9202', timestamp: '2026-04-14T11:30:00Z', type: 'transfer', amount: 2000, counterparty: '+8801812345678', status: 'completed' },
      { transaction_id: 'TXN-9180', timestamp: '2026-04-10T09:15:00Z', type: 'transfer', amount: 2500, counterparty: '+8801812345678', status: 'completed' },
      { transaction_id: 'TXN-9145', timestamp: '2026-04-05T17:45:00Z', type: 'transfer', amount: 1500, counterparty: '+8801812345678', status: 'completed' },
    ],
  },
  {
    label: 'Payment failed, balance deducted',
    language: 'en', channel: 'in_app_chat', user_type: 'customer',
    complaint: 'I tried to pay 1200 taka for my mobile recharge but the app showed failed. But my balance was deducted! Please refund my money.',
    transaction_history: [
      { transaction_id: 'TXN-9301', timestamp: '2026-04-14T16:00:00Z', type: 'payment', amount: 1200, counterparty: 'MERCHANT-MOBILE-OP', status: 'failed' },
    ],
  },
  {
    label: 'Phishing / OTP scam',
    language: 'en', channel: 'call_center', user_type: 'customer',
    complaint: 'Someone called me saying they are from bKash and asked for my OTP. They said my account will be blocked if I don\'t share it. Is this real? I haven\'t shared anything yet.',
    transaction_history: [],
  },
  {
    label: 'Duplicate payment',
    language: 'en', channel: 'in_app_chat', user_type: 'customer',
    complaint: 'I paid my electricity bill 850 taka but it deducted twice from my account. Please check, I only paid once.',
    transaction_history: [
      { transaction_id: 'TXN-10001', timestamp: '2026-04-14T08:15:30Z', type: 'payment', amount: 850, counterparty: 'BILLER-DESCO', status: 'completed' },
      { transaction_id: 'TXN-10002', timestamp: '2026-04-14T08:15:42Z', type: 'payment', amount: 850, counterparty: 'BILLER-DESCO', status: 'completed' },
    ],
  },
  {
    label: 'Bangla — agent cash-in',
    language: 'bn', channel: 'call_center', user_type: 'customer',
    complaint: 'আমি আজ সকালে এজেন্টের কাছে ২০০০ টাকা ক্যাশ ইন করেছি কিন্তু আমার ব্যালেন্সে টাকা আসেনি। এজেন্ট বলছে টাকা পাঠিয়েছে কিন্তু আমি দেখছি না।',
    transaction_history: [
      { transaction_id: 'TXN-9701', timestamp: '2026-04-14T09:30:00Z', type: 'cash_in', amount: 2000, counterparty: 'AGENT-318', status: 'pending' },
    ],
  },
  {
    label: 'Vague (insufficient data)',
    language: 'en', channel: 'in_app_chat', user_type: 'customer',
    complaint: 'Something is wrong with my money. Please check.',
    transaction_history: [
      { transaction_id: 'TXN-9601', timestamp: '2026-04-13T10:00:00Z', type: 'cash_in', amount: 3000, counterparty: 'AGENT-220', status: 'completed' },
      { transaction_id: 'TXN-9602', timestamp: '2026-04-12T15:30:00Z', type: 'transfer', amount: 800, counterparty: '+8801911223344', status: 'completed' },
    ],
  },
];

// Backwards-compatible alias (older components referenced SAMPLE_MESSAGES).
export const SAMPLE_MESSAGES = SAMPLE_CASES.map((c) => ({
  label: c.label, message: c.complaint, channel: 'app', locale: c.language,
}));
