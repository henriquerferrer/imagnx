export abstract class ImgenError extends Error {
  abstract readonly exitCode: number;
}

export class MissingApiKey extends ImgenError {
  readonly exitCode = 2;
  constructor(public readonly envVar: string) {
    super(`${envVar} is not set. Run \`imgen config\` to check provider keys.`);
  }
}

export class UnsupportedFeature extends ImgenError {
  readonly exitCode = 3;
  constructor(modelId: string, feature: string) {
    super(`Model "${modelId}" does not support ${feature}.`);
  }
}

export class InvalidArgs extends ImgenError {
  readonly exitCode = 4;
  constructor(detail: string) {
    super(`Invalid arguments: ${detail}`);
  }
}

export class RateLimited extends ImgenError {
  readonly exitCode = 5;
  constructor(public readonly provider: string, retryAfterMs?: number) {
    super(
      `Rate limited by ${provider}` +
        (retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ""),
    );
  }
}

export class ProviderError extends ImgenError {
  readonly exitCode = 6;
  constructor(public readonly provider: string, message: string) {
    super(`[${provider}] ${message}`);
  }
}

export class PartialFailure extends ImgenError {
  readonly exitCode = 7;
  constructor(
    public readonly successes: { modelId: string; path: string }[],
    public readonly failures: { modelId: string; error: Error }[],
  ) {
    super(
      `Partial failure: ${successes.length} succeeded, ${failures.length} failed`,
    );
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ImgenError) return err.exitCode;
  return 1;
}
