'use client';

import Link from 'next/link';
import { Luggage, Plane, AlertTriangle } from 'lucide-react';
import AppShell from '@/components/dashboard/AppShell';
import { useBookings, type BoardBooking } from '@/lib/hooks/use-bookings';
import {
  bagTagFor,
  bagWeightFor,
  formatDate,
  formatTime,
} from '@/lib/utils/demo-values';

/** Stages a checked bag moves through, in order. */
const STAGES = ['Accepted', 'Screened', 'Loaded', 'In transit', 'At belt'] as const;
type Stage = (typeof STAGES)[number];

/**
 * Bag progress is inferred from the flight clock rather than stored, since there
 * is no baggage model in the schema. Acceptance opens 3h before departure.
 */
function stageFor(
  departureAt: string,
  arrivalAt: string,
  bookingStatus: string
): { index: number; held: boolean } {
  if (bookingStatus === 'DISRUPTED' || bookingStatus === 'CANCELLED') {
    return { index: -1, held: true };
  }

  const now = Date.now();
  const departure = new Date(departureAt).getTime();
  const arrival = new Date(arrivalAt).getTime();
  const hour = 60 * 60 * 1000;

  if (now < departure - 3 * hour) return { index: -1, held: false };
  if (now < departure - 2 * hour) return { index: 0, held: false };
  if (now < departure - 1 * hour) return { index: 1, held: false };
  if (now < departure) return { index: 2, held: false };
  if (now < arrival) return { index: 3, held: false };
  return { index: 4, held: false };
}

export default function BaggagePage() {
  const { bookings, loading } = useBookings();
  const segmentsFlown = bookings.reduce((sum, b) => sum + b.segments.length, 0);

  const inTransit = bookings.filter((b) => {
    const segment = b.segments[0];
    if (!segment) return false;
    const { index, held } = stageFor(segment.departureAt, segment.arrivalAt, b.status);
    return !held && index >= 2 && index < 4;
  }).length;

  return (
    <AppShell
      eyebrow="Passenger services"
      title="BAGGAGE"
      segmentsFlown={segmentsFlown}
      action={
        <div className="border border-[#242424] px-5 py-4">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40 mb-1">
            In transit
          </p>
          <p className="font-display font-bold text-3xl tracking-tighter text-lime">
            {inTransit}
          </p>
        </div>
      }
    >
      {/* Allowance */}
      <div className="grid sm:grid-cols-3 border border-[#242424] divide-y sm:divide-y-0 sm:divide-x divide-[#242424] mb-8">
        {[
          { label: 'Checked allowance', value: '20 KG', note: 'Per passenger' },
          { label: 'Cabin allowance', value: '7 KG', note: '56 × 36 × 23 cm' },
          { label: 'Tier bonus', value: '+5 KG', note: 'Loyalty benefit' },
        ].map((item) => (
          <div key={item.label} className="px-5 py-5">
            <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35 mb-2">
              {item.label}
            </p>
            <p className="font-display font-bold text-2xl tracking-tighter mb-1">
              {item.value}
            </p>
            <p className="font-mono text-[10px] tracking-wider text-[#F4F4F0]/35">
              {item.note}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="border border-[#242424] py-20 text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-dashed border-lime animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="border border-[#242424] py-20 text-center">
          <Plane className="h-10 w-10 text-[#242424] mx-auto mb-4" />
          <p className="font-mono text-sm text-[#F4F4F0]/50 tracking-wider">
            NO BAGS TO TRACK
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BagCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}

      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#F4F4F0]/20 mt-8">
        Demo build · bag tags, weights and progress are derived from the flight
        clock, not from a baggage system
      </p>
    </AppShell>
  );
}

function BagCard({ booking }: { booking: BoardBooking }) {
  const segment = booking.segments[0];
  if (!segment) return null;

  const key = booking.pnr || booking.id;
  const { index, held } = stageFor(
    segment.departureAt,
    segment.arrivalAt,
    booking.status
  );
  const departure = new Date(segment.departureAt);
  const currentStage: Stage | null = index >= 0 ? STAGES[index] : null;

  return (
    <div className="border border-[#242424] bg-[#050505]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 border-b border-[#1c1c1c]">
        <div>
          <p className="font-display font-bold text-xl tracking-tight">
            {segment.origin} <span className="text-lime">→</span>{' '}
            {segment.destination}
          </p>
          <p className="font-mono text-[10px] tracking-wider text-[#F4F4F0]/40 mt-1">
            {segment.airline} {segment.flightNo} · {formatDate(departure)}{' '}
            {formatTime(departure)}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35 mb-1">
              Tag
            </p>
            <p className="font-mono text-sm tracking-wider">{bagTagFor(key)}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35 mb-1">
              Weight
            </p>
            <p className="font-mono text-sm tracking-wider">{bagWeightFor(key)}</p>
          </div>
        </div>
      </div>

      {held ? (
        <div className="px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-red-400">
                Bag held at origin
              </p>
              <p className="font-mono text-[11px] text-[#F4F4F0]/45 mt-1">
                Acceptance is suspended while this flight is in disruption
                recovery. The bag re-tags to the replacement flight once ticketed.
              </p>
            </div>
          </div>
          {booking.recoveryCase && (
            <Link
              href={`/recovery/${booking.recoveryCase.id}`}
              className="font-mono text-[10px] tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0] transition-colors shrink-0"
            >
              Review recovery →
            </Link>
          )}
        </div>
      ) : index < 0 ? (
        <div className="px-6 py-6 flex items-center gap-3">
          <Luggage className="h-4 w-4 text-[#F4F4F0]/30" />
          <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-[#F4F4F0]/40">
            Bag drop opens 3 hours before departure
          </p>
        </div>
      ) : (
        <div className="px-6 py-7">
          {/* Stepper */}
          <div className="flex items-center">
            {STAGES.map((stage, i) => {
              const done = i <= index;
              const isCurrent = i === index;

              return (
                <div key={stage} className="flex-1 flex items-center last:flex-none">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        done ? 'bg-lime' : 'bg-[#242424]'
                      } ${isCurrent ? 'status-dot-disrupted' : ''}`}
                    />
                    <span
                      className={`font-mono text-[9px] tracking-[0.15em] uppercase whitespace-nowrap ${
                        isCurrent
                          ? 'text-lime'
                          : done
                            ? 'text-[#F4F4F0]/60'
                            : 'text-[#F4F4F0]/25'
                      }`}
                    >
                      {stage}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-2 -mt-5 ${
                        i < index ? 'bg-lime/50' : 'bg-[#242424]'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {currentStage && (
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#F4F4F0]/45 mt-6">
              Current · {currentStage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
