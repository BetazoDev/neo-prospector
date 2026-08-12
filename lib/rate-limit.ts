interface RateLimitRecord {
  timestamps: number[]
}

const cache = new Map<string, RateLimitRecord>()

/**
 * In-memory sliding window rate limiter
 * @param key Unique key e.g. "login:192.168.1.1"
 * @param limit Maximum allowed requests in window
 * @param windowMs Time window in milliseconds (default 60000ms = 1 min)
 */
export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60000
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const windowStart = now - windowMs

  let record = cache.get(key)
  if (!record) {
    record = { timestamps: [] }
    cache.set(key, record)
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart)

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0]
    const resetMs = oldest + windowMs - now
    return {
      success: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs),
    }
  }

  record.timestamps.push(now)
  return {
    success: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  }
}
