/**
 * Application Constants
 */

// Risk scoring weights
export const RISK_WEIGHTS = {
  WEATHER: 0.50,
  DISRUPTION: 0.30,
  DELAY: 0.15,
  HISTORY: 0.05,
} as const;

// Default risk threshold
export const RISK_THRESHOLD = 0.70;

// Package staleness threshold (15 minutes)
export const PACKAGE_STALE_THRESHOLD_MS = 15 * 60 * 1000;

// Polling configuration
export const POLLING = {
  MAX_ATTEMPTS: 5,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Atlas API endpoints
export const ATLAS_ENDPOINTS = {
  SEARCH: '/search.do',
  VERIFY: '/verify.do',
  ORDER: '/order.do',
  PAY: '/pay.do',
  QUERY: '/queryOrderDetails.do',
  REFUND: '/refund.do',
} as const;

// Recovery status flow
export const RECOVERY_STATUS_FLOW = {
  PENDING: ['PACKAGES_READY'],
  PACKAGES_READY: ['APPROVED', 'FAILED'],
  APPROVED: ['EXECUTING', 'FAILED'],
  EXECUTING: ['TICKETED', 'FAILED'],
  TICKETED: [],
  FAILED: ['PENDING'], // Can retry
} as const;

// Severity levels for change types
export const CHANGE_TYPE_SEVERITY = {
  MINOR: 'LOW',
  MATERIAL: 'MEDIUM',
  CANCELLED: 'CRITICAL',
} as const;

// Demo scenarios
export const DEMO_SCENARIOS = {
  SUCCESS: 'success',
  STALE_SESSION: 'stale_session',
  PRICE_CHANGE: 'price_change',
  NO_INVENTORY: 'no_inventory',
  PAYMENT_FAIL: 'payment_fail',
} as const;
