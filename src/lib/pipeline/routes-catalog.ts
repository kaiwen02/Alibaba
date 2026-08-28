/**
 * Step 1 — Fetch Routes via Atlas API
 *
 * Authenticates through the Atlas adapter (demo / sandbox / production),
 * sweeps a fixed route matrix and flattens every returned offer segment
 * into a structured RouteCatalog with an origin-indexed lookup map.
 *
 * Resilience:
 *  - per-pair try/catch: one failed pair never aborts the sweep
 *  - per-search timeout (withTimeout)
 *  - module-level cache with TTL so repeated pipeline runs are cheap
 */

import { createAtlasAdapter } from '@/lib/atlas/adapter';
import type { SearchOffer } from '@/lib/atlas/types';
import { logPipeline, withTimeout } from './logger';
import type { RouteCatalog, RouteEntry } from './types';

/** Route pairs swept for the catalog (IATA city codes). */
const ROUTE_MATRIX: Array<[string, string]> = [
  ['SIN', 'KUL'], ['KUL', 'SIN'],
  ['SIN', 'BKK'], ['BKK', 'SIN'],
  ['BKK', 'KUL'], ['KUL', 'BKK'],
  ['BKK', 'HKT'], ['HKT', 'BKK'],
  ['SYD', 'SIN'], ['SIN', 'SYD'],
  ['SIN', 'HKG'], ['HKG', 'NRT'],
];

const CACHE_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const SEARCH_TIMEOUT_MS = 10_000;      // per search call

let cache: { catalog: RouteCatalog; fetchedAt: number } | null = null;

/** Search date = tomorrow (ISO yyyy-mm-dd, UTC). */
function tomorrowDate(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Flatten one offer into RouteEntry rows (one per segment). */
function offerToEntries(offer: SearchOffer): RouteEntry[] {
  return offer.segments.map((seg) => ({
    origin: seg.origin,
    destination: seg.destination,
    flightNo: seg.flightNo,
    airline: seg.airline,
    departureTime: seg.departureTime,
    arrivalTime: seg.arrivalTime,
    durationMin: seg.duration,
    price: offer.totalPrice,
    currency: offer.currency,
  }));
}

export interface FetchRoutesOptions {
  /** Bypass the TTL cache (used by the Ops Console "force refresh"). */
  force?: boolean;
}

/**
 * Fetch all currently available routes from Atlas and return them in a
 * structured, lookup-friendly catalog.
 */
export async function fetchAtlasRoutes(opts: FetchRoutesOptions = {}): Promise<RouteCatalog> {
  if (!opts.force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    await logPipeline('ATLAS_ROUTES', 'INFO',
      `Route cache hit (${cache.catalog.routes.length} routes)`);
    return cache.catalog;
  }

  const started = Date.now();
  const adapter = createAtlasAdapter();
  const fromDate = tomorrowDate();
  const seen = new Set<string>();
  const routes: RouteEntry[] = [];
  let failedPairs = 0;

  await logPipeline('ATLAS_ROUTES', 'INFO',
    `Sweeping ${ROUTE_MATRIX.length} route pairs via Atlas (${adapter.getMode()} mode, date ${fromDate})`);

  for (const [fromCity, toCity] of ROUTE_MATRIX) {
    try {
      const result = await withTimeout(
        adapter.search({ fromCity, toCity, fromDate, adult: 1, currency: 'USD' }),
        SEARCH_TIMEOUT_MS,
        `Atlas search ${fromCity}->${toCity}`
      );

      if (!result.success) {
        failedPairs++;
        await logPipeline('ATLAS_ROUTES', 'WARN',
          `Atlas search ${fromCity}->${toCity} failed: ${result.error ?? 'unknown error'}`);
        continue;
      }

      for (const offer of result.offers) {
        for (const entry of offerToEntries(offer)) {
          const key = `${entry.flightNo}|${entry.origin}|${entry.destination}|${entry.departureTime}`;
          if (seen.has(key)) continue;
          seen.add(key);
          routes.push(entry);
        }
      }
    } catch (err) {
      failedPairs++;
      await logPipeline('ATLAS_ROUTES', 'WARN',
        `Atlas search ${fromCity}->${toCity} errored: ${err instanceof Error ? err.message : String(err)}`);
      // continue with the next pair — one bad pair must not kill the sweep
    }
  }

  if (routes.length === 0) {
    await logPipeline('ATLAS_ROUTES', 'ERROR', 'Route sweep produced zero routes');
    throw new Error(`Atlas route sweep failed: no routes returned (${failedPairs} pairs errored)`);
  }

  // Origin-indexed lookup map for quick alternative searches
  const byOrigin: Record<string, RouteEntry[]> = {};
  for (const r of routes) {
    (byOrigin[r.origin] ??= []).push(r);
  }

  const catalog: RouteCatalog = {
    generatedAt: new Date().toISOString(),
    mode: adapter.getMode(),
    routes,
    byOrigin,
  };
  cache = { catalog, fetchedAt: Date.now() };

  await logPipeline('ATLAS_ROUTES', 'INFO',
    `Route catalog ready: ${routes.length} unique routes, ${Object.keys(byOrigin).length} origins, ${failedPairs} failed pairs, ${Date.now() - started}ms`,
    { origins: Object.keys(byOrigin) });

  return catalog;
}

/** Test helper — clears the module cache. */
export function clearRouteCache(): void {
  cache = null;
}
