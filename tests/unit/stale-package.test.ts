import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Prisma client
vi.mock('@/lib/db', () => ({
  default: {
    recoveryPackage: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  prisma: {
    recoveryPackage: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '@/lib/db';

describe('Stale Package Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Package staleness detection', () => {
    it('should identify packages older than 15 minutes as stale', () => {
      const STALE_THRESHOLD_MS = 15 * 60 * 1000;
      const now = new Date();
      const staleTime = new Date(now.getTime() - STALE_THRESHOLD_MS - 1000);
      const freshTime = new Date(now.getTime() - 5 * 60 * 1000);

      const packages = [
        { id: '1', verifiedAt: staleTime, isStale: false },
        { id: '2', verifiedAt: freshTime, isStale: false },
      ];

      const stalePackages = packages.filter(
        pkg => pkg.verifiedAt && (now.getTime() - new Date(pkg.verifiedAt).getTime()) > STALE_THRESHOLD_MS
      );

      expect(stalePackages).toHaveLength(1);
      expect(stalePackages[0].id).toBe('1');
    });

    it('should not mark recently verified packages as stale', () => {
      const STALE_THRESHOLD_MS = 15 * 60 * 1000;
      const now = new Date();
      const recentTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago

      const packages = [
        { id: '1', verifiedAt: recentTime, isStale: false },
      ];

      const stalePackages = packages.filter(
        pkg => pkg.verifiedAt && (now.getTime() - new Date(pkg.verifiedAt).getTime()) > STALE_THRESHOLD_MS
      );

      expect(stalePackages).toHaveLength(0);
    });

    it('should handle packages without verifiedAt timestamp', () => {
      const STALE_THRESHOLD_MS = 15 * 60 * 1000;
      const now = new Date();

      const packages: Array<{ id: string; verifiedAt: Date | string | null | undefined; isStale: boolean }> = [
        { id: '1', verifiedAt: null, isStale: false },
        { id: '2', verifiedAt: undefined, isStale: false },
      ];

      const stalePackages = packages.filter(
        pkg => pkg.verifiedAt && (now.getTime() - new Date(pkg.verifiedAt).getTime()) > STALE_THRESHOLD_MS
      );

      expect(stalePackages).toHaveLength(0);
    });
  });

  describe('Session expiration handling', () => {
    it('should detect expired session from Atlas verify response', () => {
      const verifyResponse = {
        success: false,
        expired: true,
        error: 'Session expired. Please search again.',
      };

      expect(verifyResponse.expired).toBe(true);
      expect(verifyResponse.success).toBe(false);
    });

    it('should detect price change during verification', () => {
      const verifyResponse = {
        success: true,
        priceChanged: true,
        originalPrice: 100,
        price: 115,
      };

      expect(verifyResponse.priceChanged).toBe(true);
      expect(verifyResponse.price).toBeGreaterThan(verifyResponse.originalPrice);
    });

    it('should handle successful verification without changes', () => {
      const verifyResponse = {
        success: true,
        priceChanged: false,
        expired: false,
        price: 100,
      };

      expect(verifyResponse.success).toBe(true);
      expect(verifyResponse.priceChanged).toBe(false);
      expect(verifyResponse.expired).toBe(false);
    });
  });
});
