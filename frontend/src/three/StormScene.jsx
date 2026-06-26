import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The signature hero scene: a storm of ~9k ticket-particles that, as `progress`
 * (a ref holding 0..1) rises, cools from magenta chaos into four ordered,
 * department-colored streams flowing toward four gates. Chaos -> order.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute vec3 aChaos;
  attribute vec3 aTarget;
  attribute float aStream;
  varying float vStream;
  varying float vAlpha;
  varying float vProg;

  void main() {
    vStream = aStream;
    vProg = uProgress;
    float t = uTime;

    // chaotic vortex swirl around the Y axis + turbulence
    float ang = aSeed * 6.2831853 + t * (0.12 + aSeed * 0.18);
    float rad = length(aChaos.xz);
    vec3 chaos = vec3(cos(ang) * rad, aChaos.y + sin(t * 0.5 + aSeed * 6.28) * 0.35, sin(ang) * rad);
    chaos += 0.35 * vec3(sin(t + aChaos.y * 2.0), cos(t * 0.8 + aChaos.x * 2.0), sin(t * 0.6 + aChaos.z * 2.0));

    // organized: flow along the stream in +x, wrapping for continuous motion
    vec3 target = aTarget;
    float flow = mod(aTarget.x + t * 0.55 + aSeed * 2.0, 7.0) - 3.5;
    target.x = flow;

    float p = smoothstep(0.0, 1.0, uProgress);
    vec3 pos = mix(chaos, target, p);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 / max(0.1, -mv.z));
    vAlpha = mix(0.45, 0.85, p);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vStream;
  varying float vAlpha;
  varying float vProg;

  vec3 streamColor(float s){
    if (s < 0.5) return vec3(0.204, 0.780, 0.878); // support  #34C7E0
    else if (s < 1.5) return vec3(0.478, 0.361, 1.0); // disputes #7A5CFF
    else if (s < 2.5) return vec3(0.878, 0.698, 0.235); // payments #E0B23C
    else return vec3(1.0, 0.239, 0.506); // fraud    #FF3D81
  }

  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    vec3 chaosCol = vec3(1.0, 0.239, 0.506);   // magenta hot
    vec3 col = mix(chaosCol, streamColor(vStream), smoothstep(0.0, 1.0, vProg));
    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

function Storm({ progress, count }) {
  const matRef = useRef();
  const cur = useRef(0);

  const { geometry, uniforms } = useMemo(() => {
    const streamY = [1.25, 0.42, -0.42, -1.25];
    const aSeed = new Float32Array(count);
    const aChaos = new Float32Array(count * 3);
    const aTarget = new Float32Array(count * 3);
    const aStream = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const s = i % 4;
      aStream[i] = s;
      aSeed[i] = Math.random();

      // chaos: a fat torus/vortex shell
      const r = 1.4 + Math.random() * 1.9;
      const a = Math.random() * Math.PI * 2;
      aChaos[i * 3] = Math.cos(a) * r;
      aChaos[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
      aChaos[i * 3 + 2] = Math.sin(a) * r;

      // target: a thin horizontal stream line for its department
      aTarget[i * 3] = (Math.random() - 0.5) * 7;
      aTarget[i * 3 + 1] = streamY[s] + (Math.random() - 0.5) * 0.16;
      aTarget[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    g.setAttribute('aChaos', new THREE.BufferAttribute(aChaos, 3));
    g.setAttribute('aTarget', new THREE.BufferAttribute(aTarget, 3));
    g.setAttribute('aStream', new THREE.BufferAttribute(aStream, 1));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    const u = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSize: { value: 26 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    };
    return { geometry: g, uniforms: u };
  }, [count]);

  useFrame((state, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uTime.value += delta;
    const target = progress.current ?? 0;
    cur.current += (target - cur.current) * Math.min(1, delta * 3);
    u.uProgress.value = cur.current;
    // gentle auto-rotation that eases out as it organizes
    state.scene.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.15 * (1 - cur.current);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function StormScene({ progress }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = isMobile ? 3800 : 9000;

  const wrapRef = useRef(null);
  const [inView, setInView] = useState(true);

  // Stop the GPU render loop entirely once the hero scrolls out of view
  // (design §9). Cuts idle CPU/GPU/battery while the rest of the page renders.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const frameloop = reduce ? 'demand' : inView ? 'always' : 'never';

  return (
    <div ref={wrapRef} className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 6.2], fov: 50 }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={frameloop}
      >
        <Storm progress={progress} count={count} />
      </Canvas>
    </div>
  );
}
