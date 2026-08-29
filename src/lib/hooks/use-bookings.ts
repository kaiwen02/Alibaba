'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Board-level view of a booking.
 *
 * Mirrors the subset of `/api/predictions` that the traveller-facing pages
 * render. Kept separate from `@/types` `Booking` because that type demands
 * fields (createdAt/updatedAt, full risk breakdown) the board never reads.
 */
export interface BoardSegment {
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  flightNo: string;
  airline: string;
  status: string;
  cabinClass?: string;
}

export interface BoardBooking {
  id: string;
  atlasOrderId: string;
  status: string;
  pnr?: string;
  passengerName?: string;
  segments: BoardSegment[];
  risk?: {
    riskScore: number;
    triggered: boolean;
  } | null;
  recoveryCase?: {
    id: string;
    status: string;
  } | null;
}

/**
 * Shared loader for the traveller pages (flight board, check-in, baggage,
 * boarding passes). Each page previously would have needed its own copy of this
 * fetch; centralising it keeps the status vocabulary consistent across them.
 */
export function useBookings() {
  const [bookings, setBookings] = useState<BoardBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/predictions', { signal });
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to fetch bookings:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  return { bookings, loading, refetch: fetchBookings };
}
