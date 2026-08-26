import type { RequestHandler } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createMcpRateLimit(
  limitPerMinute: number,
  now: () => number = Date.now
): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();
  const windowMs = 60_000;

  return (request, response, next) => {
    const timestamp = now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const current = entries.get(key);
    const entry =
      !current || current.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + windowMs }
        : current;

    entry.count += 1;
    entries.set(key, entry);

    if (entries.size > 1_000) {
      entries.forEach((value, candidate) => {
        if (value.resetAt <= timestamp) entries.delete(candidate);
      });
    }

    response.setHeader("X-RateLimit-Limit", String(limitPerMinute));
    response.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, limitPerMinute - entry.count))
    );
    response.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(entry.resetAt / 1_000))
    );

    if (entry.count > limitPerMinute) {
      response.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1_000)))
      );
      response.status(429).json({
        error: "rate_limit_exceeded",
        error_description: "Too many MCP requests",
      });
      return;
    }

    next();
  };
}
