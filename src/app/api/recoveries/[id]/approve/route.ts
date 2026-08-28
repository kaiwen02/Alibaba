import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { approveAndExecuteRecovery } from '@/lib/services/recovery';
import { notifyTicketed } from '@/lib/services/notification';

/**
 * POST /api/recoveries/[id]/approve
 * 
 * Stage 3: Human-Gated Approval
 * 
 * The traveler must:
 * 1. Be authenticated (prove ownership)
 * 2. Review refreshed pricing
 * 3. Explicitly confirm
 * 
 * Then the system executes: order.do → pay.do → poll queryOrderDetails.do
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const recoveryId = params.id;

  try {
    const body = await req.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    const result = await approveAndExecuteRecovery(recoveryId, packageId, userId);

    // If successful, send ticketing notification
    if (result.success && result.ticketing?.pnr) {
      await notifyTicketed(userId, recoveryId, result.ticketing.pnr);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    );
  }
}
