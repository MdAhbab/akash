// API client for the QueueStorm backend.
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).detail; } catch { /* ignore */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  base: BASE,
  health: () => req('/health'),
  // Canonical judged endpoint — full investigator contract (Section 5/6).
  analyzeTicket: (body) => req('/analyze-ticket', { method: 'POST', body: JSON.stringify(body) }),
  // Demo alias kept for backward compatibility with the UI shorthand body.
  sortTicket: (body) => req('/sort-ticket', { method: 'POST', body: JSON.stringify(body) }),
  tickets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req(`/tickets${q ? `?${q}` : ''}`);
  },
  ticket: (id) => req(`/tickets/${encodeURIComponent(id)}`),
  stats: () => req('/stats'),
  reviews: () => req('/reviews'),
  setReviewStatus: (id, status) =>
    req(`/reviews/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  reply: (id) => req(`/tickets/${encodeURIComponent(id)}/reply`, { method: 'POST', body: '{}' }),
  insights: () => req('/insights/summary'),
};
