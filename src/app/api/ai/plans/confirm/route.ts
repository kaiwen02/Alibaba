import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logPipeline } from '@/lib/pipeline/logger';

/**
 * POST /api/ai/plans/confirm — lightweight confirmation of an AI plan selection.
 *
 * Updates the RecoveryCase status to APPROVED without triggering Atlas rebooking.
 * Full execution (order/pay/ticket) remains on the /recovery/[id] page.
 *
 * Body: { bookingId: string, planId: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId;
  const planId = body?.planId;

  if (typeof bookingId !== 'string' || typeof planId !== 'string') {
    return NextResponse.json(
      { error: 'bookingId and planId are required' },
      { status: 400 }
    );
  }

  try {
    const recoveryCase = await prisma.recoveryCase.findFirst({
      where: { bookingId },
    });

    if (!recoveryCase) {
      return NextResponse.json(
        { error: 'Recovery case not found — simulate disruption first' },
        { status: 404 }
      );
    }

    if (recoveryCase.status !== 'PACKAGES_READY') {
      return NextResponse.json(
        { error: `Recovery case is in status ${recoveryCase.status}, cannot confirm` },
        { status: 409 }
      );
    }

    await prisma.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: { status: 'APPROVED' },
    });

    await logPipeline('PIPELINE', 'INFO',
      `AI plan ${planId} confirmed for booking ${bookingId}, recovery case ${recoveryCase.id} set to APPROVED`,
      { planId, recoveryCaseId: recoveryCase.id }, bookingId);

    return NextResponse.json({
      success: true,
      recoveryCaseId: recoveryCase.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
