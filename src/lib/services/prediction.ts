/**
 * Prediction Engine Service
 * 
 * Stage 1: Automatic & Silent
 * 
 * The prediction engine:
 * 1. Fetches all active bookings for a user
 * 2. Calculates risk scores for each booking
 * 3. If score >= threshold (0.70), silently prepares alternatives via Atlas
 * 4. Caches packages (FASTEST, LOWEST_COST, LEAST_DISRUPTION)
 * 5. No user alerts at this stage
 */

import prisma from '@/lib/db';
import { createAtlasAdapter } from '@/lib/atlas/adapter';
import { calculateBookingRisk, calculateRiskScore, type RiskInputs } from './risk-scoring';
import type { AtlasAdapter } from '@/lib/atlas/adapter';
import type { PackageType } from '@prisma/client';

const atlas = createAtlasAdapter();

export interface PredictionResult {
  bookingId: string;
  atlasOrderId: string;
  riskScore: number;
  triggered: boolean;
  packagesPrepared: number;
}

/**
 * Run prediction for all active bookings
 */
export async function runPredictionForAllBookings(): Promise<PredictionResult[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      segments: {
        some: {
          status: { in: ['CONFIRMED', 'DELAYED'] },
        },
      },
    },
    include: {
      segments: {
        orderBy: { sortOrder: 'asc' },
      },
      risk: true,
    },
  });

  const results: PredictionResult[] = [];

  for (const booking of bookings) {
    const result = await runPredictionForBooking(booking);
    results.push(result);
  }

  return results;
}

/**
 * Run prediction for a specific booking
 */
export async function runPredictionForBooking(booking: any): Promise<PredictionResult> {
  const firstSegment = booking.segments[0];
  if (!firstSegment) {
    return {
      bookingId: booking.id,
      atlasOrderId: booking.atlasOrderId,
      riskScore: 0,
      triggered: false,
      packagesPrepared: 0,
    };
  }

  // Calculate risk score
  const riskResult = await calculateBookingRisk(
    firstSegment.origin,
    firstSegment.destination,
    firstSegment.departureAt,
    booking.id
  );

  // Upsert risk record
  await prisma.disruptionRisk.upsert({
    where: { bookingId: booking.id },
    update: {
      riskScore: riskResult.score,
      weatherScore: riskResult.breakdown.weather,
      disruptionScore: riskResult.breakdown.disruption,
      delayScore: riskResult.breakdown.delay,
      historyScore: riskResult.breakdown.history,
      triggered: riskResult.exceedsThreshold,
      predictedAt: new Date(),
    },
    create: {
      bookingId: booking.id,
      riskScore: riskResult.score,
      weatherScore: riskResult.breakdown.weather,
      disruptionScore: riskResult.breakdown.disruption,
      delayScore: riskResult.breakdown.delay,
      historyScore: riskResult.breakdown.history,
      triggered: riskResult.exceedsThreshold,
    },
  });

  // If threshold exceeded, prepare alternatives silently
  let packagesPrepared = 0;
  if (riskResult.exceedsThreshold) {
    packagesPrepared = await prepareAlternatives(booking, firstSegment);
  }

  return {
    bookingId: booking.id,
    atlasOrderId: booking.atlasOrderId,
    riskScore: riskResult.score,
    triggered: riskResult.exceedsThreshold,
    packagesPrepared,
  };
}

/**
 * Prepare alternative packages via Atlas search
 */
async function prepareAlternatives(booking: any, segment: any): Promise<number> {
  const risk = await prisma.disruptionRisk.findUnique({
    where: { bookingId: booking.id },
  });

  if (!risk) return 0;

  // Check if we already have non-stale packages
  const existingPackages = await prisma.recoveryPackage.findMany({
    where: {
      riskId: risk.id,
      isStale: false,
    },
  });

  if (existingPackages.length >= 3) {
    return existingPackages.length; // Already prepared
  }

  // Delete old stale packages
  if (existingPackages.length === 0) {
    await prisma.recoveryPackage.deleteMany({
      where: { riskId: risk.id },
    });
  }

  // Search Atlas for alternatives
  const searchResult = await atlas.search({
    fromCity: segment.origin,
    toCity: segment.destination,
    fromDate: segment.departureAt.toISOString(),
    adult: 1,
    currency: 'USD',
  });

  if (!searchResult.success || searchResult.offers.length === 0) {
    return 0;
  }

  // Sort offers by different criteria and pick top 3
  const offers = searchResult.offers;

  // Fastest arrival
  const fastest = [...offers].sort((a, b) => a.journeyTime - b.journeyTime)[0];

  // Lowest cost
  const cheapest = [...offers].sort((a, b) => a.totalPrice - b.totalPrice)[0];

  // Least disruption (closest to original departure time)
  const originalTime = segment.departureAt.getTime();
  const leastDisruption = [...offers].sort((a, b) => {
    const aTime = Math.abs(new Date(a.segments[0]?.departureTime || 0).getTime() - originalTime);
    const bTime = Math.abs(new Date(b.segments[0]?.departureTime || 0).getTime() - originalTime);
    return aTime - bTime;
  })[0];

  const packageConfigs: Array<{ offer: typeof fastest; type: PackageType }> = [
    { offer: fastest, type: 'FASTEST' },
    { offer: cheapest, type: 'LOWEST_COST' },
    { offer: leastDisruption, type: 'LEAST_DISRUPTION' },
  ];

  let created = 0;
  for (const config of packageConfigs) {
    if (!config.offer) continue;

    await prisma.recoveryPackage.create({
      data: {
        riskId: risk.id,
        type: config.type,
        atlasSessionId: config.offer.routingIdentifier,
        price: config.offer.totalPrice,
        currency: config.offer.currency,
        journeyTime: config.offer.journeyTime,
        segments: config.offer.segments as any,
        isStale: false,
        verifiedAt: new Date(),
      },
    });
    created++;
  }

  return created;
}

/**
 * Manually trigger prediction with custom risk inputs (for demo/admin)
 */
export async function triggerPredictionWithInputs(
  bookingId: string,
  inputs: RiskInputs
): Promise<PredictionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      segments: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  const riskResult = calculateRiskScore(inputs);

  await prisma.disruptionRisk.upsert({
    where: { bookingId: booking.id },
    update: {
      riskScore: riskResult.score,
      weatherScore: riskResult.breakdown.weather,
      disruptionScore: riskResult.breakdown.disruption,
      delayScore: riskResult.breakdown.delay,
      historyScore: riskResult.breakdown.history,
      triggered: riskResult.exceedsThreshold,
      predictedAt: new Date(),
    },
    create: {
      bookingId: booking.id,
      riskScore: riskResult.score,
      weatherScore: riskResult.breakdown.weather,
      disruptionScore: riskResult.breakdown.disruption,
      delayScore: riskResult.breakdown.delay,
      historyScore: riskResult.breakdown.history,
      triggered: riskResult.exceedsThreshold,
    },
  });

  let packagesPrepared = 0;
  const firstSegment = booking.segments[0];
  if (riskResult.exceedsThreshold && firstSegment) {
    packagesPrepared = await prepareAlternatives(booking, firstSegment);
  }

  return {
    bookingId: booking.id,
    atlasOrderId: booking.atlasOrderId,
    riskScore: riskResult.score,
    triggered: riskResult.exceedsThreshold,
    packagesPrepared,
  };
}
