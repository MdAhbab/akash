import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/cn.js';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import { useUI } from '../store/ui.js';

/* ─── Settings card wrapper ─────────────────────────────── */
function SettingsCard({ index, title, description, children }) {
  return (
    <Reveal>
      <div className="card p-6 md:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="label mb-1">{index}</div>
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-faint">{description}</p>}
          </div>
        </div>
        <div className="hairline mb-5" />
        {children}
      </div>
    </Reveal>
  );
}

/* ─── Theme selector ─────────────────────────────────────── */
function ThemeSwatch({ name, themeKey, preview, active, onClick }) {
  return (
    <button
      onClick={onClick}
      data-cursor="hover"
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-300',
        active
          ? 'border-violet bg-violet/5 shadow-[0_0_0_1px_rgb(var(--accent-violet)/0.3)]'
          : 'border-hairline hover:border-line',
      )}
    >
      {/* Preview swatch */}
      <div
        className="h-20 w-full overflow-hidden rounded-xl"
        style={{ background: preview.bg }}
      >
        {/* Mini UI mockup */}
        <div className="flex h-full flex-col p-3 gap-1.5">
          <div className="flex gap-1.5">
            <div className="h-2 w-12 rounded-sm" style={{ background: preview.accent, opacity: 0.8 }} />
            <div className="h-2 w-8 rounded-sm" style={{ background: preview.muted, opacity: 0.4 }} />
          </div>
          <div className="h-px w-full" style={{ background: preview.line }} />
          <div className="h-2 w-20 rounded-sm" style={{ background: preview.text, opacity: 0.7 }} />
          <div className="h-2 w-16 rounded-sm" style={{ background: preview.text, opacity: 0.35 }} />
          <div className="mt-auto flex gap-2">
            <div className="h-6 flex-1 rounded-lg" style={{ background: preview.accent, opacity: 0.9 }} />
            <div className="h-6 flex-1 rounded-lg border" style={{ borderColor: preview.line, background: 'transparent' }} />
          </div>
        </div>
      </div>
      {/* Label */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-ink">{name}</div>
          <div className="text-xs text-faint">{themeKey === 'dark' ? 'Obsidian' : 'Porcelain'}</div>
        </div>
        {/* Active indicator */}
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border transition-all',
            active ? 'border-violet bg-violet' : 'border-hairline',
          )}
        >
          {active && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="h-2 w-2 rounded-full bg-base"
            />
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Segmented control ──────────────────────────────────── */
function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="relative inline-flex rounded-xl border border-hairline bg-base/60 p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            data-cursor="hover"
            className={cn(
              'relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
              active ? 'text-base' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId="segment-bg"
                className="absolute inset-0 rounded-lg bg-ink"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Health dot ─────────────────────────────────────────── */
function HealthDot({ status }) {
  if (status === 'ok') {
    return (
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
      </span>
    );
  }
  if (status === 'error') {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sev-critical" />;
  }
  // loading
  return <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-faint" />;
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function Settings() {
  const { theme, toggleTheme, lang, setLang } = useUI();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Live health check, refetch every 15 s
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
    retry: 2,
  });

  const healthStatus = healthQuery.isSuccess
    ? 'ok'
    : healthQuery.isError
    ? 'error'
    : 'loading';

  const DARK_PREVIEW = {
    bg: '#0A0A0C',
    text: '#F4F2EE',
    muted: '#6E6D68',
    accent: '#7A5CFF',
    line: 'rgba(255,255,255,0.07)',
  };
  const LIGHT_PREVIEW = {
    bg: '#F6F4EF',
    text: '#14110E',
    muted: '#8A857C',
    accent: '#5B3CE0',
    line: 'rgba(20,18,16,0.09)',
  };

  const LANG_OPTIONS = [
    { value: 'en', label: 'EN' },
    { value: 'bn', label: 'বাংলা' },
  ];

  return (
    <div className="shell pb-24">
      <PageHeader
        title="Settings"
        subtitle="Tune the experience."
      />

      <div className="max-w-2xl space-y-6">

        {/* Theme */}
        <SettingsCard
          index="01"
          title="Theme"
          description="Choose between Obsidian (dark) and Porcelain (light). The selection persists across sessions."
        >
          <div className="grid grid-cols-2 gap-4">
            <ThemeSwatch
              name="Dark"
              themeKey="dark"
              preview={DARK_PREVIEW}
              active={theme === 'dark'}
              onClick={() => theme !== 'dark' && toggleTheme()}
            />
            <ThemeSwatch
              name="Light"
              themeKey="light"
              preview={LIGHT_PREVIEW}
              active={theme === 'light'}
              onClick={() => theme !== 'light' && toggleTheme()}
            />
          </div>
          <p className="mt-3 text-xs text-faint">
            Active: <span className="font-mono text-ink">{theme === 'dark' ? 'Obsidian' : 'Porcelain'}</span>.
            Theme transitions in ≤ 400ms. Persists to <code className="font-mono text-[11px]">localStorage</code>.
          </p>
        </SettingsCard>

        {/* Language */}
        <SettingsCard
          index="02"
          title="Language"
          description="Switch the UI language. Bangla messages automatically use the Hind Siliguri type face."
        >
          <SegmentedControl
            options={LANG_OPTIONS}
            value={lang}
            onChange={setLang}
          />
          <p className="mt-4 text-xs text-faint">
            Active locale:{' '}
            <span className="font-mono text-ink">{lang}</span>.
            Ticket messages marked <code className="font-mono text-[11px]">locale: bn</code> always
            render in the Bangla type face regardless of this setting.
          </p>
        </SettingsCard>

        {/* Motion */}
        <SettingsCard
          index="03"
          title="Motion"
          description="Animations and scroll choreography respond automatically to your OS accessibility preference."
        >
          <div
            className={cn(
              'flex items-start gap-4 rounded-xl border p-4',
              reducedMotion
                ? 'border-champagne/30 bg-champagne/5'
                : 'border-hairline bg-elevated/50',
            )}
          >
            <div
              className={cn(
                'mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full',
                reducedMotion ? 'bg-champagne' : 'bg-mint',
              )}
            />
            <div>
              <div className="text-sm font-semibold text-ink">
                {reducedMotion ? 'Reduced motion is active' : 'Full motion is active'}
              </div>
              <p className="mt-0.5 text-xs text-faint">
                {reducedMotion
                  ? 'Your OS requests reduced motion. Animations are disabled: particle simulations are frozen, scroll choreography is replaced with simple in-view fades, and transitions are instant.'
                  : 'Full motion is running. Lenis smooth scroll, GSAP timelines, and Framer Motion micro-interactions are all active.'}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-faint">
            This is read-only — change it via{' '}
            <span className="font-mono text-ink">System Preferences → Accessibility → Reduce Motion</span>.
          </p>
        </SettingsCard>

        {/* API */}
        <SettingsCard
          index="04"
          title="API"
          description="Live connection status for the Akash backend."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="label">Base URL</div>
              <code className="font-mono text-sm text-violet">{api.base}</code>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between">
              <div className="label">Health</div>
              <div className="flex items-center gap-2.5">
                <HealthDot status={healthStatus} />
                <span className={cn(
                  'text-sm font-medium',
                  healthStatus === 'ok' ? 'text-mint' : healthStatus === 'error' ? 'text-sev-critical' : 'text-faint',
                )}>
                  {healthStatus === 'ok' ? 'Operational' : healthStatus === 'error' ? 'Unreachable' : 'Checking…'}
                </span>
              </div>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between">
              <div className="label">Last check</div>
              <span className="font-mono text-xs text-faint tnum">
                {healthQuery.dataUpdatedAt
                  ? new Date(healthQuery.dataUpdatedAt).toLocaleTimeString()
                  : '—'}
              </span>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between">
              <div className="label">Auto-refresh</div>
              <span className="text-xs text-faint">every 15 s</span>
            </div>
          </div>

          <AnimatePresence>
            {healthStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-xl border border-sev-critical/30 bg-sev-critical/10 px-4 py-3 text-xs text-sev-critical"
              >
                Cannot reach <code className="font-mono">{api.base}/health</code>.
                Verify the backend is running and VITE_API_BASE_URL is set correctly.
              </motion.div>
            )}
          </AnimatePresence>
        </SettingsCard>

      </div>
    </div>
  );
}
