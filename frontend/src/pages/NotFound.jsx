import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/* ─── Drifting particles canvas ─────────────────────────── */
function DriftCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Respect reduced-motion: skip canvas animation
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const COLORS = [
      'rgba(122,92,255,',   // violet
      'rgba(255,61,129,',   // magenta
      'rgba(40,224,200,',   // mint
      'rgba(217,198,163,',  // champagne
    ];

    function resize() {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    }

    function spawnParticle() {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(canvas.width, canvas.height) * 0.22;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4 - 0.15, // slight upward drift
        size: Math.random() * 2.5 + 0.8,
        alpha: Math.random() * 0.5 + 0.15,
        decay: Math.random() * 0.002 + 0.001,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }

    function init() {
      resize();
      particles = Array.from({ length: 80 }, spawnParticle);
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles[i] = spawnParticle();
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * window.devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha.toFixed(2)})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();

    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      style={{ opacity: 0.6 }}
    />
  );
}

/* ─── Main page ─────────────────────────────────────────── */
export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center overflow-hidden px-6">
      {/* Particle canvas — decorative, aria-hidden */}
      <DriftCanvas />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* The 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="select-none font-display font-semibold leading-none tracking-tightest aurora-text"
            style={{ fontSize: 'clamp(6rem, 20vw, 14rem)' }}
          >
            404
          </div>
        </motion.div>

        {/* Hairline */}
        <motion.div
          className="my-6 w-24 hairline"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Copy */}
        <motion.p
          className="mb-2 font-serif text-xl text-muted italic"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Lost in the noise.
        </motion.p>

        <motion.p
          className="mb-10 max-w-sm text-sm text-faint"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          This ticket never made it to the queue.
          The page you're looking for doesn't exist or has been moved.
        </motion.p>

        {/* Buttons */}
        <motion.div
          className="flex flex-wrap gap-3 justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to="/" className="btn btn-primary" data-cursor="hover">
            Back to Home
          </Link>
          <Link to="/playground" className="btn btn-ghost" data-cursor="hover">
            Open Playground
          </Link>
        </motion.div>
      </div>

      {/* Subtle index label */}
      <motion.div
        className="absolute bottom-8 left-6 label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        Akash — Page not found
      </motion.div>
    </div>
  );
}
