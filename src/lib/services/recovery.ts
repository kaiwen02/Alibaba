/**
 * Recovery Service
 * 
 * Manages the recovery flow from disruption detection to ticketing.
 * 
 * Stage 2: Confirmation (Webhook-driven)
 * Stage 3: Approval (Human-gated)
 */

import prisma from '@/lib/db';
import { createAtlasAdapter } from '@/lib/atlas/adapter';
import { acquireLock, releaseLock } from '@/lib/utils/lock';
import { sleep } from '@/lib/utils';
import type { ChangeType, Severity, RecoveryStatus } from '@prisma/client';

const atlas = createAtlasAdapter();

export interface RecoveryInfo {
  recoveryCase: any;
  packages: any[];
  booking: any;
}

/**
 * Create a recovery case from a webhook event
 */
export async function createRecoveryCase(
  bookingId: string,
  webhookEventId: string,
  changeType: ChangeType,
  severity: Severity
): Promise<string> {
  // Check for existing recovery case (deduplication)
  const existing = await prisma.recoveryCase.findUnique({
    where: { webhookEventId },
  });

  if (existing) {
    return existing.id;
  }

  const recoveryCase = await prisma.recoveryCase.create({
    data: {
      bookingId,
      webhookEventId,
      changeType,
      severity,
      status: 'PENDING',
    },
  });

  // Move cached packages from prediction to recovery case
  const risk = await prisma.disruptionRisk.findUnique({
    where: { bookingId },
  });

  if (risk) {
    await prisma.recoveryPackage.updateMany({
      where: { riskId: risk.id, recoveryCaseId: null },
      data: { recoveryCaseId: recoveryCase.id },
    });
  }

  // Update booking status
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'DISRUPTED' },
  });

  // Mark packages as ready
  await prisma.recoveryCase.update({
    where: { id: recoveryCase.id },
    data: { status: 'PACKAGES_READY' },
  });

  return recoveryCase.id;
}

/**
 * Get recovery case with all related data
 */
export async function getRecoveryCase(recoveryCaseId: string): Promise<RecoveryInfo | null> {
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: {
      booking: {
        include: {
          segments: { orderBy: { sortOrder: 'asc' } },
          user: true,
        },
      },
      packages: {
        where: { isStale: false },
        orderBy: { price: 'asc' },
      },
      notifications: {
        orderBy: { sentAt: 'desc' },
      },
      operations: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!recoveryCase) return null;

  return {
    recoveryCase,
    packages: recoveryCase.packages,
    booking: recoveryCase.booking,
  };
}

/**
 * Approve and execute a recovery package
 * 
 * This is the human-gated Stage 3:
 * 1. Verify user owns the booking
 * 2. Re-verify the package price (session may be stale)
 * 3. Execute order.do
 * 4. Execute pay.do
 * 5. Poll queryOrderDetails.do until ticketed
 */
