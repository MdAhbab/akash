/**
 * Sentinel Radar — 2D canvas radar sweep.
 * Blips: distance from center = 1 - risk_score (higher risk = closer to center).
 * Angle is deterministic from ticket_id hash.
 * Reduced-motion: static frame (no sweep rotation, no pulse).
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEVERITY_COLOR } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';
import { useUI } from '../../store/ui.js';

/* deterministic angle from a string */
function hashAngle(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return ((h % 360) * Math.PI) / 180;
}

function buildBlips(reviews) {
  return (reviews || []).map((r) => ({
    id: r.ticket_id,
    angle: hashAngle(r.ticket_id),
    radius: 1 - (r.risk_score ?? 0.5),
    color: SEVERITY_COLOR[r.severity] || '#8A857C',
    critical: r.severity === 'critical',
    label: r.ticket_id,
    snippet: (r.message || '').slice(0, 60),
    risk: r.risk_score,
    severity: r.severity,
  }));
}

const RING_COUNT = 4;

export default function Radar({ reviews = [], reducedMotion = false }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const sweepAngleRef = useRef(0);
  const trailsRef = useRef({}); // blip id → glow intensity
  const navigate = useNavigate();
  const theme = useUI((s) => s.theme);

  const [tooltip, setTooltip] = useState(null); // { x, y, blip }
  // Memoized so the draw callback and the rAF loop stay stable across renders
  // (tooltip hovers + the 5s poll). Also keeps the per-blip hit-test coords
  // (_bx/_by) on persistent objects between frames and pointer events.
  const blips = useMemo(() => buildBlips(reviews), [reviews]);

  /* draw one frame */
  const draw = useCallback(
    (ctx, w, h, sweepAngle) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy) - 12;

      // Theme-aware structural lines: dark ink on Porcelain, light on Obsidian,
      // so rings/crosshairs stay visible in both themes.
      const ink = theme === 'light' ? '20, 18, 16' : '255, 255, 255';
      const ringAlpha = theme === 'light' ? 0.12 : 0.07;
      const crossAlpha = theme === 'light' ? 0.09 : 0.05;

      /* background: subtle radial */
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      grad.addColorStop(0, 'rgba(122,92,255,0.06)');
      grad.addColorStop(1, 'rgba(10,10,12,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      /* concentric rings */
      for (let i = 1; i <= RING_COUNT; i++) {
        const r = (maxR * i) / RING_COUNT;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ink}, ${ringAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* cross-hair lines */
      ctx.save();
      ctx.strokeStyle = `rgba(${ink}, ${crossAlpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      /* ring labels */
      const labels = ['100', '75', '50', '25'];
      for (let i = 0; i < RING_COUNT; i++) {
        const r = (maxR * (i + 1)) / RING_COUNT;
        ctx.fillStyle = 'rgba(110,109,104,0.6)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(labels[i], cx + r + 3, cy - 3);
      }

      if (!reducedMotion) {
        /* sweep cone — translucent wedge rotated to the current sweep angle */
        const coneAngle = Math.PI / 8;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sweepAngle);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxR, -coneAngle / 2, coneAngle / 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(40,224,200,0.08)';
        ctx.fill();

        /* sweep line */
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(maxR, 0);
        ctx.strokeStyle = 'rgba(40,224,200,0.7)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(40,224,200,0.8)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      /* blips */
      blips.forEach((b) => {
        const r = b.radius * maxR * 0.88 + maxR * 0.06; // keep min dist from center
        const bx = cx + r * Math.cos(b.angle);
        const by = cy + r * Math.sin(b.angle);

        // Glow on sweep pass
        const trail = trailsRef.current[b.id] || 0;
        if (trail > 0) {
          ctx.beginPath();
          ctx.arc(bx, by, 10 * trail + 4, 0, Math.PI * 2);
          ctx.fillStyle = `${b.color}${Math.floor(trail * 40)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.fill();
        }

        /* outer glow */
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fillStyle = `${b.color}22`;
        ctx.fill();

        /* dot */
        ctx.beginPath();
        ctx.arc(bx, by, b.critical ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.critical ? 12 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        /* critical: outer ring pulse via trail */
        if (b.critical && !reducedMotion) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
          ctx.beginPath();
          ctx.arc(bx, by, 8 + pulse * 4, 0, Math.PI * 2);
          ctx.strokeStyle = `${b.color}${Math.floor(pulse * 150)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        /* store pixel pos for hit testing */
        b._bx = bx;
        b._by = by;
      });

      /* center dot */
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,224,200,0.5)';
      ctx.fill();
    },
    [blips, reducedMotion, theme],
  );

  /* animation loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    if (reducedMotion) {
      draw(ctx, size, size, 0);
      return;
    }

    let last = 0;
    const loop = (ts) => {
      const dt = ts - last;
      last = ts;
      sweepAngleRef.current = (sweepAngleRef.current + (dt / 1000) * ((Math.PI * 2) / 4)) % (Math.PI * 2);

      // detect sweep passing a blip
      blips.forEach((b) => {
        const sa = sweepAngleRef.current % (Math.PI * 2);
        const ba = ((b.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const diff = Math.abs(sa - ba);
        if (diff < 0.15 || diff > Math.PI * 2 - 0.15) {
          trailsRef.current[b.id] = 1.0;
        } else if (trailsRef.current[b.id] > 0) {
          trailsRef.current[b.id] = Math.max(0, trailsRef.current[b.id] - dt / 700);
        }
      });

      draw(ctx, size, size, sweepAngleRef.current);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, reducedMotion, blips]);

  /* resize observer */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  /* mouse handling */
  const HIT_RADIUS = 14;
  const getBlipAt = useCallback(
    (evt) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = evt.clientX - rect.left;
      const my = evt.clientY - rect.top;
      for (const b of blips) {
        if (b._bx === undefined) continue;
        const dx = b._bx - mx;
        const dy = b._by - my;
        if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) return b;
      }
      return null;
    },
    [blips],
  );

  const onMouseMove = useCallback(
    (evt) => {
      const b = getBlipAt(evt);
      if (b) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        setTooltip({
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top,
          blip: b,
        });
        canvas.style.cursor = 'pointer';
      } else {
        setTooltip(null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
      }
    },
    [getBlipAt],
  );

  const onClick = useCallback(
    (evt) => {
      const b = getBlipAt(evt);
      if (b) navigate(`/ticket/${b.id}`);
    },
    [getBlipAt, navigate],
  );

  const onMouseLeave = () => setTooltip(null);

  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="w-full h-full"
        style={{ cursor: 'crosshair', display: 'block' }}
        onMouseMove={onMouseMove}
        onClick={onClick}
        onMouseLeave={onMouseLeave}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 glass rounded-xl px-3 py-2 text-xs max-w-[200px]"
          style={{
            left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth || 300) - 210),
            top: tooltip.y - 8,
          }}
        >
          <div className="font-mono text-mint mb-0.5">{tooltip.blip.label}</div>
          <div className="text-muted leading-tight mb-1">
            {tooltip.blip.snippet || '—'}
          </div>
          <div className="tnum" style={{ color: tooltip.blip.color }}>
            Risk {Math.round((tooltip.blip.risk || 0) * 100)}%
          </div>
        </div>
      )}

      {/* Static ring labels for a11y / reduced-motion users */}
      {reducedMotion && (
        <p className="sr-only">
          Radar showing {blips.length} flagged tickets. All cases listed in the review queue below.
        </p>
      )}
    </div>
  );
}
