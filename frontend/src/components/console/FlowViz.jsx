// FlowViz - animated canvas particle stream with 4 department gates.
// Particles enter left, route by department color, settle at gates on the right.
// Static poster on prefers-reduced-motion.
import { useEffect, useRef, useMemo } from 'react';
import { DEPT_COLOR } from '../../lib/format.js';
import { useUI } from '../../store/ui.js';

const GATES = [
  { key: 'customer_support', label: 'Support' },
  { key: 'dispute_resolution', label: 'Disputes' },
  { key: 'payments_ops', label: 'Payments' },
  { key: 'fraud_risk', label: 'Fraud' },
];

const DEPT_KEYS = Object.keys(DEPT_COLOR);

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// Reduced-motion static poster
function StaticPoster({ byDept }) {
  return (
    <div className="flex h-full w-full items-center justify-between gap-4 px-6 py-4">
      <div className="flex flex-col gap-1">
        <div className="label mb-2">02 - Live Flow</div>
        <div className="text-xs text-muted">Particle stream paused (reduced motion)</div>
      </div>
      <div className="flex gap-6">
        {GATES.map((g) => {
          const color = DEPT_COLOR[g.key];
          const count = byDept?.find((d) => d.department === g.key)?.n ?? 0;
          return (
            <div key={g.key} className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-1 rounded-full opacity-70"
                style={{ background: color }}
              />
              <span className="label" style={{ color }}>
                {g.label}
              </span>
              <span className="font-mono text-xs tnum text-ink">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FlowViz({ byDept }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const theme = useUI((s) => s.theme);
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Gate positions: evenly spaced on the right 85% of canvas
    function gateY(idx) {
      const slots = GATES.length;
      return (H / (slots + 1)) * (idx + 1);
    }
    const GATE_X = W * 0.85;

    // Particle pool
    const MAX_PARTICLES = 80;
    const particles = [];

    function spawnParticle() {
      const deptIdx = Math.floor(Math.random() * DEPT_KEYS.length);
      const dept = DEPT_KEYS[deptIdx];
      const gateIdx = GATES.findIndex((g) => g.key === dept);
      const targetY = gateY(gateIdx);
      const color = DEPT_COLOR[dept];
      particles.push({
        x: -8,
        y: H * 0.1 + Math.random() * H * 0.8,
        targetY,
        targetX: GATE_X,
        dept,
        color,
        rgb: hexToRgb(color),
        speed: 0.8 + Math.random() * 1.2,
        size: 2 + Math.random() * 2.5,
        alpha: 0,
        life: 0, // 0→1 = birth, 1 = alive, dead = remove
        settled: false,
        trail: [],
      });
    }

    let frame = 0;
    let lastSpawn = 0;
    const SPAWN_INTERVAL = 8; // frames between spawns

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function drawGates() {
      GATES.forEach((g, i) => {
        const x = GATE_X + 12;
        const y = gateY(i);
        const color = DEPT_COLOR[g.key];
        const rgb = hexToRgb(color);
        const load = byDept?.find((d) => d.department === g.key)?.n ?? 0;
        const maxLoad = Math.max(...(byDept?.map((d) => d.n) ?? [1]), 1);
        const loadRatio = Math.min(load / maxLoad, 1);

        // Gate circle - size reflects load
        const radius = 6 + loadRatio * 8;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.7)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Label
        ctx.font = '600 10px Satoshi, system-ui, sans-serif';
        ctx.letterSpacing = '0.1em';
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`;
        ctx.textAlign = 'left';
        ctx.fillText(g.label.toUpperCase(), x + radius + 6, y + 4);

        // Load count
        if (load > 0) {
          ctx.font = '600 9px JetBrains Mono, monospace';
          ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
          ctx.fillText(load, x + radius + 6, y + 16);
        }
      });
    }

    function drawGrid() {
      // Theme-aware guide lines (dark ink on Porcelain, light on Obsidian).
      const ink = theme === 'light' ? '20, 18, 16' : '255, 255, 255';
      const aLine = theme === 'light' ? 0.06 : 0.03;
      const aEntry = theme === 'light' ? 0.08 : 0.04;
      // Subtle horizontal guide lines
      ctx.strokeStyle = `rgba(${ink}, ${aLine})`;
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (H / 8) * i);
        ctx.lineTo(W, (H / 8) * i);
        ctx.stroke();
      }
      // Vertical entry line
      ctx.strokeStyle = `rgba(${ink}, ${aEntry})`;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(20, H);
      ctx.stroke();
    }

    function tick() {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = 'rgba(10,10,12,0)';
      ctx.fillRect(0, 0, W, H);

      drawGrid();
      drawGates();

      // Spawn
      if (frame - lastSpawn >= SPAWN_INTERVAL && particles.length < MAX_PARTICLES) {
        spawnParticle();
        lastSpawn = frame;
      }

      // Update + draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (!p.settled) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Bezier-like: go mostly horizontal first, then curve to gate
          const progress = 1 - Math.min(dist / (W * 0.85), 1);
          const curveInfluence = easeInOut(progress);

          const directVX = (dx / dist) * p.speed;
          const directVY = (dy / dist) * p.speed * curveInfluence * 2;

          p.x += directVX + (Math.random() - 0.5) * 0.3;
          p.y += directVY * 0.5 + (p.targetY - p.y) * 0.018;

          // Alpha fade in/out
          if (p.x < 60) {
            p.alpha = Math.min(p.alpha + 0.08, 1);
          } else if (dist < 30) {
            p.alpha = Math.max(p.alpha - 0.05, 0);
          }

          if (dist < 8) {
            p.settled = true;
            particles.splice(i, 1);
            continue;
          }
        }

        // Trail
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 12) p.trail.shift();

        // Draw trail
        for (let j = 1; j < p.trail.length; j++) {
          const a = (j / p.trail.length) * p.alpha * 0.35;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},${a})`;
          ctx.lineWidth = p.size * 0.5;
          ctx.moveTo(p.trail[j - 1].x, p.trail[j - 1].y);
          ctx.lineTo(p.trail[j].x, p.trail[j].y);
          ctx.stroke();
        }

        // Glow halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grad.addColorStop(0, `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},${p.alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},${p.alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(tick);
    }

    // Run only while visible AND on-screen: pause for hidden tabs and when the
    // viz is scrolled out of view, so it never burns CPU in the background.
    let inView = true;
    const start = () => {
      if (animRef.current == null) animRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
    const sync = () => (inView && !document.hidden ? start() : stop());

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }, { rootMargin: '0px' });
    io.observe(canvas);

    const handleVisibility = () => sync();
    document.addEventListener('visibilitychange', handleVisibility);

    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [byDept, reducedMotion, theme]);

  if (reducedMotion) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-hairline bg-elevated">
        <StaticPoster byDept={byDept} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-hairline bg-elevated">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-full w-full"
        style={{ display: 'block' }}
      />
      {/* Entry label */}
      <div
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2"
        style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
      >
        <span className="label ml-3 text-faint">Incoming</span>
      </div>
    </div>
  );
}
