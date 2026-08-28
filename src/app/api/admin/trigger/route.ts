import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { triggerPredictionWithInputs } from '@/lib/services/prediction';
import { processAtlasWebhook } from '@/lib/webhooks/atlas-handler';
import { generateSignature } from '@/lib/webhooks/signature';
import { simulateDisruption } from '@/lib/pipeline/disruption-sim';

/**
 * POST /api/admin/trigger
 * 
 * Admin endpoint for triggering demo scenarios.
 * Supports:
 * - trigger_prediction: Set risk score for a booking
 * - trigger_webhook: Simulate Atlas schedule change event
 * - set_scenario: Change Atlas demo mode scenario
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, bookingId, changeType, scenario } = body;

    switch (action) {
      case 'trigger_prediction': {
        // Trigger prediction with high risk inputs
        const result = await triggerPredictionWithInputs(bookingId, {
          weatherSeverity: 0.85,
          airportDisruption: 0.75,
          inboundDelay: 0.60,
          historicalCancellation: 0.30,
        });
        return NextResponse.json({ action: 'trigger_prediction', result });
      }

      case 'trigger_webhook': {
        // Get booking to find Atlas order ID
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        });

        if (!booking) {
          return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // First, run prediction to prepare packages
        await triggerPredictionWithInputs(bookingId, {
          weatherSeverity: 0.85,
          airportDisruption: 0.75,
          inboundDelay: 0.60,
          historicalCancellation: 0.30,
        });

        // Simulate webhook
        const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const webhookPayload = JSON.stringify({
          id: eventId,
          type: 'order.schedulechange',
          timestamp: new Date().toISOString(),
          data: {
            orderId: booking.atlasOrderId,
            changeType: changeType || 'CANCELLED',
            oldDeparture: new Date().toISOString(),
            newDeparture: null,
            reason: 'Weather disruption',
          },
        });

        const signature = generateSignature(webhookPayload);
        const result = await processAtlasWebhook(webhookPayload, signature);
        return NextResponse.json({ action: 'trigger_webhook', result, eventId });
      }

      case 'simulate_disruption': {
        // Step 2 ONLY — simulate the disruption and hand the captured
        // payload (disrupted flight + original itinerary + reason) off to
        // the Flight Board. No Atlas route fetching or AI happens here.
        const simChangeType: 'CANCELLED' | 'MATERIAL' =
          changeType === 'MATERIAL' ? 'MATERIAL' : 'CANCELLED';
        const disruption = await simulateDisruption(bookingId, simChangeType);
        return NextResponse.json({ action: 'simulate_disruption', disruption });
      }

      case 'set_scenario': {
        // This would set a global state in a real implementation
        // For demo, we'll store it in a cookie or session
        return NextResponse.json({ 
          action: 'set_scenario', 
          scenario,
          message: `Demo scenario set to: ${scenario}` 
        });
      }

      case 'get_operations': {
        // Get recent Atlas operations for the operation log
        const operations = await prisma.atlasOperation.findMany({
          where: {
            recoveryCase: {
              bookingId: bookingId,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return NextResponse.json({ action: 'get_operations', operations });
      }

      case 'get_notifications': {
        // Get notifications for demo user
        const user = await prisma.user.findFirst({
          where: { email: 'demo@pathfinder.dev' },
        });
        
        if (!user) {
          return NextResponse.json({ notifications: [] });
        }

        const notifications = await prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { sentAt: 'desc' },
          take: 10,
          include: {
            recoveryCase: {
              include: { booking: true },
            },
          },
        });
        return NextResponse.json({ action: 'get_notifications', notifications });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin trigger error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Trigger failed' },
      { status: 500 }
    );
  }
}
