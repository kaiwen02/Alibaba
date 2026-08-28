'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(MotionPathPlugin);

interface HeroProps {
  started: boolean;
}

const LINES = [
  { text: 'YOUR FLIGHT.', style: 'text-[#F4F4F0]' },
  { text: 'PROTECTED', style: 'text-lime' },
  { text: 'BEFORE TAKEOFF.', style: 'text-[#F4F4F0]' },
];

// The dotted flight path the little plane traces (viewBox 1200x800)
const FLIGHT_PATH =
  'M-50 640 Q 260 420 520 520 T 980 340 Q 1120 280 1250 220';

export default function Hero({ started }: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started || !containerRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

      tl.to('.hero-line > span', {
        y: 0,
        duration: 1.2,
        stagger: 0.14,
      })
        .fromTo(
          '.hero-plane-img',
          { opacity: 0, x: 80, scale: 1.06 },
          { opacity: 1, x: 0, scale: 1, duration: 1.6, ease: 'power3.out' },
          '-=0.9'
        )
        .fromTo(
          '.hero-meta',
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
          '-=1.0'
        )
        .fromTo(
          '.hero-cta',
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8 },
          '-=0.6'
        )
        .fromTo(
          '.hero-path',
          { opacity: 0 },
          { opacity: 1, duration: 1.2 },
          '-=0.8'
        );

      // Little plane endlessly tracing the dotted path
      gsap.to('.hero-mini-plane', {
        duration: 9,
        repeat: -1,
        ease: 'none',
        motionPath: {
          path: '#hero-flight-path',
          align: '#hero-flight-path',
          alignOrigin: [0.5, 0.5],
          autoRotate: true,
        },
      });

      // Dash marching animation for the path itself
      gsap.to('#hero-flight-path', {
        strokeDashoffset: -240,
        duration: 12,
        repeat: -1,
        ease: 'none',
      });
    }, containerRef);

    return () => ctx.revert();
  }, [started]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col justify-center px-6 md:px-12 lg:px-20 pt-28 pb-16 overflow-hidden"
    >
      {/* ===== Flight path layer (more visible + plane tracing) ===== */}
      <svg
        className="hero-path absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="path-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Secondary faint route */}
        <path
          d="M-50 240 Q 400 520 800 340 T 1250 560"
          stroke="#F4F4F0"
          strokeOpacity="0.14"
          strokeWidth="1.5"
          strokeDasharray="4 12"
        />

        {/* Main route — bright, glowing */}
        <path
          id="hero-flight-path"
          d={FLIGHT_PATH}
          stroke="#D4FF3F"
          strokeOpacity="0.75"
          strokeWidth="2.5"
          strokeDasharray="3 16"
          strokeLinecap="round"
          filter="url(#path-glow)"
        />

        {/* Waypoint markers */}
        <circle cx="520" cy="520" r="5" fill="#D4FF3F" />
        <circle cx="520" cy="520" r="11" fill="none" stroke="#D4FF3F" strokeOpacity="0.4" />
        <circle cx="980" cy="340" r="4" fill="#F4F4F0" />
      </svg>

      {/* The little plane that rides the dotted line */}
      <div className="hero-mini-plane absolute top-0 left-0 z-10 pointer-events-none">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="#D4FF3F">
          <path d="M21.5 15.5v-2l-8.5-5V3.2a1.2 1.2 0 0 0-2.4 0v5.3l-8.5 5v2l8.5-2.6v5.4l-2.3 1.7v1.6l3.5-1 3.5 1v-1.6l-2.3-1.7v-5.4l8.5 2.6z" />
        </svg>
      </div>

      {/* ===== Airplane image — blended seamlessly on the right ===== */}
      <div className="hero-plane-img absolute right-0 top-1/2 -translate-y-1/2 w-[92vw] md:w-[55vw] lg:w-[52vw] max-w-none pointer-events-none select-none">
        <div className="relative aspect-[3/2]">
          <Image
            src="/images/hero-plane.png"
            alt="Commercial jet in flight"
            fill
            priority
            sizes="(max-width: 768px) 92vw, 52vw"
            className="object-contain mix-blend-screen [mask-image:radial-gradient(ellipse_75%_70%_at_55%_50%,black_45%,transparent_78%)]"
          />
        </div>
      </div>

      {/* ===== Kinetic headline ===== */}
      <div className="relative z-20 max-w-[60rem]">
        {LINES.map((line, i) => (
          <span key={i} className="mask-line hero-line">
            <span
              className={`font-display font-bold tracking-tighter leading-[0.92] ${line.style}`}
              style={{ fontSize: 'clamp(2.6rem, 8.5vw, 7.5rem)' }}
            >
              {line.text}
            </span>
          </span>
        ))}
      </div>

      {/* Meta row */}
      <div className="relative z-20 mt-12 flex flex-wrap gap-x-12 gap-y-4">
        <div className="hero-meta">
          <p className="font-mono2 text-xs tracking-[0.3em] text-[#F4F4F0]/50 uppercase">Platform</p>
          <p className="font-mono2 text-sm text-[#F4F4F0] mt-1">Disruption Intelligence</p>
        </div>
        <div className="hero-meta">
          <p className="font-mono2 text-xs tracking-[0.3em] text-[#F4F4F0]/50 uppercase">Network</p>
          <p className="font-mono2 text-sm text-[#F4F4F0] mt-1">140+ Low-Cost Carriers</p>
        </div>
        <div className="hero-meta">
          <p className="font-mono2 text-xs tracking-[0.3em] text-[#F4F4F0]/50 uppercase">Core</p>
          <p className="font-mono2 text-sm text-lime mt-1">Prediction → Confirmation → Approval</p>
        </div>
      </div>

      {/* CTA */}
      <div className="hero-cta relative z-20 mt-14">
        <a
          href="/login"
          className="group inline-flex items-center gap-4 bg-lime text-[#000000] font-mono2 font-bold text-sm tracking-widest uppercase px-8 py-5 hover:bg-[#F4F4F0] transition-colors"
        >
          Board the Demo
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </a>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono2 text-xs text-[#F4F4F0]/40 tracking-[0.4em] uppercase animate-bounce z-20">
        Scroll ↓
      </div>
    </section>
  );
}
