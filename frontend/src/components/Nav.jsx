import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import ThemeToggle from './ThemeToggle.jsx';
import { cn } from '../lib/cn.js';

const LINKS = [
  { to: '/playground', label: 'Playground' },
  { to: '/console', label: 'Console' },
  { to: '/sentinel', label: 'Sentinel' },
  { to: '/insights', label: 'Insights' },
  { to: '/docs', label: 'Docs' },
];

function HealthDot() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15000,
    retry: false,
  });
  const ok = !isError && data?.status === 'ok';
  return (
    <span className="hidden items-center gap-2 md:inline-flex" title={ok ? 'API healthy' : 'API offline'}>
      <span
        className={cn('h-2 w-2 rounded-full', ok ? 'bg-mint' : 'bg-sev-critical')}
        style={{ boxShadow: ok ? '0 0 8px #28E0C8' : '0 0 8px #FF3B5C' }}
      />
      <span className="font-mono text-[11px] text-faint">{ok ? 'live' : 'offline'}</span>
    </span>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // The landing hero is a dark stage in BOTH themes. While the nav floats over it
  // (top of "/", before the glass background appears on scroll), force light text
  // so it never sinks into the dark. Once scrolled the glass provides contrast and
  // we follow the theme; on every other page we follow the theme from the start.
  const overHero = pathname === '/' && !scrolled;
  const barColor = overHero ? 'bg-[#F4F2EE]' : 'bg-ink';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[100] transition-all duration-500',
          scrolled ? 'py-2' : 'py-4',
        )}
      >
        <div className="shell">
          <div
            className={cn(
              'flex items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500',
              scrolled ? 'glass shadow-[0_18px_50px_-30px_rgba(0,0,0,0.6)]' : '',
            )}
          >
            <Link to="/" className={cn('group flex items-center gap-2.5', overHero ? 'text-[#F4F2EE]' : 'text-ink')} data-cursor>
              <Logo overHero={overHero} />
              <span className="font-display text-[16px] font-semibold tracking-tight">QueueStorm</span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  data-cursor
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-4 py-2 text-sm transition',
                      isActive
                        ? (overHero ? 'text-white' : 'text-ink')
                        : (overHero ? 'text-white/70 hover:text-white' : 'text-muted hover:text-ink'),
                    )
                  }
                >
                  {({ isActive }) => (
                    <span className="relative">
                      {l.label}
                      {isActive && (
                        <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-magenta" />
                      )}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <HealthDot />
              <ThemeToggle />
              <Link to="/playground" className="btn btn-primary hidden !px-4 !py-2 !text-sm md:inline-flex" data-cursor>
                Open Console
              </Link>
              <button
                onClick={() => setOpen((o) => !o)}
                className="grid h-9 w-9 place-items-center rounded-full border border-hairline lg:hidden"
                aria-label="Menu"
                data-cursor
              >
                <span className="flex flex-col gap-1">
                  <span className={cn('h-0.5 w-4 transition', barColor, open && 'translate-y-1.5 rotate-45')} />
                  <span className={cn('h-0.5 w-4 transition', barColor, open && 'opacity-0')} />
                  <span className={cn('h-0.5 w-4 transition', barColor, open && '-translate-y-1.5 -rotate-45')} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-over */}
      <div
        className={cn(
          'fixed inset-0 z-[99] transition-all duration-500 lg:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="absolute inset-0 bg-base/80 backdrop-blur-xl" onClick={() => setOpen(false)} />
        <nav className="absolute inset-x-4 top-24 grid gap-1 rounded-3xl glass p-3">
          {[{ to: '/', label: 'Home' }, ...LINKS, { to: '/settings', label: 'Settings' }].map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              className="flex items-center justify-between rounded-2xl px-5 py-4 text-lg font-medium transition hover:bg-surface"
              style={{ transitionDelay: `${i * 20}ms` }}
            >
              <span>{l.label}</span>
              <span className="font-mono text-xs text-faint">0{i + 1}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}

function Logo({ overHero }) {
  return (
    <span className={cn("grid h-8 w-8 place-items-center rounded-lg transition-colors duration-500", overHero ? "bg-[#F4F2EE] text-[#0A0A0C]" : "bg-ink text-[rgb(var(--bg-base))]")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16M7 12h13M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
