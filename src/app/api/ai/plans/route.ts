/**
 * POST /api/ai/plans — Flight Board endpoint (Steps 1 + 3).
 *
 * Responsibility split:
 *   - The Ops Console ONLY simulates the disruption and hands off the
 *     captured payload (disrupted flight, original itinerary, reason).
 *   - This Flight Board endpoint then:
 *       Step 1 — fetches all available routes from the Atlas API
 *       Step 3 — asks the LLM for exactly 3 structured JSON plans
 *
 * Body: { bookingId: string }
 * Error contract (client surfaces these verbatim):
 *   400 INVALID_BODY        — malformed request
 *   404 NO_DISRUPTION       — Ops Console has not handed off a payload yet
 *   502 ATLAS_FETCH_FAILED  — Atlas route sweep failed (with detail)
 *   500 PIPELINE_FAILED     — unexpected failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchAtlasRoutes } from '@/lib/pipeline/routes-catalog';
import { getLatestDisruption } from '@/lib/pipeline/disruption-sim';
import { generatePlans } from '@/lib/ai/planner';
import { getPipelineTrace, logPipeline } from '@/lib/pipeline/logger';

export const maxDuration = 180; // LLM calls on free nodes can be slow

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { bookingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { bookingId } = body;
  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json(
      { code: 'INVALID_BODY', error: 'bookingId is required' },
      { status: 400 }
    );
  }

  const started = Date.now();

  // --- Handoff: read the payload captured by the Ops Console -------------
  const disruption = await getLatestDisruption(bookingId);
  if (!disruption) {
    await logPipeline('PIPELINE', 'WARN',
      `Flight Board: no disruption payload on record for booking ${bookingId}`, undefined, bookingId);
    return NextResponse.json(
      {
        code: 'NO_DISRUPTION',
        error: 'No disruption on record for this flight. Simulate one in the Ops Console first, then generate alternatives here.',
      },
      { status: 404 }
    );
  }

  await logPipeline('PIPELINE', 'INFO',
    `Flight Board picked up handoff payload ${disruption.eventId} — starting Step 1 (Atlas routes)`,
    undefined, bookingId);

  // --- Step 1: fetch available routes from the Atlas API ------------------
  let catalog;
  try {
    catalog = await fetchAtlasRoutes();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logPipeline('ATLAS_ROUTES', 'ERROR', `Flight Board Atlas fetch failed: ${msg}`, undefined, bookingId);
    return NextResponse.json(
      {
        code: 'ATLAS_FETCH_FAILED',
        error: `Atlas route fetch failed: ${msg}`,
        disruption,
      },
      { status: 502 }
    );
  }

  // --- Step 3: AI plan generation (LLM with deterministic fallback) ------
  // generatePlans never throws — LLM errors degrade to fallback plans and
  // are recorded in the trace.
  const result = await generatePlans(disruption, catalog);

  const durationMs = Date.now() - started;
  await logPipeline('PIPELINE', 'INFO',
    `Flight Board complete: ${result.plans.length} plans (source=${result.source}) in ${durationMs}ms`,
    { source: result.source }, bookingId);

  const trace = await getPipelineTrace(40);

  return NextResponse.json({
    disruption,
    plans: result.plans,
    source: result.source,
    provider: result.provider ?? null,
    model: result.model ?? null,
    catalogSize: catalog.routes.length,
    catalogMode: catalog.mode,
    durationMs,
    trace: trace.map((t) => ({
      step: t.step,
      level: t.level,
      message: t.message,
      createdAt: t.createdAt,
    })),
  });
}
