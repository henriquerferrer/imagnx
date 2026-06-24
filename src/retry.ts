// Generic retry-with-backoff for provider HTTP calls. Lives outside the
// provider modules so both can share the policy without growing identical
// loops. Default is 0 retries — opt-in via `--retries N` so existing
// behavior (fail fast) is preserved unless asked for.

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

// Caller signals "I want this retried, here's how long to wait if I know."
// Throwing a regular Error short-circuits the loop (non-retryable).
export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const base = opts.baseDelayMs ?? 500;
  const max = opts.maxDelayMs ?? 30_000;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!(e instanceof RetryableError) || attempt === opts.retries) throw e;
      const delay = e.retryAfterMs ?? backoffWithJitter(attempt, base, max);
      await sleep(delay);
    }
  }
  // Unreachable — loop always returns or throws.
  throw lastErr;
}

// Exponential backoff with full jitter: random uniform in [0, base * 2^attempt],
// capped at max. Full jitter spreads retries from coordinated clients better
// than equal jitter does for rate-limit recovery.
export function backoffWithJitter(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * Math.pow(2, attempt));
  return Math.floor(Math.random() * exp);
}
