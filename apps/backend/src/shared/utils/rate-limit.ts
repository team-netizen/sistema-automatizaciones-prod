type Bucket = {
  count: number;
  resetAt: number;
};

const BUCKETS = new Map<string, Bucket>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();
  const current = BUCKETS.get(key);

  if (!current || current.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterMs: 0 };
  }

  current.count += 1;
  BUCKETS.set(key, current);

  if (current.count > limit) {
    return {
      limited: true,
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  }

  return { limited: false, retryAfterMs: 0 };
}
