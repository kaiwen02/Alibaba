// Pathfinder — TypeScript Types

// ============================================================================
// API Response Types
// ============================================================================

export interface Booking {
  id: string;
  atlasOrderId: string;
  status: BookingStatus;
  pnr?: string;
  passengerName?: string;
  passengerEmail?: string;
  segments: BookingSegment[];
  risk?: DisruptionRisk | null;
  recoveryCase?: RecoveryCase | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingSegment {
  id: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  flightNo: string;
  airline: string;
  cabinClass: string;
  status: SegmentStatus;
}

export interface DisruptionRisk {
  id: string;
  riskScore: number;
  weatherScore: number;
  disruptionScore: number;
  delayScore: number;
  historyScore: number;
  threshold: number;
  triggered: boolean;
  predictedAt: string;
}

export interface RecoveryCase {
  id: string;
  bookingId: string;
  webhookEventId: string;
  changeType: ChangeType;
  severity: Severity;
  status: RecoveryStatus;
  packages: RecoveryPackage[];
  notifications: Notification[];
  activatedAt: string;
  resolvedAt?: string;
}

export interface RecoveryPackage {
  id: string;
  type: PackageType;
  atlasSessionId?: string;
  price?: string;
  currency: string;
  journeyTime?: number;
  segments: any[];
  isStale: boolean;
  selected: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  deepLink: string;
  read: boolean;
  sentAt: string;
}

export interface AtlasOperation {
  id: string;
  operation: AtlasOpType;
  endpoint: string;
  requestPayload?: any;
  responsePayload?: any;
  status: OperationStatus;
  idempotencyKey?: string;
  durationMs?: number;
  createdAt: string;
}

// ============================================================================
// Enums
// ============================================================================

export type BookingStatus = 'CONFIRMED' | 'DISRUPTED' | 'RECOVERED' | 'CANCELLED';
export type SegmentStatus = 'CONFIRMED' | 'DELAYED' | 'CANCELLED' | 'COMPLETED';
export type ChangeType = 'MINOR' | 'MATERIAL' | 'CANCELLED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecoveryStatus = 'PENDING' | 'PACKAGES_READY' | 'APPROVED' | 'EXECUTING' | 'TICKETED' | 'FAILED';
export type PackageType = 'FASTEST' | 'LOWEST_COST' | 'LEAST_DISRUPTION';
export type AtlasOpType = 'SEARCH' | 'VERIFY' | 'ORDER' | 'PAY' | 'QUERY' | 'REFUND';
export type OperationStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type TicketingStatus = 'PENDING' | 'POLLING' | 'TICKETED' | 'FAILED';
export type NotificationType = 'DISRUPTION_ALERT' | 'PACKAGE_READY' | 'APPROVAL_REQUEST' | 'TICKETED';

// ============================================================================
// API Request Types
// ============================================================================

export interface TriggerPredictionRequest {
  bookingId: string;
  inputs: {
    weatherSeverity: number;
    airportDisruption: number;
    inboundDelay: number;
    historicalCancellation: number;
  };
}

export interface TriggerWebhookRequest {
  bookingId: string;
  changeType: ChangeType;
}

export interface ApproveRecoveryRequest {
  packageId: string;
}

export interface AdminTriggerRequest {
  action: 'trigger_prediction' | 'trigger_webhook' | 'set_scenario' | 'get_operations' | 'get_notifications';
  bookingId?: string;
  changeType?: ChangeType;
  scenario?: string;
}

// ============================================================================
// Demo Scenario Types
// ============================================================================

export type DemoScenario = 
  | 'success'
  | 'stale_session'
  | 'price_change'
  | 'no_inventory'
  | 'payment_fail';
