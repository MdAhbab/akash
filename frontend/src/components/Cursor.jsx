import { useEffect, useRef } from 'react';

// Magnetic custom cursor (desktop only; hidden on touch via CSS).
export default function Cursor() {
  const ring = useRef(null);
  const dot = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return undefined;
    const r = ring.current;
    const d = dot.current;
    let rx = window.innerWidth / 2, ry = window.innerHeight / 2;
    let dx = rx, dy = ry;
    let raf;

    const onMove = (e) => {
      dx = e.clientX; dy = e.clientY;
      d.style.transform = `translate(${dx}px, ${dy}px) translate(-50%,-50%)`;
      const t = e.target;
      const interactive = t.closest('a, button, [data-cursor], input, textarea, select');
      r.style.width = interactive ? '52px' : '30px';
      r.style.height = interactive ? '52px' : '30px';
      r.style.background = interactive ? 'rgb(var(--accent-violet) / 0.12)' : 'transparent';
    };
    const loop = () => {
      rx += (dx - rx) * 0.18;
      ry += (dy - ry) * 0.18;
      r.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </>
  );
}
