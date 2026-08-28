import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runPredictionForAllBookings, triggerPredictionWithInputs } from '@/lib/services/prediction';
import prisma from '@/lib/db';

/**
 * POST /api/predictions
 * 
 * Trigger prediction run for all bookings, or for a specific booking
 * with custom risk inputs (admin/demo).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    // If specific booking + inputs provided (admin trigger)
    if (body.bookingId && body.inputs) {
      const result = await triggerPredictionWithInputs(body.bookingId, body.inputs);
      return NextResponse.json(result);
    }

    // Run prediction for all bookings
    const results = await runPredictionForAllBookings();
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Prediction failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/predictions
 * 
 * Get current risk scores for all user bookings.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      segments: { orderBy: { sortOrder: 'asc' } },
      risk: true,
      recoveryCase: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ bookings });
}
