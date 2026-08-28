/**
 * Distributed Lock Utility
 * 
 * In production, this would use Redis or a distributed lock service.
 * For demo/MVP, we use in-memory locks (single instance only).
 */

const locks = new Map<string, { acquiredAt: Date; expiresAt: Date }>();

const DEFAULT_LOCK_DURATION_MS = 30000; // 30 seconds

/**
 * Acquire a lock for a given key
 * Returns true if lock acquired, false if already locked
 */
export async function acquireLock(
  key: string,
  durationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<boolean> {
  const now = new Date();
  const existing = locks.get(key);

  // Check if existing lock is still valid
  if (existing && existing.expiresAt > now) {
    return false;
  }

  // Acquire lock
  locks.set(key, {
    acquiredAt: now,
    expiresAt: new Date(now.getTime() + durationMs),
  });

  return true;
}

/**
 * Release a lock
 */
export async function releaseLock(key: string): Promise<void> {
  locks.delete(key);
}

/**
 * Check if a lock is held
 */
export function isLocked(key: string): boolean {
  const lock = locks.get(key);
  if (!lock) return false;
  return lock.expiresAt > new Date();
}

/**
 * Clear all expired locks (cleanup)
 */
export function cleanupExpiredLocks(): void {
  const now = new Date();
  locks.forEach((lock, key) => {
    if (lock.expiresAt <= now) {
      locks.delete(key);
    }
  });
}
