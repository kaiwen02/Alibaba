'use client';

import { Plane } from 'lucide-react';

export interface AiPlanCardData {
  id: string;
  title: string;
  legs: Array<{
    flightNo: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
  }>;
  layovers: string[];
  explanation: string;
}

/**
 * One AI-generated alternative travel plan (exactly 3 are always rendered).
 * Shared between any surface that displays recovery plans.
 */
export default function AiPlanCard({ plan, index }: { plan: AiPlanCardData; index: number }) {
  return (
    <div className="bg-[#000000] border border-[#242424] rounded p-5 hover:border-lime/50 transition-colors">
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/40 mb-1">
        Option 0{index + 1}
      </p>
      <h3 className="font-display font-semibold text-sm text-[#F4F4F0] mb-3">{plan.title}</h3>

      {/* Leg chain */}
      <div className="space-y-1.5 mb-3">
        {plan.legs.map((leg, li) => (
          <div key={li} className="flex items-center gap-2 font-mono text-xs text-[#F4F4F0]/70">
            <Plane className="h-3 w-3 text-lime shrink-0" />
            <span className="text-lime">{leg.flightNo}</span>
            <span>{leg.origin}→{leg.destination}</span>
            <span className="ml-auto text-[#F4F4F0]/40">
              {new Date(leg.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {/* Layover chips */}
      {plan.layovers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {plan.layovers.map((hub) => (
            <span key={hub} className="font-mono text-[10px] tracking-[0.15em] uppercase border border-[#FFB454]/40 text-[#FFB454] px-1.5 py-0.5">
              via {hub}
            </span>
          ))}
        </div>
      )}

      <p className="font-mono text-xs text-[#F4F4F0]/50 italic leading-relaxed">
        {plan.explanation}
      </p>
    </div>
  );
}
