'use client';

import { Plane, Zap, Tag, RefreshCw } from 'lucide-react';

interface PackageData {
  id: string;
  type: string;
  price: string;
  currency: string;
  journeyTime: number;
  segments: any[];
}

interface PackageCardProps {
  package: PackageData;
  selected: boolean;
  onSelect: () => void;
}

export default function PackageCard({ package: pkg, selected, onSelect }: PackageCardProps) {
  const typeConfig: Record<string, { icon: any; label: string; tag: string }> = {
    FASTEST: { icon: Zap, label: 'Fastest', tag: 'SPD' },
    LOWEST_COST: { icon: Tag, label: 'Best Value', tag: 'VAL' },
    LEAST_DISRUPTION: { icon: RefreshCw, label: 'Closest Match', tag: 'SIM' },
  };

  const config = typeConfig[pkg.type] || typeConfig.FASTEST;
  const Icon = config.icon;

  const hours = Math.floor(pkg.journeyTime / 60);
  const minutes = pkg.journeyTime % 60;
  const duration = hours > 0 ? `${hours}H ${minutes}M` : `${minutes}M`;

  return (
    <div
      onClick={onSelect}
      className={`
        boarding-pass rounded-md cursor-pointer transition-all duration-300
        ${selected
          ? 'ring-4 ring-lime -translate-y-1 rotate-[0.3deg]'
          : 'hover:-translate-y-1 opacity-95 hover:opacity-100'
        }
      `}
    >
      {/* Top strip */}
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-dashed border-[#000000]/20">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#000000]" />
          <span className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-[#000000]">
            {config.label}
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.25em] text-[#000000]/50 uppercase">
          Option {config.tag}-01
        </span>
      </div>

      {/* Route body */}
      <div className="px-6 py-6">
        {pkg.segments?.[0] && (
          <div className="flex items-center gap-4 mb-5">
            <div>
              <p className="font-display font-bold text-3xl tracking-tight text-[#000000]">
                {pkg.segments[0].origin}
              </p>
              <p className="font-mono text-[10px] text-[#000000]/50 tracking-wider uppercase">
                {pkg.segments[0].airline}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="h-px flex-1 bg-[#000000]/20" />
              <Plane className="h-4 w-4 text-[#000000]/60" />
              <div className="h-px flex-1 bg-[#000000]/20" />
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-3xl tracking-tight text-[#000000]">
                {pkg.segments[0].destination}
              </p>
              <p className="font-mono text-[10px] text-[#000000]/50 tracking-wider uppercase">
                {pkg.segments[0].flightNo}
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-8">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50 mb-1">
              Fare
            </p>
            <p className="font-display font-bold text-2xl tracking-tight text-[#000000]">
              ${parseFloat(pkg.price || '0').toFixed(2)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50 mb-1">
              Duration
            </p>
            <p className="font-display font-bold text-2xl tracking-tight text-[#000000]">
              {duration}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom strip — barcode + selection state */}
      <div className="flex items-center justify-between px-6 py-3 border-t-2 border-dashed border-[#000000]/20">
        <div className="barcode h-8 w-28 opacity-70" />
        {selected ? (
          <span className="font-mono text-xs font-bold tracking-[0.2em] uppercase bg-[#000000] text-lime px-3 py-1.5 rounded">
            ✓ Selected
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/40">
            Tap to select
          </span>
        )}
      </div>
    </div>
  );
}
