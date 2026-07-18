/**
 * BONUS A - Rate limiting, built without an external library.
 *
 * Fixed-window counter per IP: for each IP we track a request count and a
 * window start time. When a new request arrives, if we're still inside the
 * current 15-minute window we increment; if the window has elapsed, we
 * reset it. This is O(1) per request and needs no dependency.
 *
 * A sliding-window-log would be more precise (no burst-at-boundary edge
 * case) but costs more memory per IP; fixed-window is the documented,
 * intentional tradeoff for a hackathon-scale in-memory store.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

const store = new Map(); // ip -> { count, windowStart }

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = store.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    store.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      },
    });
  }

  next();
}

// Periodic cleanup so the Map doesn't grow unbounded over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) store.delete(ip);
  }
}, WINDOW_MS).unref();

module.exports = rateLimiter;
