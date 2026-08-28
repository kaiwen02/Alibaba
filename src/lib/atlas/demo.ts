import type { AtlasAdapter } from './adapter';
import type {
  SearchParams,
  SearchResult,
  VerifyResult,
  OrderParams,
  OrderResult,
  PayParams,
  PayResult,
  QueryResult,
  RefundResult,
  DemoScenario,
  SearchOffer,
  SearchSegment,
} from './types';

/**
 * Demo Atlas Adapter
 * 
 * Provides deterministic mock responses for all Atlas API operations.
 * Supports scenario injection for testing edge cases like:
 * - Stale sessions
 * - Price changes
 * - No inventory
 * - Payment failures
 */
export class DemoAtlasAdapter implements AtlasAdapter {
  private scenario: DemoScenario = 'success';
  private sessionCounter = 0;
  private orderCounter = 0;
  private pollCounter: Record<string, number> = {};

  setScenario(scenario: DemoScenario): void {
    this.scenario = scenario;
  }

  getMode(): 'demo' {
    return 'demo';
  }

  async search(params: SearchParams): Promise<SearchResult> {
    await this.simulateLatency();

    if (this.scenario === 'no_inventory') {
      return {
        success: true,
        offers: [],
        requestId: `REQ-${Date.now()}`,
        searchTime: 150,
      };
    }

    const offers = this.generateMockOffers(params);

    return {
      success: true,
      offers,
      requestId: `REQ-${Date.now()}`,
      searchTime: 180,
    };
  }

  async verify(routingIdentifier: string): Promise<VerifyResult> {
    await this.simulateLatency();
    this.sessionCounter++;

    const basePrice = this.extractPriceFromIdentifier(routingIdentifier);

    if (this.scenario === 'stale_session') {
      return {
        success: false,
        sessionId: `SESSION-${this.sessionCounter}`,
        price: basePrice,
        currency: 'USD',
        priceChanged: false,
        expired: true,
        error: 'Session expired. Please search again.',
      };
    }

    if (this.scenario === 'price_change') {
      const newPrice = basePrice * 1.15; // 15% price increase
      return {
        success: true,
        sessionId: `SESSION-${this.sessionCounter}`,
        price: newPrice,
        currency: 'USD',
        priceChanged: true,
        originalPrice: basePrice,
        expired: false,
      };
    }

    return {
      success: true,
      sessionId: `SESSION-${this.sessionCounter}`,
      price: basePrice,
      currency: 'USD',
      priceChanged: false,
      expired: false,
    };
  }

  async order(params: OrderParams): Promise<OrderResult> {
    await this.simulateLatency();
    this.orderCounter++;

    return {
      success: true,
      orderId: `ORDER-${this.orderCounter}-${Date.now()}`,
      pnr: this.generatePNR(),
      totalPrice: this.extractPriceFromSession(params.sessionId),
      currency: 'USD',
      status: 'CONFIRMED',
    };
  }

  async pay(orderId: string, params: PayParams): Promise<PayResult> {
    await this.simulateLatency();

    if (this.scenario === 'payment_fail') {
      return {
        success: false,
        paymentId: `PAY-${Date.now()}`,
        status: 'FAILED',
        error: 'Payment declined. Please try a different payment method.',
      };
    }

    return {
      success: true,
      paymentId: `PAY-${Date.now()}`,
      status: 'SUCCESS',
      transactionId: `TXN-${Date.now()}`,
    };
  }

  async queryOrderDetails(orderId: string): Promise<QueryResult> {
    await this.simulateLatency(50);

    // Track poll attempts per order
    if (!this.pollCounter[orderId]) {
      this.pollCounter[orderId] = 0;
    }
    this.pollCounter[orderId]++;

    // Simulate ticketing taking 2-3 polls
    const isTicketed = this.pollCounter[orderId] >= 2;

    if (isTicketed) {
      return {
        success: true,
        orderId,
        status: 'TICKETED',
        pnr: this.generatePNR(),
        ticketNumber: `TKT-${Date.now()}`,
        segments: this.generateMockSegments(),
      };
    }

    return {
      success: true,
      orderId,
      status: 'PENDING',
      segments: this.generateMockSegments(),
    };
  }

