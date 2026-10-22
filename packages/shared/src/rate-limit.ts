export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  hit: (key: string, windowMs: number) => Bucket;
};

export function createMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  return {
    hit(key, windowMs) {
      const now = Date.now();
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        const next = { count: 1, resetAt: now + windowMs };
        buckets.set(key, next);
        return next;
      }
      current.count += 1;
      return current;
    },
  };
}

export function consumeRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const safeLimit = Math.max(1, Math.floor(limit));
  const bucket = store.hit(key, windowMs);
  const remaining = Math.max(0, safeLimit - bucket.count);
  return {
    allowed: bucket.count <= safeLimit,
    remaining,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
    resetAt: bucket.resetAt,
  };
}

export function clientAddress(request: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }
  }
  return "local";
}
