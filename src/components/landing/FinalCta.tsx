'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeadlineReveal from './HeadlineReveal';

gsap.registerPlugin(ScrollTrigger);

export default function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-ticket',
        { opacity: 0, y: 50, rotate: -2 },
        {
          opacity: 1,
          y: 0,
          rotate: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative border-t border-[#242424]">
      <div className="px-6 md:px-10 py-28 md:py-40 text-center">
        <HeadlineReveal
          lines={['READY FOR', 'TAKEOFF?']}
          accentIndex={1}
          className="font-display font-bold uppercase tracking-tight leading-[0.95] text-[13vw] md:text-[9vw] mb-14"
        />

        {/* Boarding-pass style ticket */}
        <Link href="/login" className="cta-ticket inline-block group">
          <div className="boarding-pass rounded-md px-8 md:px-14 py-8 md:py-10 flex items-center gap-8 md:gap-14 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[0.5deg]">
            <div className="text-left">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/60 mb-1">
                Boarding Pass
              </p>
              <p className="font-display font-bold text-2xl md:text-4xl tracking-tight text-[#000000]">
                PF-001 · DEMO
              </p>
              <p className="font-mono text-xs text-[#000000]/60 mt-1">
                SEAT 1A · GATE OPEN
              </p>
            </div>
            <div className="barcode h-14 w-24 md:w-32 opacity-80" />
            <div className="font-display font-bold text-lime bg-[#000000] rounded px-4 py-3 text-sm md:text-base uppercase tracking-wide">
              Board Now →
            </div>
          </div>
        </Link>
      </div>

      {/* Footer strip */}
      <footer className="border-t border-[#242424] px-6 md:px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-display font-bold text-lg tracking-tight">
          PATHFINDER<span className="text-lime">.</span>
        </p>
        <p className="font-mono text-[11px] text-[#F4F4F0]/40 tracking-wider uppercase">
          Prediction prepares · Atlas confirms · You approve
        </p>
        <p className="font-mono text-[11px] text-[#F4F4F0]/40 tracking-wider uppercase">
          Atlas API × Alibaba Cloud
        </p>
      </footer>
    </section>
  );
}
