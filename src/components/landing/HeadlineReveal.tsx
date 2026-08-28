'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface HeadlineRevealProps {
  lines: string[];
  accentIndex?: number; // which line gets lime color
  className?: string;
}

/**
 * Big headline lines sliding up from behind overflow masks
 * as the section scrolls into view.
 */
export default function HeadlineReveal({ lines, accentIndex = -1, className = '' }: HeadlineRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.to('.reveal-line > span', {
        y: 0,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 78%',
          toggleActions: 'play none none reverse',
        },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="mask-line reveal-line">
          <span
            className={`font-display font-bold tracking-tighter leading-[0.95] ${
              i === accentIndex ? 'text-lime' : 'text-[#F4F4F0]'
            }`}
            style={{ fontSize: 'clamp(2rem, 6.5vw, 5.5rem)' }}
          >
            {line}
          </span>
        </span>
      ))}
    </div>
  );
}
