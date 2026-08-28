// Atlas API Types
// Based on Atlas LCC Retailing API specification

export interface SearchParams {
  fromCity: string;      // IATA city code
  toCity: string;        // IATA city code
  fromDate: string;      // ISO date string
  adult: number;
  currency: string;
  cabinClass?: 'ECONOMY' | 'BUSINESS';
}

export interface SearchSegment {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  flightNo: string;
  airline: string;
  aircraft: string;
  duration: number;      // minutes
}

export interface SearchOffer {
  routingIdentifier: string;
  totalPrice: number;
  currency: string;
  journeyTime: number;   // minutes
  segments: SearchSegment[];
  cabinClass: string;
  baggageIncluded: boolean;
  mealIncluded: boolean;
}

export interface SearchResult {
  success: boolean;
  offers: SearchOffer[];
  requestId: string;
  searchTime: number;    // ms
  error?: string;
}

export interface VerifyParams {
  routingIdentifier: string;
}

export interface VerifyResult {
  success: boolean;
  sessionId: string;
  price: number;
  currency: string;
  priceChanged: boolean;
  originalPrice?: number;
  expired?: boolean;
  error?: string;
}

export interface OrderParams {
  sessionId: string;
  passengers: PassengerInfo[];
  contact: ContactInfo;
}

export interface PassengerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  documentType: 'PASSPORT' | 'ID';
  documentNumber: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
}

export interface OrderResult {
  success: boolean;
  orderId: string;
  pnr?: string;
  totalPrice: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  error?: string;
}

export interface PayParams {
  amount: number;
  currency: string;
  paymentMethod: 'CARD' | 'VCC';
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
}

export interface PayResult {
  success: boolean;
  paymentId: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  transactionId?: string;
  error?: string;
}

export interface QueryResult {
  success: boolean;
  orderId: string;
  status: 'PENDING' | 'TICKETED' | 'CANCELLED' | 'FAILED';
  pnr?: string;
  ticketNumber?: string;
  segments: SearchSegment[];
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'FAILED';
  refundAmount: number;
  currency: string;
  error?: string;
}

// Demo mode scenario types
export type DemoScenario = 
  | 'success'
  | 'stale_session'
  | 'price_change'
  | 'no_inventory'
  | 'payment_fail';
