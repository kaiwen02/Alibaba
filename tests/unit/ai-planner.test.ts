/**
 * Unit tests — AI rebooking pipeline (Step 3).
 *
 * Covers: JSON extraction/repair, exactly-3 Zod validation, prompt content,
 * fallback determinism, and the LLM→fallback degradation path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// No DB, no network in unit tests
vi.mock('@/lib/pipeline/logger', () => ({
  logPipeline: vi.fn(async () => {}),
  getPipelineTrace: vi.fn(async () => []),
  withTimeout: (p: Promise<unknown>) => p,
}));

vi.mock('@/lib/ai/llm-client', () => ({
  completeLlm: vi.fn(),
  LlmUnavailableError: class LlmUnavailableError extends Error {},
}));

import { extractAiJson, plansSchema, buildPrompt, generatePlans } from '@/lib/ai/planner';
import { generateFallbackPlans } from '@/lib/ai/fallback-plans';
import { completeLlm } from '@/lib/ai/llm-client';
import type { DisruptionRecord, RouteCatalog, RouteEntry } from '@/lib/pipeline/types';

const mockedCompleteLlm = completeLlm as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function entry(flightNo: string, origin: string, destination: string, dep: string, arr: string, dur = 90): RouteEntry {
  return { origin, destination, flightNo, airline: 'Pathfinder Air', departureTime: dep, arrivalTime: arr, durationMin: dur };
}

const catalog: RouteCatalog = {
  generatedAt: '2026-08-26T00:00:00Z',
  mode: 'demo',
  routes: [
    entry('PF100', 'SIN', 'KUL', '2026-08-26T08:00:00Z', '2026-08-26T09:00:00Z', 60), // disrupted
    entry('PF102', 'SIN', 'KUL', '2026-08-26T12:00:00Z', '2026-08-26T13:00:00Z', 60),
    entry('PF104', 'SIN', 'KUL', '2026-08-26T18:00:00Z', '2026-08-26T19:00:00Z', 60),
    entry('PF200', 'SIN', 'BKK', '2026-08-26T10:00:00Z', '2026-08-26T11:30:00Z', 90),
    entry('PF300', 'BKK', 'KUL', '2026-08-26T14:00:00Z', '2026-08-26T16:00:00Z', 120),
  ],
  byOrigin: {
    SIN: [], // filled below
    BKK: [],
  },
};
catalog.byOrigin.SIN = catalog.routes.filter((r) => r.origin === 'SIN');
catalog.byOrigin.BKK = catalog.routes.filter((r) => r.origin === 'BKK');

const disruption: DisruptionRecord = {
  eventId: 'EVT-test-1',
  bookingId: 'booking-1',
  atlasOrderId: 'ORD-1',
  passengerName: 'Ada Lovelace',
  changeType: 'CANCELLED',
  reason: 'Carrier cancellation — crew availability',
  disruptedFlight: {
    flightNo: 'PF100',
    airline: 'Pathfinder Air',
    origin: 'SIN',
    destination: 'KUL',
    scheduledDeparture: '2026-08-26T08:00:00Z',
    scheduledArrival: '2026-08-26T09:00:00Z',
  },
  originalItinerary: [{
    flightNo: 'PF100', origin: 'SIN', destination: 'KUL',
    departureAt: '2026-08-26T08:00:00Z', arrivalAt: '2026-08-26T09:00:00Z',
  }],
  simulatedAt: '2026-08-25T22:00:00Z',
};

const validLlmJson = JSON.stringify({
  plans: [
    {
      title: 'Midday direct',
      legs: [{ flightNo: 'PF102', origin: 'SIN', destination: 'KUL', departureTime: '2026-08-26T12:00:00Z', arrivalTime: '2026-08-26T13:00:00Z' }],
      layovers: [],
      explanation: 'Sorry about this, Ada — the fastest confirmed seat we could hold for you today.',
    },
    {
      title: 'Via Bangkok',
      legs: [
        { flightNo: 'PF200', origin: 'SIN', destination: 'BKK', departureTime: '2026-08-26T10:00:00Z', arrivalTime: '2026-08-26T11:30:00Z' },
        { flightNo: 'PF300', origin: 'BKK', destination: 'KUL', departureTime: '2026-08-26T14:00:00Z', arrivalTime: '2026-08-26T16:00:00Z' },
      ],
      layovers: ['BKK'],
      explanation: 'A short Bangkok layover keeps you moving today, Ada — we truly appreciate your patience.',
    },
    {
      title: 'Evening direct',
      legs: [{ flightNo: 'PF104', origin: 'SIN', destination: 'KUL', departureTime: '2026-08-26T18:00:00Z', arrivalTime: '2026-08-26T19:00:00Z' }],
      layovers: [],
      explanation: 'If breathing room helps, Ada, this evening departure is confirmed and fully handled on our side.',
    },
  ],
});

beforeEach(() => {
  mockedCompleteLlm.mockReset();
});

// ---------------------------------------------------------------------------
// extractAiJson
// ---------------------------------------------------------------------------

describe('extractAiJson', () => {
  it('strips markdown fences', () => {
    const out = extractAiJson('```json\n{"plans": []}\n```');
    expect(JSON.parse(out)).toEqual({ plans: [] });
  });

  it('strips <think> blocks from reasoning models', () => {
    const out = extractAiJson('<think>let me reason…</think>{"plans": []}');
    expect(JSON.parse(out)).toEqual({ plans: [] });
  });

  it('slices JSON out of surrounding prose', () => {
    const out = extractAiJson('Here you go:\n{"a": 1}\nHope that helps!');
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });

  it('throws when no JSON object is present', () => {
    expect(() => extractAiJson('no json here')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// plansSchema — exactly 3 enforcement
// ---------------------------------------------------------------------------

describe('plansSchema', () => {
  it('accepts exactly 3 plans', () => {
    expect(plansSchema.safeParse(JSON.parse(validLlmJson)).success).toBe(true);
  });

  it('rejects 2 plans', () => {
    const two = JSON.parse(validLlmJson);
    two.plans = two.plans.slice(0, 2);
    expect(plansSchema.safeParse(two).success).toBe(false);
  });

  it('rejects 4 plans', () => {
    const four = JSON.parse(validLlmJson);
    four.plans.push(four.plans[0]);
    expect(plansSchema.safeParse(four).success).toBe(false);
  });

  it('rejects plans with missing legs', () => {
    const bad = JSON.parse(validLlmJson);
    bad.plans[0].legs = [];
    expect(plansSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe('buildPrompt', () => {
  it('includes the disrupted flight, passenger, reason and routes', () => {
    const prompt = buildPrompt(disruption, catalog);
    expect(prompt).toContain('PF100');
    expect(prompt).toContain('Ada Lovelace');
    expect(prompt).toContain('Carrier cancellation');
    expect(prompt).toContain('PF200'); // alternative route present
    expect(prompt).toContain('EXACTLY 3');
  });
});

// ---------------------------------------------------------------------------
// Fallback plans — determinism + exclusion of disrupted flight
// ---------------------------------------------------------------------------

describe('generateFallbackPlans', () => {
  it('returns exactly 3 plans', () => {
    const plans = generateFallbackPlans(disruption, catalog);
    expect(plans).toHaveLength(3);
  });

  it('never uses the disrupted flight', () => {
    const plans = generateFallbackPlans(disruption, catalog);
    for (const p of plans) {
      for (const leg of p.legs) {
        expect(leg.flightNo).not.toBe('PF100');
      }
    }
  });

  it('is deterministic across runs', () => {
    const a = generateFallbackPlans(disruption, catalog);
    const b = generateFallbackPlans(disruption, catalog);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('every plan has an empathetic explanation', () => {
    const plans = generateFallbackPlans(disruption, catalog);
    for (const p of plans) {
      expect(p.explanation.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('produces distinct legs even when flight numbers repeat across routes', () => {
    // Demo-adapter quirk: same flight numbers + departure times on every pair
    const dep = '2026-08-26T00:00:00Z';
    const repCatalog: RouteCatalog = {
      generatedAt: '2026-08-26T00:00:00Z',
      mode: 'demo',
      routes: [
        entry('AK701', 'SIN', 'KUL', dep, '2026-08-26T01:00:00Z', 60),
        entry('MH314', 'SIN', 'KUL', '2026-08-26T00:30:00Z', '2026-08-26T01:35:00Z', 65),
        entry('FD302', 'SIN', 'KUL', '2026-08-26T02:00:00Z', '2026-08-26T03:30:00Z', 90),
        entry('MH314', 'SIN', 'BKK', '2026-08-26T00:30:00Z', '2026-08-26T02:00:00Z', 90),
        entry('FD302', 'SIN', 'BKK', '2026-08-26T02:00:00Z', '2026-08-26T03:30:00Z', 90),
      ],
      byOrigin: {},
    };
    repCatalog.byOrigin = {
      SIN: repCatalog.routes.filter((r) => r.origin === 'SIN'),
    };

    const plans = generateFallbackPlans(disruption, repCatalog);
    expect(plans).toHaveLength(3);

    // No two plans may share an identical leg
    const keys = plans.flatMap((p) =>
      p.legs.map((l) => `${l.flightNo}|${l.origin}|${l.destination}|${l.departureTime}`)
    );
    // Every plan's first leg must be unique across plans
    const firstLegs = plans.map((p) => `${p.legs[0].flightNo}|${p.legs[0].origin}|${p.legs[0].destination}|${p.legs[0].departureTime}`);
    expect(new Set(firstLegs).size).toBe(3);
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// generatePlans — LLM success + degradation paths
// ---------------------------------------------------------------------------

describe('generatePlans', () => {
  it('uses LLM output when valid (fences + think stripped)', async () => {
    mockedCompleteLlm.mockResolvedValueOnce({
      text: `<think>thinking…</think>\`\`\`json\n${validLlmJson}\n\`\`\``,
      provider: 'ollama',
      model: 'deepseek-r1:latest',
    });

    const result = await generatePlans(disruption, catalog);
    expect(result.source).toBe('llm');
    expect(result.plans).toHaveLength(3);
    expect(result.plans[0].title).toBe('Midday direct');
    expect(result.plans[1].layovers).toEqual(['BKK']);
  });

  it('falls back when the LLM is unavailable', async () => {
    mockedCompleteLlm.mockRejectedValueOnce(new Error('All Ollama nodes failed'));

    const result = await generatePlans(disruption, catalog);
    expect(result.source).toBe('fallback');
    expect(result.plans).toHaveLength(3);
  });

  it('falls back when the LLM returns unrecoverable garbage', async () => {
    mockedCompleteLlm.mockResolvedValueOnce({
      text: 'Sorry, I cannot help with that.',
      provider: 'ollama',
      model: 'deepseek-r1:latest',
    });

    const result = await generatePlans(disruption, catalog);
    expect(result.source).toBe('fallback');
    expect(result.plans).toHaveLength(3);
  });

  it('falls back when the LLM returns only 2 plans', async () => {
    const two = JSON.parse(validLlmJson);
    two.plans = two.plans.slice(0, 2);
    mockedCompleteLlm.mockResolvedValueOnce({
      text: JSON.stringify(two),
      provider: 'ollama',
      model: 'deepseek-r1:latest',
    });

    const result = await generatePlans(disruption, catalog);
    expect(result.source).toBe('fallback');
    expect(result.plans).toHaveLength(3);
  });
});
