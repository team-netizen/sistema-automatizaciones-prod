type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
): { limited: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const next: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, next);
    return { limited: false, remaining: config.limit - 1, retryAfterMs: 0 };
  }

  current.count += 1;
  store.set(key, current);

  if (current.count > config.limit) {
    return {
      limited: true,
      remaining: 0,
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  }

  return {
    limited: false,
    remaining: Math.max(config.limit - current.count, 0),
    retryAfterMs: 0,
  };
}
