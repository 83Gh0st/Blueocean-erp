// Same minimal in-memory, fixed-window rate limiter as the marketing
// site's internal portal — see that file's comment for the honest
// limitation (resets on cold start, not shared across instances/regions).
// Worth having here regardless: this app's login guards access to
// financial records, so it deserves at least as much protection as the
// marketing site's staff-directory placeholder had.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 500) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false as const };
  }

  if (bucket.count >= max) {
    return { limited: true as const, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { limited: false as const };
}

export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
