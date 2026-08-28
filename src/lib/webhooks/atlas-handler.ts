/**
 * Atlas Webhook Handler
 * 
 * Processes order.schedulechange events from Atlas.
 * This is the sole trigger for Stage 2 (Confirmation).
 */

import prisma from '@/lib/db';
import { z } from 'zod';
import { verifySignature } from './signature';
import { isWebhookDuplicate, recordWebhook, markWebhookProcessed } from '@/lib/services/idempotency';
import { createRecoveryCase } from '@/lib/services/recovery';
import { notifyDisruption, notifyPackagesReady } from '@/lib/services/notification';
import type { ChangeType, Severity } from '@prisma/client';

// Zod schema for Atlas webhook payload
export const atlasWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.string().optional(),
  data: z.object({
    orderId: z.string(),
    changeType: z.enum(['MINOR', 'MATERIAL', 'CANCELLED']),
    oldDeparture: z.string().optional(),
    newDeparture: z.string().optional(),
    oldArrival: z.string().optional(),
    newArrival: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export type AtlasWebhookPayload = z.infer<typeof atlasWebhookSchema>;

/**
 * Process an Atlas webhook event
 */
export async function processAtlasWebhook(
  rawBody: string,
  signature: string | null
): Promise<{ status: number; message: string }> {
  // 1. Verify signature
  if (!verifySignature(rawBody, signature)) {
    return { status: 401, message: 'Invalid signature' };
  }

  // 2. Parse and validate payload
  let payload: AtlasWebhookPayload;
  try {
    payload = atlasWebhookSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    console.error('Webhook payload validation failed:', error);
    return { status: 400, message: 'Invalid payload' };
  }

  // 3. Only process schedule change events
  if (payload.type !== 'order.schedulechange') {
    return { status: 200, message: 'Event type ignored' };
  }

  // 4. Check for duplicate (deduplication by event ID)
  const isDuplicate = await isWebhookDuplicate(payload.id);
  if (isDuplicate) {
    return { status: 200, message: 'Already processed' };
  }

  // 5. Record the webhook
  await recordWebhook(
    payload.id,
    payload.type,
    payload.data.orderId,
    payload,
    signature || ''
  );

  // 6. Process asynchronously (don't block response)
  processWebhookAsync(payload).catch(error => {
    console.error('Async webhook processing failed:', error);
  });

  // 7. Return fast 2xx response
  return { status: 200, message: 'OK' };
}

/**
 * Async webhook processing
 * This runs in the background after returning 2xx to Atlas
 */
async function processWebhookAsync(payload: AtlasWebhookPayload): Promise<void> {
  const { orderId, changeType } = payload.data;

  // Find the booking by Atlas order ID
  const booking = await prisma.booking.findUnique({
    where: { atlasOrderId: orderId },
    include: { user: true },
  });

  if (!booking) {
    console.warn(`Webhook: Booking not found for orderId ${orderId}`);
    return;
  }

  // Determine severity based on change type
  const severity = mapChangeTypeToSeverity(changeType);

  // Create recovery case
  const recoveryCaseId = await createRecoveryCase(
    booking.id,
    payload.id,
    changeType as ChangeType,
    severity as Severity
  );

  // Get package count
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: { packages: { where: { isStale: false } } },
  });

  const packageCount = recoveryCase?.packages.length || 0;

  // Send notifications
  await notifyDisruption(
    booking.userId,
    recoveryCaseId,
    booking.id,
    changeType,
    severity
  );

  if (packageCount > 0) {
    await notifyPackagesReady(booking.userId, recoveryCaseId, packageCount);
  }

  // Mark webhook as processed
  await markWebhookProcessed(payload.id);

  console.log(`Webhook processed: ${payload.id} for booking ${booking.atlasOrderId}`);
}

/**
 * Map Atlas change type to internal severity
 */
function mapChangeTypeToSeverity(changeType: string): string {
  const mapping: Record<string, string> = {
    MINOR: 'LOW',
    MATERIAL: 'HIGH',
    CANCELLED: 'CRITICAL',
  };
  return mapping[changeType] || 'MEDIUM';
}