export async function approveAndExecuteRecovery(
  recoveryCaseId: string,
  selectedPackageId: string,
  userId: string
): Promise<{
  success: boolean;
  ticketing?: any;
  error?: string;
  priceChanged?: boolean;
  newPrice?: number;
}> {
  // 1. Acquire idempotency lock
  const lockKey = `recovery:${recoveryCaseId}:approve`;
  const lock = await acquireLock(lockKey);
  if (!lock) {
    return {
      success: false,
      error: 'Request already in progress. Please wait.',
    };
  }

  try {
    // 2. Verify ownership and get recovery case
    const recovery = await prisma.recoveryCase.findFirst({
      where: {
        id: recoveryCaseId,
        booking: { userId },
      },
      include: {
        booking: { include: { segments: true } },
        packages: { where: { id: selectedPackageId } },
      },
    });

    if (!recovery) {
      return { success: false, error: 'Recovery case not found or unauthorized.' };
    }

    const selectedPackage = recovery.packages[0];
    if (!selectedPackage) {
      return { success: false, error: 'Selected package not found.' };
    }

    // 3. Update status to EXECUTING
    await prisma.recoveryCase.update({
      where: { id: recoveryCaseId },
      data: { status: 'EXECUTING' },
    });

    // 4. Re-verify the package price
    const verifyResult = await atlas.verify(selectedPackage.atlasSessionId || '');
    
    await logOperation(recoveryCaseId, 'VERIFY', '/verify.do', 
      { routingIdentifier: selectedPackage.atlasSessionId },
      verifyResult,
      verifyResult.success ? 'SUCCESS' : 'FAILED'
    );

    if (!verifyResult.success) {
      if (verifyResult.expired) {
        // Package is stale, need to re-search
        await prisma.recoveryCase.update({
          where: { id: recoveryCaseId },
          data: { status: 'PACKAGES_READY' },
        });
        return { success: false, error: 'Package expired. Please select a new option.' };
      }
      return { success: false, error: verifyResult.error || 'Price verification failed.' };
    }

    // Check for price change
    const priceChanged = verifyResult.priceChanged;
    const newPrice = verifyResult.price;

    // Log price verification
    await prisma.priceVerification.create({
      data: {
        packageId: selectedPackageId,
        recoveryCaseId,
        originalPrice: selectedPackage.price || 0,
        verifiedPrice: newPrice,
        priceChanged,
        sessionId: verifyResult.sessionId,
      },
    });

    // 5. Execute order
    const orderResult = await atlas.order({
      sessionId: verifyResult.sessionId,
      passengers: [{
        firstName: recovery.booking.passengerName?.split(' ')[0] || 'Demo',
        lastName: recovery.booking.passengerName?.split(' ').slice(1).join(' ') || 'Traveler',
        email: recovery.booking.passengerEmail || 'demo@pathfinder.dev',
        phone: '+1234567890',
        dateOfBirth: '1990-01-01',
        documentType: 'PASSPORT',
        documentNumber: 'DEMO123456',
      }],
      contact: {
        email: recovery.booking.passengerEmail || 'demo@pathfinder.dev',
        phone: '+1234567890',
      },
    });

    await logOperation(recoveryCaseId, 'ORDER', '/order.do',
      { sessionId: verifyResult.sessionId },
      orderResult,
      orderResult.success ? 'SUCCESS' : 'FAILED'
    );

    if (!orderResult.success) {
      await prisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: { status: 'FAILED' },
      });
      return { success: false, error: orderResult.error || 'Order creation failed.' };
    }

    // 6. Execute payment
    const payIdempotencyKey = `pay-${recoveryCaseId}-${Date.now()}`;
    const payResult = await atlas.pay(orderResult.orderId, {
      amount: newPrice,
      currency: 'USD',
      paymentMethod: 'CARD',
    });

    await logOperation(recoveryCaseId, 'PAY', '/pay.do',
      { orderId: orderResult.orderId, amount: newPrice },
      payResult,
      payResult.success ? 'SUCCESS' : 'FAILED'
    );

    // Create payment record
    await prisma.payment.create({
      data: {
        recoveryCaseId,
        amount: newPrice,
        currency: 'USD',
        status: payResult.success ? 'SUCCESS' : 'FAILED',
        atlasPayId: payResult.paymentId,
        idempotencyKey: payIdempotencyKey,
        completedAt: payResult.success ? new Date() : null,
      },
    });

    if (!payResult.success) {
      await prisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: { status: 'FAILED' },
      });
      return { success: false, error: payResult.error || 'Payment failed.' };
    }

    // 7. Poll for ticketing with exponential backoff
    const ticketing = await pollForTicketing(orderResult.orderId, recoveryCaseId);

    if (ticketing.status === 'TICKETED') {
      // Success! Update recovery case and booking
      await prisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: {
          status: 'TICKETED',
          resolvedAt: new Date(),
        },
      });

      await prisma.booking.update({
        where: { id: recovery.bookingId },
        data: { status: 'RECOVERED' },
      });

      return {
        success: true,
        ticketing,
        priceChanged,
        newPrice,
      };
    }

    return {
      success: false,
      error: ticketing.failureReason || 'Ticketing did not complete in time.',
      priceChanged,
      newPrice,
    };

  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Poll for ticketing with exponential backoff
 */
async function pollForTicketing(
  orderId: string,
  recoveryCaseId: string,
  maxAttempts: number = 5
): Promise<any> {
  const ticketing = await prisma.ticketing.create({
    data: {
      recoveryCaseId,
      atlasOrderId: orderId,
      status: 'POLLING',
    },
  });

  let attempt = 0;
  let delay = 1000; // Start with 1 second

  while (attempt < maxAttempts) {
    attempt++;
    await sleep(delay);

    const result = await atlas.queryOrderDetails(orderId);

    await logOperation(recoveryCaseId, 'QUERY', '/queryOrderDetails.do',
      { orderId, attempt },
      result,
      result.success ? 'SUCCESS' : 'FAILED'
    );

    await prisma.ticketing.update({
      where: { id: ticketing.id },
      data: {
        pollingAttempt: attempt,
        lastPollAt: new Date(),
      },
    });

    if (result.status === 'TICKETED') {
      await prisma.ticketing.update({
        where: { id: ticketing.id },
        data: {
          status: 'TICKETED',
          ticketedAt: new Date(),
        },
      });
      return { status: 'TICKETED', pnr: result.pnr, ticketNumber: result.ticketNumber };
    }

    if (result.status === 'CANCELLED' || result.status === 'FAILED') {
      await prisma.ticketing.update({
        where: { id: ticketing.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: result.error || 'Ticketing failed',
        },
      });
      return { status: 'FAILED', failureReason: result.error };
    }

    // Exponential backoff
    delay = Math.min(delay * 2, 10000);
  }

  // Timeout
  await prisma.ticketing.update({
    where: { id: ticketing.id },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: 'Ticketing polling timeout',
    },
  });

  return { status: 'FAILED', failureReason: 'Timeout' };
}

/**
 * Log an Atlas operation
 */
async function logOperation(
  recoveryCaseId: string,
  operation: 'SEARCH' | 'VERIFY' | 'ORDER' | 'PAY' | 'QUERY' | 'REFUND',
  endpoint: string,
  requestPayload: any,
  responsePayload: any,
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
): Promise<void> {
  await prisma.atlasOperation.create({
    data: {
      recoveryCaseId,
      operation,
      endpoint,
      requestPayload,
      responsePayload,
      status,
    },
  });
}
