/**
 * Atlas Webhook Signature Verification
 */

import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ATLAS_WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';

/**
 * Verify the webhook signature
 */
export function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    // In demo mode, allow unsigned webhooks
    if (process.env.ATLAS_MODE === 'demo') {
      return true;
    }
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate a signature for a payload (useful for testing)
 */
export function generateSignature(payload: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}
