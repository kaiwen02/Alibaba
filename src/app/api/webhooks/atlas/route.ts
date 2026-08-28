import { NextRequest, NextResponse } from 'next/server';
import { processAtlasWebhook } from '@/lib/webhooks/atlas-handler';

/**
 * POST /api/webhooks/atlas
 * 
 * Receives webhook events from Atlas.
 * This is the sole trigger for Stage 2 (Confirmation).
 * 
 * Requirements:
 * - Verify signature
 * - Validate payload with Zod
 * - Deduplicate by event ID
 * - Return 2xx fast, process async
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-atlas-signature');

  const result = await processAtlasWebhook(rawBody, signature);

  return NextResponse.json(
    { message: result.message },
    { status: result.status }
  );
}
