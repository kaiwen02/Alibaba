'use client';

import Link from 'next/link';
import { Ticket, Plane } from 'lucide-react';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/dashboard/AppShell';
import { useBookings, type BoardBooking } from '@/lib/hooks/use-bookings';
import {
  seatFor,
  gateFor,
  terminalFor,
  bagTagFor,
  boardingTimes,
  formatDate,
  formatTime,
} from '@/lib/utils/demo-values';

export default function BoardingPassPage() {
  const { bookings, loading } = useBookings();
  const { data: session } = useSession();

  const segmentsFlown = bookings.reduce((sum, b) => sum + b.segments.length, 0);

  // A disrupted itinerary has no valid pass until recovery is ticketed.
  const issuable = bookings.filter((b) => b.status !== 'DISRUPTED' && b.status !== 'CANCELLED');
  const withheld = bookings.filter((b) => b.status === 'DISRUPTED' || b.status === 'CANCELLED');

  return (
    <AppShell
      eyebrow="Passenger services"
      title="BOARDING PASSES"
      segmentsFlown={segmentsFlown}
      action={
        <div className="border border-[#242424] px-5 py-4">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40 mb-1">
            Passes issued
          </p>
          <p className="font-display font-bold text-3xl tracking-tighter text-lime">
            {issuable.length}
          </p>
        </div>
      }
    >
      {loading ? (
        <div className="border border-[#242424] py-20 text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-dashed border-lime animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="border border-[#242424] py-20 text-center">
          <Plane className="h-10 w-10 text-[#242424] mx-auto mb-4" />
          <p className="font-mono text-sm text-[#F4F4F0]/50 tracking-wider">
            NO PASSES TO DISPLAY
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {issuable.map((booking) => (
            <BoardingPass
              key={booking.id}
              booking={booking}
              passengerName={booking.passengerName || session?.user?.name || 'Demo Traveler'}
            />
          ))}

          {withheld.length > 0 && (
            <div className="border border-[#242424] px-6 py-6">
              <div className="flex items-center gap-3 mb-4">
                <Ticket className="h-4 w-4 text-red-400" />
                <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#F4F4F0]/70">
                  Withheld · {withheld.length}
                </p>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-[#F4F4F0]/45 mb-5">
                A boarding pass is only issued against a ticketed itinerary. These
                flights are in disruption recovery, so no pass exists yet.
              </p>
              <div className="space-y-2">
                {withheld.map((booking) => {
                  const segment = booking.segments[0];
                  if (!segment) return null;
                  return (
                    <div
                      key={booking.id}
                      className="flex flex-wrap items-center justify-between gap-3 border border-[#1c1c1c] px-4 py-3"
                    >
                      <p className="font-mono text-xs tracking-wider">
                        {segment.origin} → {segment.destination}
                        <span className="text-[#F4F4F0]/35">
                          {'  '}· {segment.airline} {segment.flightNo}
                        </span>
                      </p>
                      {booking.recoveryCase && (
                        <Link
                          href={`/recovery/${booking.recoveryCase.id}`}
                          className="font-mono text-[10px] tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0] transition-colors"
                        >
                          Review recovery →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#F4F4F0]/20 mt-8">
        Demo build · not valid for travel · gate, seat and sequence are illustrative
      </p>
    </AppShell>
  );
}

function BoardingPass({
  booking,
  passengerName,
}: {
  booking: BoardBooking;
  passengerName: string;
}) {
  const segment = booking.segments[0];
  if (!segment) return null;

  const key = booking.pnr || booking.id;
  const departure = new Date(segment.departureAt);
  const { boardingAt, gateClosesAt } = boardingTimes(segment.departureAt);

  return (
    <div className="boarding-pass grid md:grid-cols-[1fr_240px]">
      {/* Main coupon */}
      <div className="p-7">
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-black/45 mb-1">
              Atlas · Boarding pass
            </p>
            <p className="font-display font-bold text-xl tracking-tight">
              {segment.airline}
            </p>
          </div>
          <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase border border-black/25 px-2 py-1">
            Demo
          </span>
        </div>

        <div className="flex items-end gap-5 mb-7">
          <div>
            <p className="font-display font-bold text-5xl tracking-tighter leading-none">
              {segment.origin}
            </p>
          </div>
          <Plane className="h-5 w-5 mb-2 text-black/40" />
          <div>
            <p className="font-display font-bold text-5xl tracking-tighter leading-none">
              {segment.destination}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-4">
          <PassField label="Passenger" value={passengerName.toUpperCase()} />
          <PassField label="Flight" value={segment.flightNo} />
          <PassField label="Date" value={formatDate(departure)} />
          <PassField label="Departs" value={formatTime(departure)} />
          <PassField label="Terminal" value={`T${terminalFor(key)}`} />
          <PassField label="Gate" value={gateFor(key)} />
          <PassField label="Seat" value={seatFor(key)} />
          <PassField label="Class" value={segment.cabinClass || 'ECONOMY'} />
        </div>

        <div className="mt-7 pt-5 border-t border-black/15 flex flex-wrap gap-x-8 gap-y-2">
          <PassField label="Boarding" value={formatTime(boardingAt)} />
          <PassField label="Gate closes" value={formatTime(gateClosesAt)} />
          <PassField label="Bag tag" value={bagTagFor(key)} />
        </div>
      </div>

      {/* Stub */}
      <div className="border-t md:border-t-0 md:border-l border-dashed border-black/30 p-7 flex flex-col justify-between">
        <div>
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-black/45 mb-1">
            Booking ref
          </p>
          <p className="font-display font-bold text-2xl tracking-tight mb-5">
            {booking.pnr || '—'}
          </p>

          <div className="space-y-3">
            <PassField label="Seat" value={seatFor(key)} />
            <PassField label="Gate" value={gateFor(key)} />
          </div>
        </div>

        <div className="mt-7">
          <div className="barcode h-14 w-full" />
          <p className="font-mono text-[9px] tracking-[0.2em] text-black/45 mt-2 text-center">
            {booking.atlasOrderId}
          </p>
        </div>
      </div>
    </div>
  );
}

function PassField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/45 mb-1">
        {label}
      </p>
      <p className="font-mono text-sm font-bold tracking-wide truncate">{value}</p>
    </div>
  );
}
