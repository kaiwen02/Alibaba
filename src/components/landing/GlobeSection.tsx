'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Radar, Layers, ShieldCheck } from 'lucide-react';
import HeadlineReveal from './HeadlineReveal';

gsap.registerPlugin(ScrollTrigger);

const FlightGlobe = dynamic(() => import('./FlightGlobe'), { ssr: false });

const FEATURES = [
  {
    id: '01',
    icon: Radar,
    kicker: 'Live Network',
    title: 'Every route, watched in real time.',
    body: 'Weather cells, airport flow restrictions, inbound delays and cancellation history — fused into one risk score per segment, refreshed continuously.',
    // Unique treatment: lime-tinted panel
    panel: 'bg-lime border-lime',
    defaultTone: 'text-black',
    defaultSub: 'text-black/50',
    hoverKicker: 'text-black/60',
    hoverTitle: 'text-black',
    hoverBody: 'text-black/75',
    hoverLine: 'bg-black/30',
    iconBox: 'border-black/25 text-black',
  },
  {
    id: '02',
    icon: Layers,
    kicker: 'Atlas Native',
    title: 'Alternatives pre-positioned before you ask.',
    body: 'When risk crosses threshold, three recovery packages — fastest, lowest cost, least disruption — are searched and held. Zero charges until you approve.',
    // Unique treatment: elevated paper card
    panel: 'bg-[#F4F4F0] border-[#F4F4F0]',
    defaultTone: 'text-black',
    defaultSub: 'text-black/50',
    hoverKicker: 'text-black/50',
    hoverTitle: 'text-black',
    hoverBody: 'text-black/70',
    hoverLine: 'bg-black/25',
    iconBox: 'border-black/20 text-black',
  },
  {
    id: '03',
    icon: ShieldCheck,
    kicker: 'Human Gated',
    title: 'Nothing books without your yes.',
    body: 'Price re-verified at approval time. Stale offers rejected. Order, pay, ticket — executed idempotently, logged end to end.',
    // Unique treatment: outlined dark panel with lime icon
    panel: 'bg-transparent border-[#242424] hover:border-lime/60 focus-within:border-lime/60',
    defaultTone: 'text-[#F4F4F0]',
    defaultSub: 'text-[#F4F4F0]/40',
    hoverKicker: 'text-lime',
    hoverTitle: 'text-[#F4F4F0]',
    hoverBody: 'text-[#F4F4F0]/70',
    hoverLine: 'bg-lime/50',
    iconBox: 'border-lime/40 text-lime',
  },
];

export default function GlobeSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Track section scroll progress for globe tilt
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          progressRef.current = self.progress;
        },
      });

      // Globe fades/scales in
      gsap.fromTo(
        '.globe-wrap',
        { opacity: 0, scale: 0.92 },
        {
          opacity: 1,
          scale: 1,
          duration: 1.4,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        }
      );

      // Cards slide up as a row, all together
      gsap.fromTo(
        '.feature-card',
        { opacity: 0, y: 70 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.feature-row', start: 'top 80%' },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="network" ref={sectionRef} className="relative px-6 md:px-12 lg:px-20 py-32 md:py-40">
      {/* ===== Centered editorial header ===== */}
      <div className="text-center max-w-4xl mx-auto mb-16">
        <p className="font-mono2 text-xs tracking-[0.4em] text-lime uppercase mb-6">
          The Network
        </p>
        <HeadlineReveal
          lines={['ONE SKY.', 'TOTAL COVERAGE.']}
          accentIndex={1}
          className="text-center"
        />
        <p className="mt-8 text-[#F4F4F0]/60 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          Twenty-five stations. Twenty-four corridors. Every simulated flight
          path below is scored, watched, and recoverable — before the traveler
          ever knows there was a problem.
        </p>
      </div>

      {/* Globe — full width, all routes visible at once */}
      <div className="globe-wrap relative h-[52vh] md:h-[60vh] mb-16">
        <FlightGlobe scrollRef={progressRef} />
        {/* Corner meta labels */}
        <span className="absolute top-4 left-0 font-mono2 text-[10px] tracking-[0.3em] text-[#F4F4F0]/35 uppercase">
          25 stations · 24 corridors
        </span>
        <span className="absolute top-4 right-0 font-mono2 text-[10px] tracking-[0.3em] text-lime/70 uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
          Simulated live traffic
        </span>
        {/* Legend */}
        <div className="absolute bottom-2 left-0 flex items-center gap-6 font-mono2 text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lime" /> Monitored
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFB454]" /> At risk
          </span>
        </div>
      </div>

      {/* All three features at once — hover to reveal */}
      <div className="feature-row grid md:grid-cols-3 gap-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.id}
              tabIndex={0}
              className={`feature-card group relative border rounded-lg min-h-[320px] overflow-hidden outline-none cursor-default transition-all duration-500 hover:-translate-y-1.5 ${f.panel}`}
            >
              {/* ===== Default: centered kicker + title ===== */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 transition-all duration-500 ease-out group-hover:opacity-0 group-hover:-translate-y-6 group-hover:scale-95 group-focus-within:opacity-0 group-focus-within:-translate-y-6 group-focus-within:scale-95">
                <span className={`w-12 h-12 rounded-full border flex items-center justify-center mb-7 ${f.iconBox}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className={`font-mono2 text-[10px] tracking-[0.35em] uppercase mb-4 ${f.defaultSub}`}>
                  {f.id} — {f.kicker}
                </p>
                <h3 className={`font-display font-bold text-2xl lg:text-[1.7rem] leading-tight tracking-tight max-w-[16rem] ${f.defaultTone}`}>
                  {f.title}
                </h3>
              </div>

              {/* ===== Hover: description revealed ===== */}
              <div className="absolute inset-0 flex flex-col justify-center p-8 opacity-0 translate-y-6 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
                <div className="flex items-center gap-3 mb-5">
                  <Icon className={`h-5 w-5 ${f.hoverKicker}`} />
                  <p className={`font-mono2 text-[10px] tracking-[0.3em] uppercase ${f.hoverKicker}`}>
                    {f.id} — {f.kicker}
                  </p>
                </div>
                <h3 className={`font-display font-bold text-xl leading-tight tracking-tight mb-4 ${f.hoverTitle}`}>
                  {f.title}
                </h3>
                <div className={`h-px w-10 mb-5 ${f.hoverLine}`} />
                <p className={`text-[15px] leading-relaxed ${f.hoverBody}`}>{f.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
