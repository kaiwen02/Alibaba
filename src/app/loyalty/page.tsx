'use client';

import { useSession } from 'next-auth/react';
import { Award, Check, Plane } from 'lucide-react';
import AppShell from '@/components/dashboard/AppShell';
import PassengerCard, {
  deriveLoyaltyProfile,
  TIERS,
} from '@/components/dashboard/PassengerCard';
import { useBookings, type BoardBooking } from '@/lib/hooks/use-bookings';
import { stableHash, formatDate } from '@/lib/utils/demo-values';

/** Illustrative miles for a flown segment, stable per booking. */
function milesFor(booking: BoardBooking): number {
  const key = booking.pnr || booking.id;
  return 400 + (stableHash(`miles:${key}`) % 1800);
}

const BENEFITS: Record<string, string[]> = {
  Explorer: ['Earn miles on every fare', 'Member-only fare alerts'],
  Voyager: ['+5 kg checked allowance', 'Priority check-in', 'Standard seat selection free'],
  Pathfinder: [
    '+10 kg checked allowance',
    'Lounge access twice per year',
    'Free seat selection',
    'Priority disruption rebooking',
  ],
  'Pathfinder Elite': [
    '+20 kg checked allowance',
    'Unlimited lounge access',
    'Guaranteed rebooking on any fare class',
    'Dedicated recovery desk',
  ],
};

export default function LoyaltyPage() {
  const { bookings, loading } = useBookings();
  const { data: session } = useSession();

  const segmentsFlown = bookings.reduce((sum, b) => sum + b.segments.length, 0);
  const profile = deriveLoyaltyProfile(session?.user?.email, segmentsFlown);
  const currentTierIndex = TIERS.findIndex((t) => t.name === profile.tierName);

  return (
    <AppShell
      eyebrow="Account"
      title="LOYALTY"
      segmentsFlown={segmentsFlown}
      action={
        <div className="border border-[#242424] px-5 py-4">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40 mb-1">
            Tier
          </p>
          <p className="font-display font-bold text-2xl tracking-tighter text-lime">
            {profile.tierName}
          </p>
        </div>
      }
    >
      <div className="grid lg:grid-cols-[320px_1fr] gap-8">
        {/* Membership card */}
        <div className="space-y-6">
          <PassengerCard
            name={session?.user?.name}
            email={session?.user?.email}
            segmentsFlown={segmentsFlown}
          />

          <div className="border border-[#242424] px-5 py-5">
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-[#F4F4F0]/35 mb-4">
              Your benefits
            </p>
            <ul className="space-y-2.5">
              {(BENEFITS[profile.tierName] || []).map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <Check className="h-3.5 w-3.5 text-lime shrink-0 mt-0.5" />
                  <span className="font-mono text-[11px] leading-relaxed text-[#F4F4F0]/65">
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-8">
          {/* Tier ladder */}
          <div className="border border-[#242424]">
            <div className="px-6 py-4 border-b border-[#242424] flex items-center gap-3">
              <Award className="h-4 w-4 text-lime" />
              <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#F4F4F0]/70">
                Tier ladder
              </p>
            </div>

            <div className="divide-y divide-[#1c1c1c]">
              {TIERS.map((tier, i) => {
                const reached = i <= currentTierIndex;
                const isCurrent = i === currentTierIndex;

                return (
                  <div
                    key={tier.name}
                    className={`flex flex-wrap items-center justify-between gap-4 px-6 py-5 ${
                      isCurrent ? 'bg-[#0d0d0d]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          reached ? 'bg-lime' : 'bg-[#242424]'
                        }`}
                      />
                      <div>
                        <p
                          className={`font-display font-bold text-lg tracking-tight ${
                            reached ? '' : 'text-[#F4F4F0]/40'
                          }`}
                        >
                          {tier.name}
                        </p>
                        <p className="font-mono text-[10px] tracking-wider text-[#F4F4F0]/35">
                          {tier.threshold.toLocaleString()} miles
                        </p>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase border border-lime/40 bg-lime/5 px-2 py-1 text-lime">
                        Current
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity */}
          <div className="border border-[#242424]">
            <div className="px-6 py-4 border-b border-[#242424] flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#F4F4F0]/70">
                Recent activity
              </p>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#F4F4F0]/35">
                {bookings.length} bookings
              </p>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="w-10 h-10 mx-auto rounded-full border-2 border-dashed border-lime animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-16 text-center">
                <Plane className="h-8 w-8 text-[#242424] mx-auto mb-3" />
                <p className="font-mono text-xs text-[#F4F4F0]/40 tracking-wider uppercase">
                  No activity yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1c1c1c]">
                {bookings.map((booking) => {
                  const segment = booking.segments[0];
                  if (!segment) return null;

                  return (
                    <div
                      key={booking.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                    >
                      <div>
                        <p className="font-display font-bold text-base tracking-tight">
                          {segment.origin} <span className="text-lime">→</span>{' '}
                          {segment.destination}
                        </p>
                        <p className="font-mono text-[10px] tracking-wider text-[#F4F4F0]/35 mt-0.5">
                          {formatDate(new Date(segment.departureAt))} ·{' '}
                          {segment.airline} {segment.flightNo} · PNR{' '}
                          {booking.pnr || '—'}
                        </p>
                      </div>
                      <p className="font-mono text-sm tracking-wider text-lime">
                        +{milesFor(booking).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#F4F4F0]/20 mt-8">
        Demo build · loyalty is not modelled in the database, so tier, balance and
        earn rates are derived from your account email
      </p>
    </AppShell>
  );
}
