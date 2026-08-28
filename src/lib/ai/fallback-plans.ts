/**
 * Deterministic fallback plans.
 *
 * Guarantees the pipeline ALWAYS returns exactly 3 distinct alternative
 * plans — used when the LLM is unreachable, times out, or returns JSON
 * that cannot be repaired into a valid shape.
 */

import type { AiRecoveryPlan, DisruptionRecord, RouteCatalog, RouteEntry } from '@/lib/pipeline/types';

const HUBS = ['SIN', 'BKK', 'KUL'];

function empathize(passenger: string, template: string): string {
  return template.replace('{name}', passenger.split(' ')[0] || 'traveller');
}

/** Pick distinct entries from a list, excluding the disrupted flight. */
function pickDistinct(pool: RouteEntry[], disruptedFlightNo: string, max: number): RouteEntry[] {
  const out: RouteEntry[] = [];
  const used = new Set<string>();
  for (const r of pool) {
    if (r.flightNo === disruptedFlightNo) continue;
    const key = `${r.flightNo}|${r.origin}|${r.destination}|${r.departureTime}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Full identity key of one leg (used to keep plans genuinely distinct). */
function legKey(r: { flightNo: string; origin: string; destination: string; departureTime: string }): string {
  return `${r.flightNo}|${r.origin}|${r.destination}|${r.departureTime}`;
}

/** Build one plan: direct leg, no layover. */
function directPlan(id: string, title: string, leg: RouteEntry, explanation: string): AiRecoveryPlan {
  return {
    id,
    title,
    legs: [{
      flightNo: leg.flightNo,
      origin: leg.origin,
      destination: leg.destination,
      departureTime: leg.departureTime,
      arrivalTime: leg.arrivalTime,
    }],
    layovers: [],
    explanation,
  };
}

/** Build one plan: two legs connected through a hub, with layover chip. */
function connectingPlan(
  id: string,
  title: string,
  first: RouteEntry,
  second: RouteEntry,
  explanation: string
): AiRecoveryPlan {
  return {
    id,
    title,
    legs: [
      { flightNo: first.flightNo, origin: first.origin, destination: first.destination, departureTime: first.departureTime, arrivalTime: first.arrivalTime },
      { flightNo: second.flightNo, origin: second.origin, destination: second.destination, departureTime: second.departureTime, arrivalTime: second.arrivalTime },
    ],
    layovers: [first.destination],
    explanation,
  };
}

/**
 * Generate exactly 3 plans from the catalog:
 *  1. Fastest direct replacement
 *  2. One-stop via a hub (if one exists; else second direct)
 *  3. Next available direct (else next connecting; else earliest route)
 */
export function generateFallbackPlans(
  disruption: DisruptionRecord,
  catalog: RouteCatalog
): AiRecoveryPlan[] {
  const origin = disruption.disruptedFlight.origin;
  const dest = disruption.disruptedFlight.destination;
  const disrupted = disruption.disruptedFlight.flightNo;
  const name = disruption.passengerName;

  const fromOrigin = catalog.byOrigin[origin] ?? [];
  const directPool = pickDistinct(
    fromOrigin.filter((r) => r.destination === dest).sort((a, b) => a.durationMin - b.durationMin),
    disrupted,
    3
  );

  const plans: AiRecoveryPlan[] = [];

  // Plan 1 — fastest direct replacement
  if (directPool.length > 0) {
    plans.push(directPlan(
      'plan-fallback-1',
      'Fastest direct replacement',
      directPool[0],
      empathize(name, `We're truly sorry about the disruption, {name}. This is the quickest direct flight we could secure on your route — same destination, minimal waiting, so you can get back on track with as little fuss as possible.`)
    ));
  }

  // Plan 2 — one-stop via hub
  outer:
  for (const hub of HUBS) {
    if (hub === origin || hub === dest) continue;
    const firstLegs = pickDistinct(fromOrigin.filter((r) => r.destination === hub), disrupted, 1);
    if (firstLegs.length === 0) continue;
    // Second leg must depart AFTER the first leg lands — otherwise the
    // connection is physically impossible and must not be offered.
    const secondLegs = pickDistinct(
      (catalog.byOrigin[hub] ?? []).filter(
        (r) => r.destination === dest && r.departureTime > firstLegs[0].arrivalTime
      ),
      disrupted,
      1
    );
    if (secondLegs.length === 0) continue;
    plans.push(connectingPlan(
      'plan-fallback-2',
      `One-stop via ${hub}`,
      firstLegs[0],
      secondLegs[0],
      empathize(name, `We know reroutes are never welcome, {name}. This option connects through ${hub} and keeps you moving today — a short layover in exchange for a confirmed seat.`)
    ));
    break outer;
  }

  // Plan 3 — next available departure not already used by earlier plans
  const usedKeys = new Set(plans.flatMap((p) => p.legs.map(legKey)));
  const remaining = pickDistinct(fromOrigin, disrupted, fromOrigin.length)
    .filter((r) => !usedKeys.has(legKey(r)));
  const thirdLeg = remaining[0];
  if (thirdLeg) {
    usedKeys.add(legKey(thirdLeg));
    plans.push(directPlan(
      `plan-fallback-${plans.length + 1}`,
      'Next available departure',
      thirdLeg,
      empathize(name, `If a little flexibility helps, {name}, this later departure gives you breathing room while we handle everything on our side. Your comfort remains our priority.`)
    ));
  }

  // Pad to exactly 3 if the catalog was thin — reuse remaining entries
  let i = 0;
  while (plans.length < 3 && i < remaining.length) {
    const leg = remaining[i++];
    if (usedKeys.has(legKey(leg))) continue;
    usedKeys.add(legKey(leg));
    plans.push(directPlan(
      `plan-fallback-${plans.length + 1}`,
      'Alternative departure window',
      leg,
      empathize(name, `Another confirmed option for you, {name}. We sincerely apologise for the inconvenience — this flight keeps your plans alive with a different departure window.`)
    ));
  }

  return plans.slice(0, 3);
}
