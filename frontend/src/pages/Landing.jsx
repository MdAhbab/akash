import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { gsap, ScrollTrigger } from '../lib/gsap.js';
import Reveal from '../components/ui/Reveal.jsx';
import { useCountUp } from '../components/ui/StatTile.jsx';

const StormScene = lazy(() => import('../three/StormScene.jsx'));

const GATES = [
  { label: 'Support', color: '#34C7E0' },
  { label: 'Disputes', color: '#7A5CFF' },
  { label: 'Payments', color: '#E0B23C' },
  { label: 'Fraud', color: '#FF3D81' },
];

const QUESTIONS = [
  { n: '01', k: 'Evidence', t: 'Which transaction is this really about?', d: 'Akash matches the complaint to the customer’s recent transactions and returns the relevant transaction id — or null when nothing in the history fits.', c: '#28E0C8' },
  { n: '02', k: 'Verdict', t: 'Does the data back the claim?', d: 'consistent, inconsistent, or insufficient_data. When the evidence is genuinely unclear, Akash says so instead of guessing.', c: '#7A5CFF' },
  { n: '03', k: 'Routing', t: 'Who handles it, and how urgent?', d: 'Case type, severity, and the right department — disputes, payments, merchant, agent, or fraud — decided by policy, not vibes.', c: '#34C7E0' },
  { n: '04', k: 'Safe reply', t: 'What can we tell the customer?', d: 'A professional draft that never asks for a PIN or OTP and never promises a refund it has no authority to confirm.', c: '#FF3D81' },
];

const JOURNEY = ['Received', 'Complaint read', 'Evidence matched', 'Verdict', 'Routed', 'Safe reply'];

const FEATURES = [
  { n: '01', t: 'Investigator Playground', d: 'Paste a complaint and a few transactions, then watch Akash identify the relevant transaction, deliver an evidence verdict, route the case, and draft a safe reply — with a cinematic reveal.', to: '/playground', tag: 'Try it live' },
  { n: '02', t: 'Command Center', d: 'A living operations floor: tickets streaming into department gates, severity heatmaps, department load, throughput and latency, in real time.', to: '/console', tag: 'Live ops' },
  { n: '03', t: 'Sentinel', d: 'A fraud radar where every phishing and critical case surfaces for human review — risk by distance, severity by colour, an SLA on every blip.', to: '/sentinel', tag: 'Human review' },
  { n: '04', t: 'Insights', d: 'The numbers, read back to you: volume trends, case mix, a triage funnel, and plain-language anomaly callouts written from real data.', to: '/insights', tag: 'Analytics' },
];

