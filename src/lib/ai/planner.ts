/**
 * Step 3 — AI Planner
 *
 * Builds the prompt from the captured disruption (Step 2) + route catalog
 * (Step 1), asks the LLM for EXACTLY 3 structured JSON plans, repairs and
 * validates the response, and falls back to deterministic plans whenever
 * the LLM path fails.
 */

import { z } from 'zod';
import { logPipeline } from '@/lib/pipeline/logger';
import type { AiRecoveryPlan, DisruptionRecord, PlanGenerationResult, RouteCatalog } from '@/lib/pipeline/types';
import { completeLlm, LlmUnavailableError } from './llm-client';
import { generateFallbackPlans } from './fallback-plans';

/** Max routes injected into the prompt (keeps it small for free-tier models). */
const MAX_PROMPT_ROUTES = 40;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildPrompt(disruption: DisruptionRecord, catalog: RouteCatalog): string {
  const origin = disruption.disruptedFlight.origin;
  const dest = disruption.disruptedFlight.destination;

  // Prioritise routes that could plausibly re-route the passenger
  const relevant = [
    ...(catalog.byOrigin[origin] ?? []),
    ...catalog.routes.filter((r) => r.origin !== origin),
  ];
  const seen = new Set<string>();
  const routeList = relevant.filter((r) => {
    const k = `${r.flightNo}|${r.origin}|${r.destination}|${r.departureTime}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, MAX_PROMPT_ROUTES).map((r) => ({
    flightNo: r.flightNo, origin: r.origin, destination: r.destination,
    departure: r.departureTime, arrival: r.arrivalTime,
  }));

  return `You are Pathfinder, an empathetic airline recovery assistant.

A passenger's flight was disrupted. Using ONLY the available routes below, create EXACTLY 3 distinct alternative travel plans.

DISRUPTED FLIGHT:
${JSON.stringify(disruption.disruptedFlight, null, 2)}

PASSENGER: ${disruption.passengerName}
DISRUPTION TYPE: ${disruption.changeType}
REASON: ${disruption.reason}
ORIGINAL ITINERARY:
${JSON.stringify(disruption.originalItinerary, null, 2)}

AVAILABLE ROUTES (the ONLY flights you may use):
${JSON.stringify(routeList, null, 2)}

RULES:
- Exactly 3 plans. Each plan must be genuinely different (different flights or routings).
- Every leg's flightNo/origin/destination/departure/arrival MUST come from AVAILABLE ROUTES.
- Prefer plans that reach ${dest} (direct first, then via a layover city if needed).
- Each plan gets a short (1-2 sentence), warm, empathetic explanation addressed to the passenger, explaining why this option is offered.

Respond with STRICT JSON only — no markdown fences, no commentary — in exactly this shape:
{
  "plans": [
    {
      "title": "short plan name",
      "legs": [{ "flightNo": "...", "origin": "...", "destination": "...", "departureTime": "...", "arrivalTime": "..." }],
      "layovers": ["IATA or empty"],
      "explanation": "empathetic message"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// JSON extraction & validation
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from raw LLM text:
 * strips <think> blocks (deepseek-r1), markdown fences, and surrounding prose.
 */
export function extractAiJson(raw: string): string {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '```')
    .replace(/```/g, '');

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in LLM response');
  }
  return text.slice(start, end + 1);
}

const legSchema = z.object({
  flightNo: z.string().min(1),
  origin: z.string().min(2),
  destination: z.string().min(2),
  departureTime: z.string().min(1),
  arrivalTime: z.string().min(1),
});

/** Zod schema enforcing EXACTLY 3 plans. */
export const plansSchema = z.object({
  plans: z.array(z.object({
    title: z.string().min(1),
    legs: z.array(legSchema).min(1),
    layovers: z.array(z.string()).default([]),
    explanation: z.string().min(10),
  })).length(3),
});

/** Parse + validate LLM text into exactly-3 plans; throws on failure. */
function parsePlans(raw: string, bookingId?: string): AiRecoveryPlan[] {
  const jsonText = extractAiJson(raw);
  const parsed = plansSchema.parse(JSON.parse(jsonText));

  return parsed.plans.map((p, idx) => ({
    id: `plan-ai-${idx + 1}`,
    title: p.title,
    legs: p.legs,
    layovers: p.layovers.filter(Boolean),
    explanation: p.explanation,
  }));
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate exactly 3 alternative plans for a disruption.
 * Never throws — degrades to deterministic fallback plans.
 */
export async function generatePlans(
  disruption: DisruptionRecord,
  catalog: RouteCatalog
): Promise<PlanGenerationResult> {
  const bookingId = disruption.bookingId;
  const fallback = (): PlanGenerationResult => ({
    plans: generateFallbackPlans(disruption, catalog),
    source: 'fallback',
  });

  // Build + log prompt
  const prompt = buildPrompt(disruption, catalog);
  await logPipeline('AI_PROMPT', 'INFO',
    `Prompt built (${prompt.length} chars, disruption ${disruption.eventId})`,
    { promptChars: prompt.length }, bookingId);

  // Call the LLM
  let completion;
  try {
    completion = await completeLlm(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const level = err instanceof LlmUnavailableError ? 'WARN' : 'ERROR';
    await logPipeline('AI_RESPONSE', level, `LLM unavailable — switching to fallback: ${msg}`, undefined, bookingId);
    await logPipeline('AI_FALLBACK', 'INFO', 'Using deterministic fallback plans', undefined, bookingId);
    return fallback();
  }

  await logPipeline('AI_RESPONSE', 'INFO',
    `LLM responded via ${completion.provider} (${completion.text.length} chars)`,
    { provider: completion.provider, model: completion.model }, bookingId);

  // Parse with one repair retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const plans = parsePlans(completion.text, bookingId);

      // Soft cross-check: warn (never fail) about flights not in the catalog
      const catalogFlights = new Set(catalog.routes.map((r) => r.flightNo));
      const unknown = plans.flatMap((p) => p.legs.map((l) => l.flightNo)).filter((f) => !catalogFlights.has(f));
      if (unknown.length > 0) {
        await logPipeline('AI_PARSE', 'WARN', `LLM invented flights not in catalog: ${Array.from(new Set(unknown)).join(', ')}`, undefined, bookingId);
      }

      await logPipeline('AI_PARSE', 'INFO', `Validated ${plans.length} AI plans`, undefined, bookingId);
      return { plans, source: 'llm', provider: completion.provider, model: completion.model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logPipeline('AI_PARSE', 'WARN', `Plan parse attempt ${attempt + 1} failed: ${msg}`, undefined, bookingId);
    }
  }

  await logPipeline('AI_FALLBACK', 'WARN', 'LLM output unusable after repair attempts — using fallback plans', undefined, bookingId);
  return fallback();
}
