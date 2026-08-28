// AI Rebooking Pipeline — shared types

/** One bookable flight leg discovered via the Atlas API. */
export interface RouteEntry {
  origin: string;
  destination: string;
  flightNo: string;
  airline: string;
  departureTime: string; // ISO
  arrivalTime: string;   // ISO
  durationMin: number;
  price?: number;
  currency?: string;
}

/** Structured route catalog for quick lookup (Step 1 output). */
export interface RouteCatalog {
  generatedAt: string;
  mode: 'demo' | 'sandbox' | 'production';
  routes: RouteEntry[];
  /** origin -> entries, for O(1) lookup */
  byOrigin: Record<string, RouteEntry[]>;
}

/** The captured disruption (Step 2 output). */
export interface DisruptionRecord {
  eventId: string;
  bookingId: string;
  atlasOrderId: string;
  passengerName: string;
  changeType: 'CANCELLED' | 'MATERIAL';
  reason: string;
  disruptedFlight: {
    flightNo: string;
    airline: string;
    origin: string;
    destination: string;
    scheduledDeparture: string;
    scheduledArrival: string;
  };
  originalItinerary: Array<{
    flightNo: string;
    origin: string;
    destination: string;
    departureAt: string;
    arrivalAt: string;
  }>;
  simulatedAt: string;
}

/** One AI-generated alternative travel plan (Step 3 output). */
export interface AiRecoveryPlan {
  id: string;
  title: string;
  legs: Array<{
    flightNo: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
  }>;
  layovers: string[];
  explanation: string;
}

export interface PlanGenerationResult {
  plans: AiRecoveryPlan[];
  source: 'llm' | 'fallback';
  provider?: string;
  model?: string;
}
