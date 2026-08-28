import { PrismaClient } from '@prisma/client';
import { createAtlasAdapter } from '../src/lib/atlas/adapter';
import type { SearchOffer } from '../src/lib/atlas/types';

const prisma = new PrismaClient();
const atlas = createAtlasAdapter();

const ROUTES = [
  {
    atlasOrderId: 'ATLAS-SIN-KUL-001',
    pnr: 'ABC123',
    fromCity: 'SIN',
    toCity: 'KUL',
    daysFromNow: 1,
    riskScore: 0.35,
    weatherScore: 0.4,
    disruptionScore: 0.2,
    delayScore: 0.3,
    historyScore: 0.1,
    label: 'SIN→KUL',
  },
  {
    atlasOrderId: 'ATLAS-BKK-HKT-002',
    pnr: 'DEF456',
    fromCity: 'BKK',
    toCity: 'HKT',
    daysFromNow: 1,
    riskScore: 0.42,
    weatherScore: 0.5,
    disruptionScore: 0.3,
    delayScore: 0.4,
    historyScore: 0.2,
    label: 'BKK→HKT',
  },
  {
    atlasOrderId: 'ATLAS-SYD-SIN-BKK-003',
    pnr: 'GHI789',
    fromCity: 'SYD',
    toCity: 'BKK',
    daysFromNow: 7,
    riskScore: 0.28,
    weatherScore: 0.2,
    disruptionScore: 0.15,
    delayScore: 0.25,
    historyScore: 0.1,
    label: 'SYD→BKK',
  },
] as const;

function offerToSegments(offer: SearchOffer) {
  return offer.segments.map((seg, i) => ({
    origin: seg.origin,
    destination: seg.destination,
    departureAt: new Date(seg.departureTime),
    arrivalAt: new Date(seg.arrivalTime),
    flightNo: seg.flightNo,
    airline: seg.airline,
    cabinClass: offer.cabinClass,
    sortOrder: i,
  }));
}

async function main() {
  console.log('🌱 Seeding Pathfinder database...');
  console.log(`   Atlas mode: ${atlas.getMode()}`);

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@pathfinder.dev' },
    update: {},
    create: {
      email: 'demo@pathfinder.dev',
      name: 'Demo Traveler',
      emailVerified: new Date(),
    },
  });
  console.log(`✓ Created demo user: ${demoUser.email}`);

  // Re-link any bookings orphaned onto a stale user record
  const legacyEmails = ['demo@journeyguard.dev'];
  const relinked = await prisma.booking.updateMany({
    where: {
      userId: { not: demoUser.id },
      OR: [
        { passengerEmail: demoUser.email },
        { passengerEmail: { in: legacyEmails } },
        { user: { email: { in: legacyEmails } } },
      ],
    },
    data: { userId: demoUser.id, passengerEmail: demoUser.email },
  });
  if (relinked.count > 0) {
    console.log(`✓ Re-linked ${relinked.count} orphaned booking(s) to demo user`);
  }

  // Clean up stale legacy user rows
  try {
    for (const email of legacyEmails) {
      const legacyUser = await prisma.user.findUnique({
        where: { email },
        include: { _count: { select: { bookings: true } } },
      });
      if (legacyUser && legacyUser._count.bookings === 0) {
        await prisma.notification.deleteMany({ where: { userId: legacyUser.id } });
        await prisma.user.delete({ where: { id: legacyUser.id } });
        console.log(`✓ Removed stale legacy user: ${email}`);
      }
    }
  } catch (e) {
    console.warn(`⚠ Legacy user cleanup skipped: ${e instanceof Error ? e.message : e}`);
  }

  const now = new Date();

  for (const route of ROUTES) {
    const fromDate = new Date(now.getTime() + route.daysFromNow * 24 * 60 * 60 * 1000);

    console.log(`\n→ Searching Atlas for ${route.label}...`);
    const result = await atlas.search({
      fromCity: route.fromCity,
      toCity: route.toCity,
      fromDate: fromDate.toISOString(),
      adult: 1,
      currency: 'USD',
      cabinClass: 'ECONOMY',
    });

    if (!result.success || result.offers.length === 0) {
      throw new Error(`Atlas search returned no offers for ${route.label}: ${result.error ?? 'no offers'}`);
    }

    const offer = result.offers[0];
    console.log(`  ✓ Got offer: ${offer.segments.map(s => `${s.flightNo} (${s.origin}→${s.destination})`).join(' + ')} — $${offer.totalPrice} ${offer.currency}`);

    const booking = await prisma.booking.upsert({
      where: { atlasOrderId: route.atlasOrderId },
      update: {},
      create: {
        userId: demoUser.id,
        atlasOrderId: route.atlasOrderId,
        status: 'CONFIRMED',
        pnr: route.pnr,
        passengerName: 'Demo Traveler',
        passengerEmail: 'demo@pathfinder.dev',
        segments: {
          create: offerToSegments(offer),
        },
      },
    });
    console.log(`  ✓ Upserted booking: ${booking.atlasOrderId}`);

    await prisma.disruptionRisk.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
        bookingId: booking.id,
        riskScore: route.riskScore,
        weatherScore: route.weatherScore,
        disruptionScore: route.disruptionScore,
        delayScore: route.delayScore,
        historyScore: route.historyScore,
        threshold: 0.70,
        triggered: false,
      },
    });
    console.log(`  ✓ Upserted risk score: ${route.riskScore}`);
  }

  console.log('\n✨ Seeding complete!');
  console.log('\nDemo scenarios ready:');
  console.log('  A) SIN→KUL (ATLAS-SIN-KUL-001) - Flight Cancellation');
  console.log('  B) BKK→HKT (ATLAS-BKK-HKT-002) - 6-Hour Delay + Overnight');
  console.log('  C) SYD→BKK (ATLAS-SYD-SIN-BKK-003) - Multi-Segment Disruption');
  console.log('\nLogin with: demo@pathfinder.dev / demo123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
