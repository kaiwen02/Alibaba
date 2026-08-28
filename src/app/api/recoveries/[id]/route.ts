import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRecoveryCase } from '@/lib/services/recovery';
import prisma from '@/lib/db';

/**
 * GET /api/recoveries/[id]
 * 
 * Get recovery case details (Stage 3 entry point).
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
  const recoveryId = params.id;

  const recovery = await getRecoveryCase(recoveryId);

  if (!recovery) {
    return NextResponse.json({ error: 'Recovery case not found' }, { status: 404 });
  }

  // Verify ownership
  if (recovery.booking.userId !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  return NextResponse.json(recovery);
}
