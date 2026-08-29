'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Plane, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import AppShell from '@/components/dashboard/AppShell';
import { useBookings, type BoardBooking } from '@/lib/hooks/use-bookings';
import {
  checkInWindow,
  seatFor,
  gateFor,
  terminalFor,
  formatDate,
  formatTime,
  CHECK_IN_OPENS_HOURS,
  type CheckInWindow,
} from '@/lib/utils/demo-values';

export default function CheckInPage() {
  const { bookings, loading } = useBookings();
  // Check-in is not persisted anywhere in this build, so completed check-ins are
  // tracked per session only. Noted in the page footer so it is not mistaken for
  // real state.
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({});

  const segmentsFlown = bookings.reduce((sum, b) => sum + b.segments.length, 0);
  const openCount = bookings.filter(
    (b) =>
      b.segments[0] && checkInWindow(b.segments[0].departureAt, b.status) === 'OPEN'
  ).length;

  return (
    <AppShell
      eyebrow="Passenger services"
      title="CHECK-IN"
      segmentsFlown={segmentsFlown}
      action={
        <div className="border border-[#242424] px-5 py-4">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40 mb-1">
            Open for check-in
          </p>
          <p className="font-display font-bold text-3xl tracking-tighter text-lime">
            {openCount}
          </p>
        </div>
      }
    >
      <div className="border border-[#242424] px-5 py-4 mb-8 flex items-start gap-3">
        <ClipboardCheck className="h-4 w-4 text-lime shrink-0 mt-0.5" />
        <p className="font-mono text-[11px] leading-relaxed text-[#F4F4F0]/55">
          Online check-in opens {CHECK_IN_OPENS_HOURS} hours before departure and
          closes 1 hour before. Flights under active disruption recovery cannot be
          checked in until a replacement itinerary is ticketed.
        </p>
      </div>

      {loading ? (
        <div className="border border-[#242424] py-20 text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-dashed border-lime animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="border border-[#242424] py-20 text-center">
          <Plane className="h-10 w-10 text-[#242424] mx-auto mb-4" />
          <p className="font-mono text-sm text-[#F4F4F0]/50 tracking-wider">
            NO FLIGHTS TO CHECK IN FOR
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <CheckInRow
              key={booking.id}
              booking={booking}
              checkedIn={!!checkedIn[booking.id]}
              onCheckIn={() =>
                setCheckedIn((prev) => ({ ...prev, [booking.id]: true }))
              }
            />
          ))}
        </div>
      )}

      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#F4F4F0]/20 mt-8">
        Demo build · check-in state is held for this session only and gate, seat
        and terminal are illustrative
      </p>
    </AppShell>
  );
}

const WINDOW_COPY: Record<CheckInWindow, { label: string; tone: string }> = {
  OPEN: { label: 'Check-in open', tone: 'text-lime' },
  NOT_OPEN: { label: 'Opens closer to departure', tone: 'text-[#F4F4F0]/45' },
  CLOSED: { label: 'Check-in closed', tone: 'text-[#F4F4F0]/45' },
  BLOCKED: { label: 'Blocked · disruption', tone: 'text-red-400' },
};

function CheckInRow({
  booking,
  checkedIn,
  onCheckIn,
}: {
  booking: BoardBooking;
  checkedIn: boolean;
  onCheckIn: () => void;
}) {
  const segment = booking.segments[0];
  if (!segment) return null;

  const key = booking.pnr || booking.id;
  const phase = checkInWindow(segment.departureAt, booking.status);
  const copy = WINDOW_COPY[phase];
  const departure = new Date(segment.departureAt);

  return (
    <div className="border border-[#242424] bg-[#050505]">
      <div className="grid md:grid-cols-12 gap-6 items-center px-6 py-6">
        {/* Route + flight */}
        <div className="md:col-span-4">
          <p className="font-display font-bold text-2xl tracking-tight">
            {segment.origin} <span className="text-lime">→</span>{' '}
            {segment.destination}
          </p>
          <p className="font-mono text-[10px] tracking-wider text-[#F4F4F0]/40 mt-1">
            {segment.airline} {segment.flightNo} · PNR {booking.pnr || '—'}
          </p>
        </div>

        {/* Departure */}
        <div className="md:col-span-2">
          <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35 mb-1">
            Departs
          </p>
          <p className="font-mono text-sm">{formatDate(departure)}</p>
          <p className="font-mono text-sm text-[#F4F4F0]/50">
            {formatTime(departure)}
          </p>
        </div>

        {/* Terminal / gate */}
        <div className="md:col-span-2">
          <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35 mb-1">
            Terminal · Gate
          </p>
          <p className="font-display font-bold text-lg tracking-tight">
            T{terminalFor(key)} · {gateFor(key)}
          </p>
        </div>

        {/* Status */}
        <div className="md:col-span-2">
          <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#F4F4F0]/35 mb-1">
            Status
          </p>
          <p
            className={`font-mono text-[11px] tracking-[0.15em] uppercase ${
              checkedIn ? 'text-lime' : copy.tone
            }`}
          >
            {checkedIn ? `Seat ${seatFor(key)}` : copy.label}
          </p>
        </div>

        {/* Action */}
        <div className="md:col-span-2 md:text-right">
          {checkedIn ? (
            <span className="inline-flex items-center gap-2 border border-lime/40 bg-lime/5 px-4 py-2.5 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-lime">
              <Check className="h-3.5 w-3.5" />
              Checked in
            </span>
          ) : phase === 'BLOCKED' && booking.recoveryCase ? (
            <Link
              href={`/recovery/${booking.recoveryCase.id}`}
              className="inline-flex items-center gap-2 border border-red-400/40 px-4 py-2.5 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Review recovery
            </Link>
          ) : phase === 'OPEN' ? (
            <button
              onClick={onCheckIn}
              className="inline-flex items-center gap-2 bg-lime text-[#000000] px-5 py-2.5 font-mono text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#F4F4F0] transition-colors"
            >
              Check in
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#F4F4F0]/25">
              Unavailable
            </span>
          )}
        </div>
      </div>

      {checkedIn && (
        <div className="border-t border-[#1c1c1c] px-6 py-3 flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#F4F4F0]/40">
            Boarding pass ready
          </p>
          <Link
            href="/boarding-pass"
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0] transition-colors"
          >
            View pass →
          </Link>
        </div>
      )}
    </div>
  );
}
