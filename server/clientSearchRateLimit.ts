export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
}

export interface FixedWindowRateLimiter {
  consume(key: number, now?: number): RateLimitDecision;
  clear(): void;
}

export function createFixedWindowRateLimiter(options: {
  limit: number;
  windowMs: number;
}): FixedWindowRateLimiter {
  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new TypeError("Rate limit must be a positive integer.");
  }
  if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
    throw new TypeError("Rate-limit window must be positive.");
  }

  const windows = new Map<number, { count: number; resetAt: number }>();
  let operations = 0;

  const cleanupExpired = (now: number) => {
    windows.forEach((window, key) => {
      if (window.resetAt <= now) windows.delete(key);
    });
  };

  return {
    consume(key, now = Date.now()) {
      operations += 1;
      if (operations % 256 === 0) cleanupExpired(now);

      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + options.windowMs });
        return { allowed: true, retryAfterMs: 0 };
      }

      if (current.count >= options.limit) {
        return {
          allowed: false,
          retryAfterMs: Math.max(1, current.resetAt - now),
        };
      }

      current.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    },
    clear() {
      windows.clear();
      operations = 0;
    },
  };
}
