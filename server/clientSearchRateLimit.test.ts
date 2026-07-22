import { describe, expect, it } from "vitest";
import { createFixedWindowRateLimiter } from "./clientSearchRateLimit";

describe("createFixedWindowRateLimiter", () => {
  it("allows requests until the configured user limit", () => {
    const limiter = createFixedWindowRateLimiter({
      limit: 2,
      windowMs: 1_000,
    });

    expect(limiter.consume(7, 100)).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
    expect(limiter.consume(7, 200)).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
    expect(limiter.consume(7, 300)).toEqual({
      allowed: false,
      retryAfterMs: 800,
    });
  });

  it("keeps counters isolated by authenticated user", () => {
    const limiter = createFixedWindowRateLimiter({
      limit: 1,
      windowMs: 1_000,
    });

    expect(limiter.consume(7, 100).allowed).toBe(true);
    expect(limiter.consume(8, 100).allowed).toBe(true);
    expect(limiter.consume(7, 200).allowed).toBe(false);
  });

  it("starts a fresh window after expiration", () => {
    const limiter = createFixedWindowRateLimiter({
      limit: 1,
      windowMs: 1_000,
    });

    expect(limiter.consume(7, 100).allowed).toBe(true);
    expect(limiter.consume(7, 1_099).allowed).toBe(false);
    expect(limiter.consume(7, 1_100).allowed).toBe(true);
  });

  it("rejects invalid limiter configuration", () => {
    expect(() =>
      createFixedWindowRateLimiter({ limit: 0, windowMs: 1_000 })
    ).toThrow(TypeError);
    expect(() =>
      createFixedWindowRateLimiter({ limit: 1, windowMs: 0 })
    ).toThrow(TypeError);
  });
});
