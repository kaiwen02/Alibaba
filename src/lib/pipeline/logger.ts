import prisma from '@/lib/db';

/**
 * Pipeline trace logger.
 *
 * Every step of the Atlas → Ops Console → AI data flow is logged twice:
 *  1. to the server console (immediate, structured prefix)
 *  2. to the PipelineLog table (survives restarts, surfaced in the Ops Console)
 *
 * Logging must NEVER break the pipeline — DB writes are best-effort.
 */

export type PipelineStep =
  | 'ATLAS_ROUTES'
  | 'DISRUPTION_SIM'
  | 'DISRUPTION_PAYLOAD'
  | 'AI_PROMPT'
  | 'AI_RESPONSE'
  | 'AI_PARSE'
  | 'AI_FALLBACK'
  | 'PIPELINE';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const PREFIX = '[pathfinder:pipeline]';

export async function logPipeline(
  step: PipelineStep,
  level: LogLevel,
  message: string,
  meta?: unknown,
  bookingId?: string
): Promise<void> {
  // 1. Console — always
  const line = `${PREFIX}[${step}] ${message}`;
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);

  // 2. Persist — best effort
  try {
    await prisma.pipelineLog.create({
      data: {
        step,
        level,
        message,
        meta: (meta ?? undefined) as never,
        bookingId: bookingId ?? null,
      },
    });
  } catch {
    // swallow — a logging failure must never fail the pipeline
  }
}

/** Recent trace rows, newest first (for the Ops Console). */
export async function getPipelineTrace(take = 40) {
  try {
    return await prisma.pipelineLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  } catch {
    return [];
  }
}

/** Promise timeout helper used across all network-bound steps. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}
