/**
 * Demo reset utility.
 *
 * Re-arms rebooking demo cases so the Stage 3 approval flow can be run again.
 * After a successful rebooking a case ends up TICKETED (and its booking
 * RECOVERED), which makes the recovery page render "Rebooking Complete" with no
 * route to the demo checkout. `npm run db:seed` does not undo this because it
 * upserts with `update: {}`.
 *
 * Status changes only - no rows are deleted. Payment/Ticketing rows are
 * append-only and their idempotency keys are time-based, so replays are safe.
 *
 * Usage:
 *   node scripts/reset-demo.js            # re-arm every case
 *   node scripts/reset-demo.js ABC123     # re-arm only the case for that PNR
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const pnrFilter = process.argv[2];

async function main() {
  const cases = await prisma.recoveryCase.findMany({
    include: {
      booking: { select: { id: true, pnr: true, status: true } },
      packages: { select: { id: true } },
    },
  });

  const targets = pnrFilter
    ? cases.filter((c) => c.booking.pnr === pnrFilter)
    : cases;

  if (!targets.length) {
    console.log(
      pnrFilter
        ? `No recovery case found for PNR ${pnrFilter}. Known PNRs: ${cases.map((c) => c.booking.pnr).join(', ') || 'none'}`
        : 'No recovery cases found. Run `npm run db:seed` first.'
    );
    return;
  }

  for (const c of targets) {
    await prisma.recoveryCase.update({
      where: { id: c.id },
      data: { status: 'PACKAGES_READY', resolvedAt: null },
    });

    // DISRUPTED (not CONFIRMED) is what `createRecoveryCase` leaves behind when
    // packages go ready, so this is the state the dashboard expects alongside a
    // PACKAGES_READY case. It also keeps `runPredictionForAllBookings` from
    // re-scanning the booking, since that query only looks at CONFIRMED ones.
    await prisma.booking.update({
      where: { id: c.booking.id },
      data: { status: 'DISRUPTED' },
    });

    // Freshen the cached packages so price re-verification does not treat them as stale.
    await prisma.recoveryPackage.updateMany({
      where: { recoveryCaseId: c.id },
      data: { isStale: false, verifiedAt: new Date(), selected: false },
    });

    console.log(`re-armed  PNR ${c.booking.pnr}  ->  /recovery/${c.id}`);
    console.log(`          booking: DISRUPTED   case: PACKAGES_READY   packages: ${c.packages.length}`);
  }

  console.log(`\n${targets.length} case(s) re-armed.`);
  console.log('Hard-refresh the dashboard (Ctrl+Shift+R) - a normal reload can show stale state.');
  console.log('Then pick a case, choose a package, and run the demo checkout.');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
