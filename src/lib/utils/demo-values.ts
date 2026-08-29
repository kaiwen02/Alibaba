/**
 * Deterministic stand-in values for details the demo has no data source for.
 *
 * Gates, seats and baggage tags are not modelled in the schema and Atlas demo
 * mode does not return them. Deriving them from the PNR keeps a flight showing
 * the same gate and seat on every page and across reloads — random values would
 * visibly disagree between the flight board, check-in and the boarding pass.
 */

/** Stable 32-bit string hash. */
export function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function gateFor(key: string): string {
  const seed = stableHash(`gate:${key}`);
  const letter = String.fromCharCode(65 + (seed % 5)); // A-E
  return `${letter}${12 + (seed % 24)}`;
}

export function terminalFor(key: string): string {
  return String(1 + (stableHash(`terminal:${key}`) % 3));
}

export function seatFor(key: string): string {
  const seed = stableHash(`seat:${key}`);
  const row = 3 + (seed % 30);
  const column = 'ABCDEF'[seed % 6];
  return `${row}${column}`;
}

export function bagTagFor(key: string): string {
  return `PF${String(stableHash(`bag:${key}`) % 1000000).padStart(6, '0')}`;
}

export function bagWeightFor(key: string): string {
  const seed = stableHash(`weight:${key}`);
  return `${(14 + (seed % 9)).toFixed(0)}.${seed % 10} KG`;
}

/** Boarding closes 20 minutes before departure; gate opens 45 minutes before. */
export function boardingTimes(departureAt: string) {
  const departure = new Date(departureAt);
  return {
    boardingAt: new Date(departure.getTime() - 45 * 60 * 1000),
    gateClosesAt: new Date(departure.getTime() - 20 * 60 * 1000),
  };
}

/** Airline industry norm: online check-in opens 48h out and closes 1h before. */
export const CHECK_IN_OPENS_HOURS = 48;
export const CHECK_IN_CLOSES_HOURS = 1;

export type CheckInWindow = 'NOT_OPEN' | 'OPEN' | 'CLOSED' | 'BLOCKED';

export function checkInWindow(
  departureAt: string,
  bookingStatus: string
): CheckInWindow {
  // A disrupted booking must be resolved through recovery before check-in.
  if (bookingStatus === 'DISRUPTED' || bookingStatus === 'CANCELLED') {
    return 'BLOCKED';
  }

  const hoursUntil =
    (new Date(departureAt).getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil > CHECK_IN_OPENS_HOURS) return 'NOT_OPEN';
  if (hoursUntil < CHECK_IN_CLOSES_HOURS) return 'CLOSED';
  return 'OPEN';
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    .toUpperCase();
}
