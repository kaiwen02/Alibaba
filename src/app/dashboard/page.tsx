'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plane, LogOut, RefreshCw, ChevronRight } from 'lucide-react';
import RiskBadge from '@/components/dashboard/RiskBadge';
import NotificationBell from '@/components/dashboard/NotificationBell';

interface Booking {
  id: string;
  atlasOrderId: string;
  status: string;
  pnr?: string;
  passengerName?: string;
  segments: Array<{
    origin: string;
    destination: string;
    departureAt: string;
    arrivalAt: string;
    flightNo: string;
    airline: string;
    status: string;
  }>;
  risk?: {
    riskScore: number;
    triggered: boolean;
  } | null;
  recoveryCase?: {
    id: string;
    status: string;
  } | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    fetchBookings();
  }, []);

  // Live departures-board clock
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/predictions');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPredictions = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/predictions', { method: 'POST' });
      await fetchBookings();
    } catch (error) {
      console.error('Failed to refresh predictions:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-lime animate-spin" />
      </div>
    );
  }

  const disruptedCount = bookings.filter((b) => b.status === 'DISRUPTED').length;
  const recoveredCount = bookings.filter((b) => b.status === 'RECOVERED').length;

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F0]">
      {/* Header */}
      <header className="border-b border-[#242424] sticky top-0 z-10 bg-[#000000]/90 backdrop-blur">
        <div className="px-6 md:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="font-display font-bold text-xl tracking-tight">
            PATHFINDER<span className="text-lime">.</span>
          </Link>
          <div className="flex items-center gap-6">
            <span className="hidden md:inline font-mono text-xs tracking-[0.2em] text-[#F4F4F0]/50">
              LOCAL {clock}
            </span>
            <NotificationBell />
            <Link
              href="/admin"
              className="font-mono text-xs tracking-[0.2em] uppercase text-[#F4F4F0]/60 hover:text-lime transition-colors"
            >
              Ops Console
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase text-[#F4F4F0]/60 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
        {/* Board title row */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.35em] text-lime uppercase mb-2">
              Terminal 01 · Departures
            </p>
            <h2 className="font-display font-bold text-4xl md:text-6xl tracking-tighter">
              FLIGHT BOARD
            </h2>
          </div>
          <button
            onClick={handleRefreshPredictions}
            disabled={refreshing}
            className="flex items-center gap-3 bg-lime text-[#000000] font-mono font-bold text-xs tracking-[0.2em] uppercase px-6 py-4 hover:bg-[#F4F4F0] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Scanning…' : 'Scan for Risks'}
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-[#242424] divide-x divide-[#242424] mb-10">
          {[
            { label: 'Total Flights', value: bookings.length, tone: 'text-[#F4F4F0]' },
            {
              label: 'On Schedule',
              value: bookings.filter((b) => b.status === 'CONFIRMED').length,
              tone: 'text-lime',
            },
            { label: 'Disrupted', value: disruptedCount, tone: 'text-red-400' },
            { label: 'Recovered', value: recoveredCount, tone: 'text-[#F4F4F0]' },
          ].map((s) => (
            <div key={s.label} className="px-5 py-6">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40 mb-2">
                {s.label}
              </p>
              <p className={`font-display font-bold text-4xl tracking-tighter ${s.tone}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* FIDS board */}
        {bookings.length === 0 ? (
          <div className="border border-[#242424] py-20 text-center">
            <Plane className="h-10 w-10 text-[#242424] mx-auto mb-4" />
            <p className="font-mono text-sm text-[#F4F4F0]/50 tracking-wider">
              NO FLIGHTS ON THE BOARD — RUN THE SEED SCRIPT
            </p>
          </div>
        ) : (
          <div className="border border-[#242424]">
            {/* Board header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#242424] font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/40">
              <span className="col-span-2">Flight</span>
              <span className="col-span-3">Route</span>
              <span className="col-span-2">Departure</span>
              <span className="col-span-2">Risk</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-1 text-right">Gate</span>
            </div>
            {bookings.map((booking) => (
              <FidsRow key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FidsRow({ booking }: { booking: Booking }) {
  const segment = booking.segments[0];
  if (!segment) return null;

  const departure = new Date(segment.departureAt);
  const disrupted = booking.status === 'DISRUPTED';

  const statusStyle: Record<string, string> = {
    CONFIRMED: 'text-lime',
    DISRUPTED: 'text-red-400',
    RECOVERED: 'text-[#F4F4F0]',
    CANCELLED: 'text-[#F4F4F0]/40',
  };

  return (
    <div className="fids-row grid grid-cols-2 md:grid-cols-12 gap-4 items-center px-6 py-5">
      {/* Flight */}
      <div className="md:col-span-2">
        <p className="font-display font-bold text-lg tracking-tight">
          {segment.airline} {segment.flightNo}
        </p>
        <p className="font-mono text-[10px] text-[#F4F4F0]/40 tracking-wider">
          PNR {booking.pnr || '—'}
        </p>
      </div>

      {/* Route */}
      <div className="md:col-span-3">
        <p className="font-display font-bold text-2xl tracking-tight">
          {segment.origin} <span className="text-lime">→</span> {segment.destination}
        </p>
        {booking.segments.length > 1 && (
          <p className="font-mono text-[10px] text-[#F4F4F0]/40 tracking-wider">
            +{booking.segments.length - 1} CONNECTION
          </p>
        )}
      </div>

      {/* Departure */}
      <div className="md:col-span-2 font-mono text-sm">
        <p>{departure.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
        <p className="text-[#F4F4F0]/50">
          {departure.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Risk */}
      <div className="md:col-span-2">
        <RiskBadge score={booking.risk?.riskScore || 0} size="sm" />
      </div>

      {/* Status */}
      <div className="md:col-span-2">
        <span
          className={`inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase ${statusStyle[booking.status] || 'text-[#F4F4F0]/60'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full bg-current ${disrupted ? 'status-dot-disrupted' : ''}`}
          />
          {booking.status}
        </span>
        {booking.recoveryCase && (
          <p className="font-mono text-[10px] text-[#F4F4F0]/40 mt-1 tracking-wider uppercase">
            Recovery · {booking.recoveryCase.status}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="md:col-span-1 md:text-right">
        {booking.recoveryCase ? (
          <Link
            href={`/recovery/${booking.recoveryCase.id}`}
            className="inline-flex items-center gap-1 font-mono text-xs tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0] transition-colors"
          >
            Review
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="font-mono text-xs text-[#F4F4F0]/25 tracking-[0.2em] uppercase">
            —
          </span>
        )}
      </div>
    </div>
  );
}
