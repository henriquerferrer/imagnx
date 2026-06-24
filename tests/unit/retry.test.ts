import { describe, it, expect } from "vitest";
import { withRetry, RetryableError, backoffWithJitter } from "../../src/retry.js";

describe("withRetry", () => {
  it("returns immediately on success (no retries)", async () => {
    let calls = 0;
    const result = await withRetry(async () => { calls++; return "ok"; }, { retries: 0 });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("rethrows non-retryable errors without retrying", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => { calls++; throw new Error("nope"); }, { retries: 3, sleep: async () => {} }),
    ).rejects.toThrow("nope");
    expect(calls).toBe(1);
  });

  it("retries RetryableError up to N times", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    await expect(
      withRetry(async () => { calls++; throw new RetryableError("flaky"); }, { retries: 3, sleep }),
    ).rejects.toThrow("flaky");
    expect(calls).toBe(4); // initial + 3 retries
    expect(sleeps).toHaveLength(3);
  });

  it("honors retryAfterMs from RetryableError instead of backoff", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    try {
      await withRetry(
        async () => {
          calls++;
          if (calls < 3) throw new RetryableError("rate", 1234);
          return "done";
        },
        { retries: 5, sleep },
      );
    } catch { /* irrelevant */ }
    expect(sleeps).toEqual([1234, 1234]);
  });

  it("succeeds on a later attempt", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new RetryableError("flaky");
        return "ok";
      },
      { retries: 5, sleep: async () => {} },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });
});

describe("backoffWithJitter", () => {
  it("never exceeds the cap", () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const v = backoffWithJitter(attempt, 500, 5000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5000);
    }
  });

  it("grows with the attempt index up to the cap", () => {
    // The MAXIMUM of the random window doubles each attempt — sample many to
    // observe the spread.
    let max0 = 0;
    let max3 = 0;
    for (let i = 0; i < 1000; i++) {
      max0 = Math.max(max0, backoffWithJitter(0, 500, 100_000));
      max3 = Math.max(max3, backoffWithJitter(3, 500, 100_000));
    }
    expect(max3).toBeGreaterThan(max0);
  });
});
