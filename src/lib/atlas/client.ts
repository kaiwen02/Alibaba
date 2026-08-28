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
} from './types';

/**
 * Sandbox Atlas Adapter
 * 
 * Makes real API calls to the Atlas Sandbox environment.
 * Handles authentication, token caching, and rate limiting.
 */
export class SandboxAtlasAdapter implements AtlasAdapter {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = process.env.ATLAS_SANDBOX_URL || 'https://sandbox.atriptech.com';
    this.clientId = process.env.ATLAS_CLIENT_ID || '';
    this.clientSecret = process.env.ATLAS_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Atlas sandbox credentials not configured. Falling back to demo mode behavior.');
    }
  }

  getMode(): 'sandbox' {
    return 'sandbox';
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Request new token
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Atlas auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Token expires in 30 minutes, refresh at 25 minutes
    this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000);

    return this.accessToken!;
  }

  private async makeRequest(endpoint: string, body: object): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Atlas API error at ${endpoint}: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async search(params: SearchParams): Promise<SearchResult> {
    try {
      const result = await this.makeRequest('/search.do', {
        fromCity: params.fromCity,
        toCity: params.toCity,
        fromDate: params.fromDate,
        adult: params.adult,
        currency: params.currency,
        cabinClass: params.cabinClass || 'ECONOMY',
      });

      return {
        success: true,
        offers: result.offers || [],
        requestId: result.requestId,
        searchTime: result.searchTime || 0,
      };
    } catch (error) {
      return {
        success: false,
        offers: [],
        requestId: '',
        searchTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verify(routingIdentifier: string): Promise<VerifyResult> {
    try {
      const result = await this.makeRequest('/verify.do', {
        routingIdentifier,
      });

      return {
        success: true,
        sessionId: result.sessionId,
        price: result.price,
        currency: result.currency,
        priceChanged: result.priceChanged || false,
        originalPrice: result.originalPrice,
        expired: result.expired || false,
      };
    } catch (error) {
      return {
        success: false,
        sessionId: '',
        price: 0,
        currency: 'USD',
        priceChanged: false,
        expired: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async order(params: OrderParams): Promise<OrderResult> {
    try {
      const result = await this.makeRequest('/order.do', {
        sessionId: params.sessionId,
        passengers: params.passengers,
        contact: params.contact,
      });

      return {
        success: true,
        orderId: result.orderId,
        pnr: result.pnr,
        totalPrice: result.totalPrice,
        currency: result.currency,
        status: result.status || 'CONFIRMED',
      };
    } catch (error) {
      return {
        success: false,
        orderId: '',
        totalPrice: 0,
        currency: 'USD',
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async pay(orderId: string, params: PayParams): Promise<PayResult> {
    try {
      const result = await this.makeRequest('/pay.do', {
        orderId,
        amount: params.amount,
        currency: params.currency,
        paymentMethod: params.paymentMethod,
      });

      return {
        success: true,
        paymentId: result.paymentId,
        status: result.status || 'SUCCESS',
        transactionId: result.transactionId,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: '',
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async queryOrderDetails(orderId: string): Promise<QueryResult> {
    try {
      const result = await this.makeRequest('/queryOrderDetails.do', {
        orderId,
      });

      return {
        success: true,
        orderId: result.orderId || orderId,
        status: result.status,
        pnr: result.pnr,
        ticketNumber: result.ticketNumber,
        segments: result.segments || [],
      };
    } catch (error) {
      return {
        success: false,
        orderId,
        status: 'PENDING',
        segments: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async refund(orderId: string): Promise<RefundResult> {
    try {
      const result = await this.makeRequest('/refund.do', {
        orderId,
      });

      return {
        success: true,
        refundId: result.refundId,
        status: result.status || 'APPROVED',
        refundAmount: result.refundAmount,
        currency: result.currency,
      };
    } catch (error) {
      return {
        success: false,
        refundId: '',
        status: 'FAILED',
        refundAmount: 0,
        currency: 'USD',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
