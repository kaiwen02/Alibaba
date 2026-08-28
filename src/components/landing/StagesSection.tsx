'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Radar, RadioTower, Stamp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const STAGES = [
  {
    num: '01',
    title: 'PREDICTION',
    tagline: 'Prepares silently.',
    icon: Radar,
    body: 'The risk engine weighs weather (50%), airport disruption (30%), inbound delay (15%) and cancellation history (5%). Above 0.70, three recovery packages are pre-positioned via Atlas. No alerts. No charges.',
  },
  {
    num: '02',
    title: 'CONFIRMATION',
    tagline: 'Atlas confirms.',
    icon: RadioTower,
    body: 'A signed webhook is the sole trigger. Signature verified, payload validated, event deduplicated. Packages activate, the traveler gets a deep link. Fast 2xx, heavy work async.',
  },
  {
    num: '03',
    title: 'APPROVAL',
    tagline: 'You approve.',
    icon: Stamp,
    body: 'The traveler authenticates, reviews refreshed pricing, and consents. Only then: order, pay, poll until ticketed. Idempotency locks kill double-clicks dead.',
  },
];

export default function StagesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // All three cards enter together, staggered left → right
      gsap.fromTo(
        '.stage-card',
        { opacity: 0, y: 90 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.stage-grid', start: 'top 78%' },
        }
      );

      // Connector line draws itself across the three cards
      gsap.fromTo(
        '.stage-connector',
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.6,
          ease: 'power2.inOut',
          scrollTrigger: { trigger: '.stage-grid', start: 'top 75%' },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="protocol" ref={sectionRef} className="relative px-6 md:px-12 lg:px-20 py-32 md:py-40">
      {/* Section header */}
      <div className="mb-16">
        <p className="font-mono2 text-xs tracking-[0.35em] text-lime uppercase mb-3">
          The Protocol
        </p>
        <h2 className="font-display font-bold text-4xl md:text-6xl tracking-tighter">
          THREE GATES.
          <br />
          ZERO SURPRISES.
        </h2>
        <p className="font-mono2 text-[11px] tracking-[0.25em] text-[#F4F4F0]/40 uppercase mt-6">
          Hover a gate to inspect it
        </p>
      </div>

      {/* All three gates at once */}
      <div className="relative">
        {/* Connector line behind cards (desktop) */}
        <div className="stage-connector hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent origin-left -z-0" />

        <div className="stage-grid relative z-10 grid lg:grid-cols-3 gap-6">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.num}
                tabIndex={0}
                className="stage-card group relative bg-[#0d0d0d] border border-[#242424] rounded-lg min-h-[440px] overflow-hidden outline-none transition-colors duration-500 hover:border-lime/60 focus-within:border-lime/60 cursor-default"
              >
                {/* ===== Default state: centered monogram ===== */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 transition-all duration-500 ease-out group-hover:opacity-0 group-hover:-translate-y-8 group-hover:scale-95 group-focus-within:opacity-0 group-focus-within:-translate-y-8 group-focus-within:scale-95">
                  <div className="w-12 h-12 rounded-full border border-[#242424] flex items-center justify-center mb-8">
                    <Icon className="h-5 w-5 text-[#F4F4F0]/60" />
                  </div>
                  <span className="font-display font-bold text-8xl lg:text-9xl tracking-tighter leading-none text-lime">
                    {stage.num}
                  </span>
                  <h3 className="font-display font-bold text-2xl lg:text-3xl tracking-tight mt-6 text-[#F4F4F0]">
                    {stage.title}
                  </h3>
                  <span className="mt-8 font-mono2 text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/30">
                    Gate {stage.num} / 03
                  </span>
                </div>

                {/* ===== Hover state: full description ===== */}
                <div className="absolute inset-0 flex flex-col justify-center p-8 lg:p-10 opacity-0 translate-y-8 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="font-display font-bold text-4xl tracking-tighter text-lime leading-none">
                      {stage.num}
                    </span>
                    <div>
                      <h3 className="font-display font-bold text-xl tracking-tight text-[#F4F4F0] leading-tight">
                        {stage.title}
                      </h3>
                      <p className="font-mono2 text-xs text-lime/80">{stage.tagline}</p>
                    </div>
                  </div>

                  <div className="h-px w-12 bg-lime/50 mb-6" />

                  <p className="text-[#F4F4F0]/75 text-[15px] leading-relaxed">
                    {stage.body}
                  </p>

                  <div className="flex items-center gap-3 font-mono2 text-[10px] text-[#F4F4F0]/40 tracking-[0.25em] uppercase mt-8">
                    <Icon className="h-3.5 w-3.5 text-lime/70" />
                    Gate {stage.num} / 03
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
