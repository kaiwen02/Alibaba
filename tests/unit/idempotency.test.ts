import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Test the in-memory lock implementation
describe('Idempotency', () => {
  // Simulate the lock map
  let locks: Map<string, { acquiredAt: Date; expiresAt: Date }>;

  beforeEach(() => {
    locks = new Map();
  });

  async function acquireLock(key: string, durationMs = 30000): Promise<boolean> {
    const now = new Date();
    const existing = locks.get(key);

    if (existing && existing.expiresAt > now) {
      return false;
    }

    locks.set(key, {
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + durationMs),
    });

    return true;
  }

  async function releaseLock(key: string): Promise<void> {
    locks.delete(key);
  }

  describe('Lock acquisition', () => {
    it('should acquire a new lock successfully', async () => {
      const result = await acquireLock('test-key');
      expect(result).toBe(true);
    });

    it('should fail to acquire an already-held lock', async () => {
      await acquireLock('test-key');
      const result = await acquireLock('test-key');
      expect(result).toBe(false);
    });

    it('should allow acquiring the same lock after release', async () => {
      await acquireLock('test-key');
      await releaseLock('test-key');
      const result = await acquireLock('test-key');
      expect(result).toBe(true);
    });

    it('should allow different keys to be acquired simultaneously', async () => {
      const result1 = await acquireLock('key-1');
      const result2 = await acquireLock('key-2');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should expire locks after duration', async () => {
      vi.useFakeTimers();
      
      await acquireLock('test-key', 1000);
      
      // Fast forward past expiry
      vi.advanceTimersByTime(1500);
      
      const result = await acquireLock('test-key', 1000);
      expect(result).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Duplicate request prevention', () => {
    it('should prevent double approval with idempotency lock', async () => {
      const recoveryId = 'recovery-123';
      const lockKey = `recovery:${recoveryId}:approve`;

      // First request acquires lock
      const first = await acquireLock(lockKey);
      expect(first).toBe(true);

      // Second request should fail (simulating double-click)
      const second = await acquireLock(lockKey);
      expect(second).toBe(false);

      // After release, new request should succeed
      await releaseLock(lockKey);
      const third = await acquireLock(lockKey);
      expect(third).toBe(true);
    });

    it('should handle concurrent approval attempts', async () => {
      const lockKey = 'recovery:test:approve';
      
      // Simulate two concurrent requests
      const [result1, result2] = await Promise.all([
        acquireLock(lockKey),
        acquireLock(lockKey),
      ]);

      // Only one should succeed
      expect(result1 || result2).toBe(true);
      expect(result1 && result2).toBe(false);
    });
  });

  describe('Webhook deduplication', () => {
    it('should detect duplicate webhook events', () => {
      const processedEvents = new Set<string>();
      
      const eventId = 'EVT-123';
      
      // First event
      const isDuplicate1 = processedEvents.has(eventId);
      expect(isDuplicate1).toBe(false);
      processedEvents.add(eventId);

      // Duplicate event
      const isDuplicate2 = processedEvents.has(eventId);
      expect(isDuplicate2).toBe(true);
    });

    it('should allow different event IDs', () => {
      const processedEvents = new Set<string>();
      
      processedEvents.add('EVT-123');
      
      expect(processedEvents.has('EVT-456')).toBe(false);
    });
  });
});
