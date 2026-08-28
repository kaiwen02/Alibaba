'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeadlineReveal from './HeadlineReveal';

gsap.registerPlugin(ScrollTrigger);

const BOARD_ROWS = [
  { flight: 'PF 118', dest: 'SIN → KUL', time: '09:15', status: 'CANCELLED', tone: 'text-red-400' },
  { flight: 'PF 204', dest: 'BKK → HKT', time: '10:40', status: 'DELAYED 6H', tone: 'text-orange-400' },
  { flight: 'PF 330', dest: 'SYD → BKK', time: '11:05', status: 'ON TIME', tone: 'text-lime' },
  { flight: 'PF 087', dest: 'SIN → NRT', time: '12:20', status: 'ON TIME', tone: 'text-lime' },
  { flight: 'PF 552', dest: 'KUL → DXB', time: '13:45', status: 'AT RISK 84%', tone: 'text-yellow-400' },
  { flight: 'PF 611', dest: 'HKT → SIN', time: '14:30', status: 'ON TIME', tone: 'text-lime' },
  { flight: 'PF 742', dest: 'BKK → CNX', time: '15:10', status: 'DELAYED 2H', tone: 'text-orange-400' },
];

export default function ProblemSection() {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boardRef.current) return;

    const ctx = gsap.context(() => {
      // Board slides in from the right
      gsap.fromTo(
        '.fids-board',
        { opacity: 0, x: 90, rotateY: -6 },
        {
          opacity: 1,
          x: 0,
          rotateY: 0,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: boardRef.current, start: 'top 75%' },
        }
      );

      // Rows cascade in one by one, like a split-flap refreshing
      gsap.fromTo(
        '.board-row',
        { opacity: 0, x: 24 },
        {
          opacity: 1,
          x: 0,
          duration: 0.45,
          stagger: 0.09,
          ease: 'power2.out',
          scrollTrigger: { trigger: boardRef.current, start: 'top 70%' },
        }
      );
    }, boardRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="problem" className="px-6 md:px-12 lg:px-20 py-32 md:py-40">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: statement */}
        <div>
          <p className="font-mono2 text-xs tracking-[0.35em] text-[#F4F4F0]/50 uppercase mb-8">
            The Problem
          </p>
          <HeadlineReveal
            lines={[
              'AIRLINES WAIT FOR',
              'DISRUPTIONS TO HAPPEN.',
              'WE FIGHT FOR EVERY',
              'PASSENGER, EARLY.',
            ]}
            accentIndex={2}
          />
          <p className="mt-10 text-[#F4F4F0]/70 text-base md:text-lg leading-relaxed max-w-md">
            Every day, thousands of passengers learn about cancellations at the
            gate — after alternatives are already gone. Pathfinder flips the
            sequence: risk is scored before departure, alternatives are
            pre-positioned, and recovery is one approval away.
          </p>
        </div>

        {/* Right: live departure board */}
        <div ref={boardRef} style={{ perspective: '1200px' }}>
          <div className="fids-board bg-[#0d0d0d] border border-[#242424] rounded-lg overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
            {/* Board header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#242424] bg-[#111111]">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                <span className="font-mono2 text-xs tracking-[0.3em] uppercase text-[#F4F4F0]">
                  Departures
                </span>
              </div>
              <span className="font-mono2 text-[10px] tracking-[0.25em] text-[#F4F4F0]/40 uppercase">
                Terminal 01 · Live
              </span>
            </div>

            {/* Column labels */}
            <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-[#1c1c1c] font-mono2 text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35">
              <span className="col-span-3">Flight</span>
              <span className="col-span-4">Route</span>
              <span className="col-span-2">Sched</span>
              <span className="col-span-3 text-right">Remark</span>
            </div>

            {/* Rows */}
            <div>
              {BOARD_ROWS.map((row, i) => (
                <div
                  key={i}
                  className="board-row grid grid-cols-12 gap-2 items-center px-6 py-3.5 border-b border-[#161616] last:border-0"
                >
                  <span className="col-span-3 font-mono2 text-sm font-bold text-[#F4F4F0]">
                    {row.flight}
                  </span>
                  <span className="col-span-4 font-mono2 text-sm text-[#F4F4F0]/70">
                    {row.dest}
                  </span>
                  <span className="col-span-2 font-mono2 text-sm text-[#F4F4F0]/50">
                    {row.time}
                  </span>
                  <span
                    className={`col-span-3 font-mono2 text-xs font-bold tracking-wider text-right ${row.tone} ${
                      row.status === 'CANCELLED' ? 'status-dot-disrupted' : ''
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Board footer ticker */}
            <div className="px-6 py-3 bg-[#111111] border-t border-[#242424]">
              <p className="font-mono2 text-[10px] tracking-[0.2em] text-[#F4F4F0]/40 uppercase">
                Pathfinder is monitoring 2 of 7 flights for elevated risk
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
