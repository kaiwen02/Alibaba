import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/bookings/[id]
 * 
 * Get booking details including segments and risk assessment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const booking = await prisma.booking.findFirst({
    where: {
      id: params.id,
      userId,
    },
    include: {
      segments: { orderBy: { sortOrder: 'asc' } },
      risk: true,
      recoveryCase: {
        include: {
          packages: { where: { isStale: false } },
          notifications: { orderBy: { sentAt: 'desc' }, take: 5 },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json(booking);
}
