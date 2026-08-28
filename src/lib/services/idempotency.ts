/**
 * Idempotency Service
 * 
 * Provides idempotent operations to prevent duplicate processing
 * from double-clicks, network retries, or multiple devices.
 */

import prisma from '@/lib/db';

export interface IdempotencyRecord {
  key: string;
  createdAt: Date;
}

/**
 * Check if an idempotency key has been used
 */
export async function hasBeenProcessed(key: string): Promise<boolean> {
  const record = await prisma.atlasOperation.findUnique({
    where: { idempotencyKey: key },
  });

  return record !== null;
}

/**
 * Record an idempotency key
 */
export async function recordIdempotencyKey(
  key: string,
  recoveryCaseId: string,
  operation: 'SEARCH' | 'VERIFY' | 'ORDER' | 'PAY' | 'QUERY' | 'REFUND'
): Promise<void> {
  await prisma.atlasOperation.create({
    data: {
      idempotencyKey: key,
      recoveryCaseId,
      operation,
      endpoint: `/${operation.toLowerCase()}.do`,
      status: 'PENDING',
    },
  });
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(
  recoveryCaseId: string,
  operation: string
): string {
  return `${operation}-${recoveryCaseId}-${Date.now()}`;
}

/**
 * Check if a webhook has been processed (by event ID)
 */
export async function isWebhookDuplicate(eventId: string): Promise<boolean> {
  const webhook = await prisma.atlasWebhook.findUnique({
    where: { eventId },
  });

  return webhook !== null;
}

/**
 * Record a webhook event
 */
export async function recordWebhook(
  eventId: string,
  eventType: string,
  orderId: string | null,
  payload: any,
  signature: string
): Promise<void> {
  await prisma.atlasWebhook.create({
    data: {
      eventId,
      eventType,
      orderId,
      payload,
      signature,
      receivedAt: new Date(),
    },
  });
}

/**
 * Mark a webhook as processed
 */
export async function markWebhookProcessed(eventId: string): Promise<void> {
  await prisma.atlasWebhook.update({
    where: { eventId },
    data: { processed: true },
  });
}
