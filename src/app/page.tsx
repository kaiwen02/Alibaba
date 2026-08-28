'use client';

import { useState } from 'react';
import Preloader from '@/components/landing/Preloader';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Marquee from '@/components/landing/Marquee';
import ProblemSection from '@/components/landing/ProblemSection';
import StagesSection from '@/components/landing/StagesSection';
import GlobeSection from '@/components/landing/GlobeSection';
import FinalCta from '@/components/landing/FinalCta';

export default function LandingPage() {
  const [entered, setEntered] = useState(false);

  return (
    <main className="relative bg-[#000000] text-[#F4F4F0]">
      {!entered && <Preloader onEnter={() => setEntered(true)} />}

      {/* Fixed nav — fades in once the preloader curtain lifts */}
      <Navbar visible={entered} />

      {/* Content sits beneath the preloader; revealed by curtain */}
      <div aria-hidden={!entered}>
        <Hero started={entered} />

        <Marquee
          items={[
            'PROACTIVE DISRUPTION HANDLING',
            'INTELLIGENT REBOOKING',
            '140+ LOW-COST CARRIERS',
            'ATLAS API NATIVE',
            'HUMAN-GATED EXECUTION',
          ]}
        />

        <ProblemSection />

        <StagesSection />

        <Marquee
          reverse
          items={[
            'SIN → KUL',
            'BKK → HKT',
            'SYD → SIN → BKK',
            'RISK SCORE 0.70+',
            '3 PACKAGES PRE-POSITIONED',
          ]}
        />

        <GlobeSection />

        <FinalCta />
      </div>

      <div className="noise-overlay" />
    </main>
  );
}
