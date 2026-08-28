/**
 * Step 2 — Simulate Disruption via Ops Console
 *
 * Reuses the exact same services the Ops Console uses:
 *  1. triggerPredictionWithInputs() — raise risk + pre-stage alternatives
 *  2. generateSignature() + processAtlasWebhook() — fire a signed
 *     order.schedulechange event into the webhook handler
 *
 * Captures everything the AI step needs: the disrupted flight, the
 * passenger's original itinerary, and the disruption reason.
 */

import prisma from '@/lib/db';
import { triggerPredictionWithInputs } from '@/lib/services/prediction';
import { processAtlasWebhook } from '@/lib/webhooks/atlas-handler';
import { generateSignature } from '@/lib/webhooks/signature';
import { logPipeline } from './logger';
import type { DisruptionRecord } from './types';

export type SimulatedChangeType = 'CANCELLED' | 'MATERIAL';

const DISRUPTION_REASONS: Record<SimulatedChangeType, string> = {
  CANCELLED: 'Carrier cancellation — crew availability (simulated via Ops Console)',
  MATERIAL: 'Material schedule change — 6h+ delay from severe weather at origin (simulated via Ops Console)',
};

/** High-risk inputs, matching the Ops Console trigger presets. */
const HIGH_RISK_INPUTS = {
  weatherSeverity: 0.85,
  airportDisruption: 0.75,
  inboundDelay: 0.6,
  historicalCancellation: 0.3,
};

/**
 * Simulate a disruption for a booking and return the captured record.
 * Throws if the booking does not exist or the webhook is rejected.
 */
export async function simulateDisruption(
  bookingId: string,
  changeType: SimulatedChangeType = 'CANCELLED'
): Promise<DisruptionRecord> {
  // 1. Load the booking + its itinerary
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { segments: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!booking || booking.segments.length === 0) {
    await logPipeline('DISRUPTION_SIM', 'ERROR', `Booking ${bookingId} not found or has no segments`, undefined, bookingId);
    throw new Error(`Booking not found or has no segments: ${bookingId}`);
  }

  const first = booking.segments[0];
  const reason = DISRUPTION_REASONS[changeType];

  await logPipeline('DISRUPTION_SIM', 'INFO',
    `Simulating ${changeType} on ${first.flightNo} ${first.origin}->${first.destination} (booking ${booking.atlasOrderId})`,
    undefined, bookingId);

  // 2. Run the prediction engine (raises risk, pre-stages recovery packages)
  const prediction = await triggerPredictionWithInputs(bookingId, HIGH_RISK_INPUTS);
  await logPipeline('DISRUPTION_SIM', 'INFO',
    `Prediction fired: risk ${prediction.riskScore}, triggered=${prediction.triggered}, packages staged=${prediction.packagesPrepared}`,
    { riskScore: prediction.riskScore }, bookingId);

  // 3. Fire the signed schedule-change webhook through the real handler
  const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const newDeparture = changeType === 'MATERIAL'
    ? new Date(first.departureAt.getTime() + 6 * 60 * 60 * 1000).toISOString()
    : null;

  const webhookPayload = JSON.stringify({
    id: eventId,
    type: 'order.schedulechange',
    timestamp: new Date().toISOString(),
    data: {
      orderId: booking.atlasOrderId,
      changeType,
      oldDeparture: first.departureAt.toISOString(),
      oldArrival: first.arrivalAt.toISOString(),
      ...(newDeparture ? { newDeparture } : {}),
      reason,
    },
  });

  const signature = generateSignature(webhookPayload);
  const webhookResult = await processAtlasWebhook(webhookPayload, signature);

  if (webhookResult.status !== 200) {
    await logPipeline('DISRUPTION_SIM', 'ERROR',
      `Webhook rejected (${webhookResult.status}): ${webhookResult.message}`, undefined, bookingId);
    throw new Error(`Disruption webhook rejected: ${webhookResult.message}`);
  }

  await logPipeline('DISRUPTION_SIM', 'INFO',
    `Disruption captured: event ${eventId} (${changeType}) — recovery case created async`,
    { eventId }, bookingId);

  // 4. Assemble the captured record for the AI step
  const record: DisruptionRecord = {
    eventId,
    bookingId: booking.id,
    atlasOrderId: booking.atlasOrderId,
    passengerName: booking.passengerName ?? 'Valued Traveller',
    changeType,
    reason,
    disruptedFlight: {
      flightNo: first.flightNo,
      airline: first.airline,
      origin: first.origin,
      destination: first.destination,
      scheduledDeparture: first.departureAt.toISOString(),
      scheduledArrival: first.arrivalAt.toISOString(),
    },
    originalItinerary: booking.segments.map((s) => ({
      flightNo: s.flightNo,
      origin: s.origin,
      destination: s.destination,
      departureAt: s.departureAt.toISOString(),
      arrivalAt: s.arrivalAt.toISOString(),
    })),
    simulatedAt: new Date().toISOString(),
  };

  // 5. Persist the payload as the clean handoff to the Flight Board.
  // The Flight Board (Step 1 + Step 3) picks it up via getLatestDisruption().
  await logPipeline('DISRUPTION_PAYLOAD', 'INFO',
    `Disruption payload handed off to Flight Board (${record.changeType} on ${record.disruptedFlight.flightNo})`,
    record, bookingId);

  return record;
}

/**
 * Handoff reader (Flight Board side).
 *
 * Returns the most recent disruption payload captured by the Ops Console
 * for a booking, or null if no disruption has been simulated yet.
 */
export async function getLatestDisruption(bookingId: string): Promise<DisruptionRecord | null> {
  const row = await prisma.pipelineLog.findFirst({
    where: { step: 'DISRUPTION_PAYLOAD', bookingId },
    orderBy: { createdAt: 'desc' },
  });

  if (!row || !row.meta) return null;

  // Defensive shape check — a corrupted payload must surface as "no payload"
  const meta = row.meta as unknown as DisruptionRecord;
  if (!meta?.disruptedFlight || !meta?.originalItinerary || !meta?.reason) {
    await logPipeline('DISRUPTION_PAYLOAD', 'WARN',
      `Stored handoff payload for booking ${bookingId} is malformed — ignoring`, undefined, bookingId);
    return null;
  }
  return meta;
}
