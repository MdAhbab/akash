import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '../lib/gsap.js';

// Lenis smooth scroll wired to GSAP ScrollTrigger. Disabled under reduced-motion.
let lenisInstance = null;
export const getLenis = () => lenisInstance;

export default function SmoothScroll({ children }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenisInstance = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  // Reset scroll on route change.
  useEffect(() => {
    if (lenisInstance) lenisInstance.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname]);

  return children;
}
