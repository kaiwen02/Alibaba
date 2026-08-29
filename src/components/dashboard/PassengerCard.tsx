'use client';

/**
 * Frequent-flyer identity panel.
 *
 * There is no loyalty model in the schema, so the tier, membership number and
 * balance are derived deterministically from the signed-in email. That keeps the
 * numbers stable across reloads and across pages (a random value would visibly
 * change while navigating), and every surface that shows them is labelled as
 * illustrative.
 */

export const TIERS = [
  { name: 'Explorer', threshold: 0, next: 25000 },
  { name: 'Voyager', threshold: 25000, next: 60000 },
  { name: 'Pathfinder', threshold: 60000, next: 120000 },
  { name: 'Pathfinder Elite', threshold: 120000, next: null },
] as const;

/** Stable 32-bit hash so the same email always yields the same profile. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface LoyaltyProfile {
  memberNumber: string;
  tierName: string;
  miles: number;
  nextTierAt: number | null;
  progressPct: number;
  segmentsFlown: number;
}

export function deriveLoyaltyProfile(
  email: string | null | undefined,
  segmentsFlown = 0
): LoyaltyProfile {
  const seed = hashString(email || 'demo@pathfinder.dev');

  // 30k-95k keeps the profile in the mid tiers, where a progress bar is
  // actually interesting to look at.
  const miles = 30000 + (seed % 65000);
  const memberNumber = `PF${String(seed % 100000000).padStart(8, '0')}`;

  const tier =
    [...TIERS].reverse().find((t) => miles >= t.threshold) ?? TIERS[0];

  const progressPct = tier.next
    ? Math.round(
        ((miles - tier.threshold) / (tier.next - tier.threshold)) * 100
      )
    : 100;

  return {
    memberNumber,
    tierName: tier.name,
    miles,
    nextTierAt: tier.next,
    progressPct,
    segmentsFlown,
  };
}

interface PassengerCardProps {
  name?: string | null;
  email?: string | null;
  segmentsFlown?: number;
  /** Compact variant for the sidebar; the full variant is used on /loyalty. */
  compact?: boolean;
}

export default function PassengerCard({
  name,
  email,
  segmentsFlown = 0,
  compact = false,
}: PassengerCardProps) {
  const profile = deriveLoyaltyProfile(email, segmentsFlown);
  const displayName = name || 'Demo Traveler';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="border border-[#242424] bg-[#0A0A0A]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="h-9 w-9 shrink-0 border border-lime/40 bg-lime/10 flex items-center justify-center font-mono text-[11px] font-bold tracking-wider text-lime">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-sm tracking-tight truncate">
            {displayName}
          </p>
          <p className="font-mono text-[10px] tracking-[0.15em] text-[#F4F4F0]/35 truncate">
            {profile.memberNumber}
          </p>
        </div>
      </div>

      <div className="px-4 pt-3">
        <span className="inline-flex items-center gap-1.5 border border-lime/40 bg-lime/5 px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.2em] uppercase text-lime">
          {profile.tierName}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-display font-bold text-2xl tracking-tighter leading-none">
            {profile.miles.toLocaleString()}
          </p>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#F4F4F0]/35">
            Miles
          </p>
        </div>

        <div className="h-1 w-full bg-[#1c1c1c]">
          <div
            className="h-full bg-lime transition-all duration-700"
            style={{ width: `${Math.min(profile.progressPct, 100)}%` }}
          />
        </div>

        <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#F4F4F0]/35 mt-2">
          {profile.nextTierAt
            ? `${(profile.nextTierAt - profile.miles).toLocaleString()} to next tier`
            : 'Top tier reached'}
        </p>

        {!compact && (
          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-[#1c1c1c]">
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#F4F4F0]/35 mb-1">
                Segments
              </p>
              <p className="font-display font-bold text-lg tracking-tight">
                {profile.segmentsFlown}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#F4F4F0]/35 mb-1">
                Status
              </p>
              <p className="font-mono text-[11px] text-lime tracking-wider">
                ACTIVE
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="px-4 pb-3 font-mono text-[8px] tracking-[0.15em] uppercase text-[#F4F4F0]/20">
        {compact ? 'Demo profile' : 'Illustrative profile · demo build'}
      </p>
    </div>
  );
}