  async refund(orderId: string): Promise<RefundResult> {
    await this.simulateLatency();

    return {
      success: true,
      refundId: `REF-${Date.now()}`,
      status: 'APPROVED',
      refundAmount: 150.00,
      currency: 'USD',
    };
  }

  // ========== Private Helpers ==========

  private generateMockOffers(params: SearchParams): SearchOffer[] {
    const baseDate = new Date(params.fromDate);

    // Offer 1: FASTEST (earliest arrival)
    const offer1: SearchOffer = {
      routingIdentifier: `RI-FAST-${params.fromCity}-${params.toCity}-1`,
      totalPrice: 120.00,
      currency: params.currency,
      journeyTime: 60,
      segments: [this.createSegment(
        params.fromCity,
        params.toCity,
        baseDate,
        new Date(baseDate.getTime() + 60 * 60 * 1000),
        'AK701',
        'AirAsia',
        'A320'
      )],
      cabinClass: 'ECONOMY',
      baggageIncluded: true,
      mealIncluded: false,
    };

    // Offer 2: LOWEST_COST (cheapest)
    const offer2: SearchOffer = {
      routingIdentifier: `RI-CHEAP-${params.fromCity}-${params.toCity}-2`,
      totalPrice: 85.00,
      currency: params.currency,
      journeyTime: 90,
      segments: [this.createSegment(
        params.fromCity,
        params.toCity,
        new Date(baseDate.getTime() + 2 * 60 * 60 * 1000),
        new Date(baseDate.getTime() + 3.5 * 60 * 60 * 1000),
        'FD302',
        'Thai AirAsia',
        'A321'
      )],
      cabinClass: 'ECONOMY',
      baggageIncluded: false,
      mealIncluded: false,
    };

    // Offer 3: LEAST_DISRUPTION (similar timing to original)
    const offer3: SearchOffer = {
      routingIdentifier: `RI-MATCH-${params.fromCity}-${params.toCity}-3`,
      totalPrice: 145.00,
      currency: params.currency,
      journeyTime: 65,
      segments: [this.createSegment(
        params.fromCity,
        params.toCity,
        new Date(baseDate.getTime() + 30 * 60 * 1000),
        new Date(baseDate.getTime() + 95 * 60 * 1000),
        'MH314',
        'Malaysia Airlines',
        'B737'
      )],
      cabinClass: 'ECONOMY',
      baggageIncluded: true,
      mealIncluded: true,
    };

    return [offer1, offer2, offer3];
  }

  private createSegment(
    origin: string,
    destination: string,
    departure: Date,
    arrival: Date,
    flightNo: string,
    airline: string,
    aircraft: string
  ): SearchSegment {
    return {
      origin,
      destination,
      departureTime: departure.toISOString(),
      arrivalTime: arrival.toISOString(),
      flightNo,
      airline,
      aircraft,
      duration: Math.round((arrival.getTime() - departure.getTime()) / 60000),
    };
  }

  private generateMockSegments(): SearchSegment[] {
    const now = new Date();
    return [this.createSegment(
      'SIN',
      'KUL',
      now,
      new Date(now.getTime() + 60 * 60 * 1000),
      'AK701',
      'AirAsia',
      'A320'
    )];
  }

  private generatePNR(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pnr = '';
    for (let i = 0; i < 6; i++) {
      pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pnr;
  }

  private extractPriceFromIdentifier(identifier: string): number {
    // Extract price hint from routing identifier
    if (identifier.includes('FAST')) return 120.00;
    if (identifier.includes('CHEAP')) return 85.00;
    if (identifier.includes('MATCH')) return 145.00;
    return 100.00;
  }

  private extractPriceFromSession(sessionId: string): number {
    // Return a deterministic price based on session
    return 120.00;
  }

  private async simulateLatency(baseMs: number = 100): Promise<void> {
    const jitter = Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, baseMs + jitter));
  }
}
