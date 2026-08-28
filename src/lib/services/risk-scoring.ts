/**
 * Risk Scoring Service
 * 
 * Calculates disruption risk scores based on multiple factors:
 * - Weather severity (50% weight)
 * - Airport disruption level (30% weight)
 * - Inbound flight delay (15% weight)
 * - Historical cancellation rate (5% weight)
 * 
 * Threshold: 0.70 - above this triggers alternative preparation
 */

export interface RiskInputs {
  weatherSeverity: number;      // 0.0 to 1.0
  airportDisruption: number;    // 0.0 to 1.0
  inboundDelay: number;         // 0.0 to 1.0
  historicalCancellation: number; // 0.0 to 1.0
}

export interface RiskResult {
  score: number;
  breakdown: {
    weather: number;
    disruption: number;
    delay: number;
    history: number;
  };
  exceedsThreshold: boolean;
  threshold: number;
}

// Weights as specified in the product core principle
const WEIGHTS = {
  WEATHER: 0.50,
  DISRUPTION: 0.30,
  DELAY: 0.15,
  HISTORY: 0.05,
};

const DEFAULT_THRESHOLD = 0.70;

/**
 * Calculate risk score from inputs
 */
export function calculateRiskScore(inputs: RiskInputs): RiskResult {
  const {
    weatherSeverity,
    airportDisruption,
    inboundDelay,
    historicalCancellation,
  } = inputs;

  // Clamp inputs to 0-1 range
  const weather = clamp(weatherSeverity);
  const disruption = clamp(airportDisruption);
  const delay = clamp(inboundDelay);
  const history = clamp(historicalCancellation);

  const score =
    weather * WEIGHTS.WEATHER +
    disruption * WEIGHTS.DISRUPTION +
    delay * WEIGHTS.DELAY +
    history * WEIGHTS.HISTORY;

  const breakdown = {
    weather: weather * WEIGHTS.WEATHER,
    disruption: disruption * WEIGHTS.DISRUPTION,
    delay: delay * WEIGHTS.DELAY,
    history: history * WEIGHTS.HISTORY,
  };

  return {
    score: Math.round(score * 1000) / 1000,
    breakdown,
    exceedsThreshold: score >= DEFAULT_THRESHOLD,
    threshold: DEFAULT_THRESHOLD,
  };
}

/**
 * Calculate risk score for a specific booking
 * In production, this would call weather APIs, airport status APIs, etc.
 * For demo mode, we use deterministic mock data.
 */
export async function calculateBookingRisk(
  originAirport: string,
  destinationAirport: string,
  departureTime: Date,
  bookingId: string
): Promise<RiskResult> {
  // In demo mode, return deterministic risk based on airport pair
  const inputs = getMockRiskInputs(originAirport, destinationAirport, bookingId);
  return calculateRiskScore(inputs);
}

/**
 * Get mock risk inputs for demo scenarios
 */
function getMockRiskInputs(
  origin: string,
  destination: string,
  bookingId: string
): RiskInputs {
  // Scenario-specific risk inputs for demo
  const scenarios: Record<string, RiskInputs> = {
    // SIN-KUL: High weather risk triggers prediction
    'SIN-KUL': {
      weatherSeverity: 0.85,
      airportDisruption: 0.70,
      inboundDelay: 0.60,
      historicalCancellation: 0.30,
    },
    // BKK-HKT: Moderate risk
    'BKK-HKT': {
      weatherSeverity: 0.75,
      airportDisruption: 0.80,
      inboundDelay: 0.65,
      historicalCancellation: 0.25,
    },
    // SYD-SIN: Low risk
    'SYD-SIN': {
      weatherSeverity: 0.20,
      airportDisruption: 0.15,
      inboundDelay: 0.25,
      historicalCancellation: 0.10,
    },
    // SIN-BKK: High risk (multi-segment disruption)
    'SIN-BKK': {
      weatherSeverity: 0.80,
      airportDisruption: 0.75,
      inboundDelay: 0.55,
      historicalCancellation: 0.35,
    },
  };

  const key = `${origin}-${destination}`;
  return scenarios[key] || {
    weatherSeverity: 0.3,
    airportDisruption: 0.2,
    inboundDelay: 0.2,
    historicalCancellation: 0.15,
  };
}

/**
 * Clamp a number to 0-1 range
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Get risk level label from score
 */
export function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score < 0.30) return 'LOW';
  if (score < 0.50) return 'MEDIUM';
  if (score < 0.70) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Get risk color for UI display
 */
export function getRiskColor(score: number): string {
  if (score < 0.30) return 'green';
  if (score < 0.50) return 'yellow';
  if (score < 0.70) return 'orange';
  return 'red';
}
