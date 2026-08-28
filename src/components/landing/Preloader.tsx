'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface PreloaderProps {
  onEnter: () => void;
}

export default function Preloader({ onEnter }: PreloaderProps) {
  const [leaving, setLeaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (leaving) return;
    setLeaving(true);

    const overlay = overlayRef.current;
    if (!overlay) return onEnter();

    // Curtain reveal: lime panel slides up, revealing content beneath
    gsap.to(overlay, {
      yPercent: -100,
      duration: 1.1,
      ease: 'power4.inOut',
      onComplete: onEnter,
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handleEnter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-lime flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleEnter}
    >
      {/* Spinning PF monogram */}
      <div className="relative">
        <div className="pf-monogram w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#000000] flex items-center justify-center">
          <span className="font-display font-bold text-5xl md:text-6xl text-lime tracking-tighter">
            PF
          </span>
        </div>
        {/* Orbit ring */}
        <div className="absolute -inset-4 rounded-full border-2 border-dashed border-[#000000]/30 animate-[spin_8s_linear_infinite]" />
      </div>

      {/* Prompt */}
      <div className="mt-16 text-center">
        <p className="font-mono2 text-[#000000] text-sm md:text-base tracking-[0.35em] uppercase">
          Enter Pathfinder
          <span className="blink ml-2">_</span>
        </p>
        <p className="font-mono2 text-[#000000]/60 text-xs mt-3 tracking-widest uppercase">
          Click anywhere or press Enter
        </p>
      </div>

      {/* Corner coordinates deco */}
      <div className="absolute top-6 left-6 font-mono2 text-[#000000]/70 text-xs tracking-widest">
        1.3521° N / 103.8198° E
      </div>
      <div className="absolute top-6 right-6 font-mono2 text-[#000000]/70 text-xs tracking-widest">
        PF-INTL TERMINAL 01
      </div>
      <div className="absolute bottom-6 left-6 font-mono2 text-[#000000]/70 text-xs tracking-widest">
        ALL SYSTEMS NOMINAL
      </div>
      <div className="absolute bottom-6 right-6 font-mono2 text-[#000000]/70 text-xs tracking-widest">
        RWY 27L CLEARED
      </div>
    </div>
  );
}