export default function Landing() {
  const heroRef = useRef(null);
  const progress = useRef(0);
  const [stage, setStage] = useState(0); // 0..1 mirror of progress for DOM
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Drive the storm: scroll through the hero maps to chaos -> order.
  useEffect(() => {
    let raf;
    const onScroll = () => {
      const el = heroRef.current;
      if (!el) return;
      const top = el.offsetTop;
      const h = el.offsetHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, (window.scrollY - top) / Math.max(1, h)));
      progress.current = p;
      raf = requestAnimationFrame(() => setStage(p));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Horizontal pinned "four questions" + scroll-drawn journey path.
  const trackRef = useRef(null);
  const pathRef = useRef(null);
  useEffect(() => {
    if (reduce) return undefined;
    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray('.hpanel');
      if (panels.length && trackRef.current) {
        gsap.to(panels, {
          xPercent: -100 * (panels.length - 1),
          ease: 'none',
          scrollTrigger: {
            trigger: trackRef.current,
            pin: true,
            scrub: 0.6,
            end: () => '+=' + window.innerWidth * (panels.length - 1),
            invalidateOnRefresh: true,
          },
        });
      }
      if (pathRef.current) {
        const len = pathRef.current.getTotalLength();
        gsap.set(pathRef.current, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(pathRef.current, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: '#journey', start: 'top 65%', end: 'bottom 75%', scrub: 0.8 },
        });
      }
    });
    return () => ctx.revert();
  }, [reduce]);

  return (
    <div>
      {/* ============ HERO (dark stage in both themes) ============ */}
      <section ref={heroRef} className="relative h-[230vh]" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #131019 0%, #0A0A0C 55%, #08080A 100%)' }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0">
            <Suspense fallback={null}>
              {!reduce && <StormScene progress={progress} />}
            </Suspense>
            {reduce && <PosterStorm />}
          </div>

          {/* vignette + grain handled globally */}
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(110% 70% at 50% 40%, transparent 40%, rgba(8,8,10,0.55) 100%)' }} />

          <div className="relative z-10 flex h-full flex-col justify-between py-28 text-[#F4F2EE]">
            <div className="shell">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FF3D81' }} /> bKash · SUST CSE Carnival 2026
              </div>
              <h1 className="font-display text-[clamp(2.6rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.03em]">
                <KineticLine words={['The', 'complaint', 'says', 'one', 'thing.']} stage={stage} from={0} to={0.4} />
                <span className="block aurora-text">
                  <KineticLine words={['The', 'evidence', 'says', 'another.']} stage={stage} from={0.25} to={0.7} />
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-base text-white/65 md:text-lg">
                Akash is an investigator copilot for digital-finance support. It reads each ticket and the customer’s recent transactions, decides what actually happened, routes the case, and drafts a safe reply — in milliseconds.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/playground" className="btn !bg-white !text-black hover:-translate-y-0.5" data-cursor>Open the Console</Link>
                <Link to="/docs" className="btn border border-white/20 text-white hover:border-white/50" data-cursor>Read the API</Link>
              </div>
            </div>

            {/* department gates resolve as the storm organises */}
            <div className="shell">
              <div className="grid grid-cols-4 gap-2 md:gap-6" style={{ opacity: Math.max(0, (stage - 0.45) / 0.4), transform: `translateY(${(1 - Math.min(1, stage / 0.6)) * 20}px)` }}>
                {GATES.map((g, i) => (
                  <div key={g.label} className="border-t pt-3" style={{ borderColor: g.color }}>
                    <div className="font-mono text-[11px] text-white/50">0{i + 1}</div>
                    <div className="text-sm font-medium" style={{ color: g.color }}>{g.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/40">
                <span>Scroll to follow one investigation</span>
                <span className="h-px w-12 bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOUR QUESTIONS (pinned horizontal) ============ */}
      <section className="relative bg-base py-16">
        <div className="shell mb-10">
          <div className="label">The service answers four questions</div>
        </div>
        {reduce ? (
          <div className="shell grid gap-6 md:grid-cols-2">
            {QUESTIONS.map((q) => <QuestionPanel key={q.n} q={q} static />)}
          </div>
        ) : (
          <div ref={trackRef} className="relative h-screen overflow-hidden">
            <div className="flex h-full" style={{ width: `${QUESTIONS.length * 100}vw` }}>
              {QUESTIONS.map((q) => (
                <div key={q.n} className="hpanel flex h-full w-screen items-center">
                  <div className="shell w-full"><QuestionPanel q={q} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ TICKET JOURNEY (scroll-drawn path) ============ */}
      <section id="journey" className="relative overflow-hidden bg-base py-28">
        <div className="shell">
          <Reveal><div className="label mb-3">The journey of one ticket</div></Reveal>
          <Reveal delay={0.05}>
            <h2 className="max-w-2xl font-display text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-tight">
              From noise to a routed verdict — traced end to end.
            </h2>
          </Reveal>
          <div className="relative mt-20">
            <svg viewBox="0 0 1200 200" className="w-full" fill="none" preserveAspectRatio="xMidYMid meet">
              <path
                ref={pathRef}
                d="M20 150 C 180 150, 200 60, 340 60 S 520 150, 640 120 S 820 40, 960 90 S 1120 150, 1180 60"
                stroke="url(#aurora)" strokeWidth="2.5" strokeLinecap="round"
              />
              <defs>
                <linearGradient id="aurora" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF3D81" /><stop offset="0.5" stopColor="#7A5CFF" /><stop offset="1" stopColor="#28E0C8" />
                </linearGradient>
              </defs>
            </svg>
            <div className="mt-6 grid grid-cols-3 gap-4 md:grid-cols-6">
              {JOURNEY.map((s, i) => (
                <Reveal key={s} delay={i * 0.06}>
                  <div className="border-t border-line pt-3">
                    <div className="font-mono text-[11px] text-faint">0{i + 1}</div>
                    <div className="text-sm font-medium text-ink">{s}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE SHOWCASE (editorial rows) ============ */}
      <section className="bg-base py-16">
        <div className="shell">
          <Reveal><div className="label mb-12">Four surfaces, one engine</div></Reveal>
          <div className="divide-y divide-hairline">
            {FEATURES.map((f, i) => (
              <Reveal key={f.n} y={36}>
                <Link to={f.to} className="group grid gap-6 py-12 md:grid-cols-[120px_1fr_auto] md:items-center" data-cursor>
                  <div className="font-serif text-5xl text-faint transition group-hover:text-violet">{f.n}</div>
                  <div>
                    <div className="font-display text-2xl font-semibold md:text-3xl">{f.t}</div>
                    <p className="mt-2 max-w-xl text-muted">{f.d}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label">{f.tag}</span>
                    <span className="grid h-11 w-11 place-items-center rounded-full border border-line transition group-hover:bg-ink group-hover:text-base">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS RIBBON ============ */}
      <StatsRibbon />

      {/* ============ TRUST / SAFETY ============ */}
      <section className="bg-base py-28">
        <div className="shell">
          <div className="card grid items-center gap-8 p-10 md:grid-cols-[1fr_auto] md:p-16">
            <div>
              <div className="label mb-4">A promise built into the model</div>
              <h2 className="max-w-2xl font-display text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold leading-tight">
                We will <span className="aurora-text">never</span> ask a customer for their PIN, OTP, password, or card number.
              </h2>
              <p className="mt-4 max-w-xl text-muted">Every generated line passes a safety scanner before it is ever shown. Phishing and critical cases are flagged for a human, instantly.</p>
            </div>
            <Link to="/sentinel" className="btn btn-ghost shrink-0" data-cursor>See Sentinel</Link>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative overflow-hidden py-32" style={{ background: 'radial-gradient(100% 100% at 50% 0%, #15101d 0%, #0A0A0C 70%)' }}>
        <div className="shell text-center text-[#F4F2EE]">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-display text-[clamp(2.2rem,6vw,5rem)] font-semibold leading-[0.95]">
              Step onto the operations floor.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 flex justify-center gap-3">
              <Link to="/playground" className="btn !bg-white !text-black" data-cursor>Open the Console</Link>
              <Link to="/console" className="btn border border-white/20 text-white hover:border-white/50" data-cursor>View live ops</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function KineticLine({ words, stage, from, to }) {
  const span = to - from;
  return (
    <span className="inline-flex flex-wrap gap-x-[0.25em]">
      {words.map((w, i) => {
        const wordAt = from + (span * i) / words.length;
        const shown = stage >= wordAt - 0.001 || stage === 0 ? Math.min(1, Math.max(0, (stage - wordAt) / 0.08 + 1)) : 0;
        const reveal = stage === 0 && from === 0 ? 1 : shown; // show first line at top
        return (
          <span key={i} className="inline-block overflow-hidden">
            <span className="inline-block" style={{ transform: `translateY(${(1 - reveal) * 100}%)`, opacity: reveal, transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.5s' }}>{w}</span>
          </span>
        );
      })}
    </span>
  );
}

function QuestionPanel({ q, static: isStatic }) {
  return (
    <div className={`grid items-center gap-8 ${isStatic ? 'card p-8' : 'md:grid-cols-[1fr_1fr]'}`}>
      <div>
        <div className="font-serif text-[clamp(4rem,12vw,11rem)] leading-none" style={{ color: q.c }}>{q.n}</div>
        <div className="label mt-4">{q.k}</div>
      </div>
      <div>
        <h3 className="font-display text-[clamp(1.6rem,4vw,3rem)] font-semibold leading-tight">{q.t}</h3>
        <p className="mt-4 max-w-md text-lg text-muted">{q.d}</p>
        <div className="mt-6 h-1 w-24 rounded-full" style={{ background: q.c }} />
      </div>
    </div>
  );
}

function StatsRibbon() {
  const a = useCountUp(12840, 0, 1600);
  const b = useCountUp(38, 0, 1600);
  const c = useCountUp(0, 0, 1600);
  const stats = [
    { v: a, l: 'tickets investigated', s: 'across every channel' },
    { v: b, l: 'ms median latency', s: 'rules-first, GPU-free' },
    { v: c, l: 'PINs ever requested', s: 'safety, by construction' },
  ];
  return (
    <section className="border-y border-hairline bg-surface py-20">
      <div className="shell grid gap-12 md:grid-cols-3">
        {stats.map((s) => (
          <Reveal key={s.l}>
            <div>
              <div className="font-display text-[clamp(3rem,7vw,5.5rem)] font-semibold tnum leading-none">{s.v}</div>
              <div className="mt-3 text-lg text-ink">{s.l}</div>
              <div className="text-sm text-faint">{s.s}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// Static fallback for reduced-motion / no-WebGL.
function PosterStorm() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl" style={{ background: 'conic-gradient(from 0deg, #FF3D81, #7A5CFF, #28E0C8, #FF3D81)' }} />
    </div>
  );
}
