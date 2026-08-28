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
} from './types';

/**
 * Atlas Adapter Interface
 * 
 * This is the single interface that the application uses to communicate
 * with Atlas. It supports three modes:
 * - demo: Deterministic mock responses for testing scenarios
 * - sandbox: Real Atlas sandbox API calls
 * - production: Real Atlas production API calls
 */
export interface AtlasAdapter {
  /** Search for available flights */
  search(params: SearchParams): Promise<SearchResult>;
  
  /** Verify price and create session */
  verify(routingIdentifier: string): Promise<VerifyResult>;
  
  /** Create a booking order */
  order(params: OrderParams): Promise<OrderResult>;
  
  /** Process payment for an order */
  pay(orderId: string, params: PayParams): Promise<PayResult>;
  
  /** Query order details (polling) */
  queryOrderDetails(orderId: string): Promise<QueryResult>;
  
  /** Initiate refund for an order */
  refund(orderId: string): Promise<RefundResult>;
  
  /** Set the demo scenario (demo mode only) */
  setScenario?(scenario: DemoScenario): void;
  
  /** Get current mode */
  getMode(): 'demo' | 'sandbox' | 'production';
}

/**
 * Factory function to create the appropriate Atlas adapter
 */
export function createAtlasAdapter(): AtlasAdapter {
  const mode = process.env.ATLAS_MODE || 'demo';
  
  if (mode === 'demo') {
    return new DemoAtlasAdapter();
  }
  
  return new SandboxAtlasAdapter();
}

// Re-export for use in other modules
import { DemoAtlasAdapter } from './demo';
import { SandboxAtlasAdapter } from './client';

export { DemoAtlasAdapter, SandboxAtlasAdapter };
