// Single GSAP setup. Registers plugins + custom eases once.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const EASE = {
  expo: 'expo.out',
  smooth: 'power3.inOut',
};

export { gsap, ScrollTrigger };
