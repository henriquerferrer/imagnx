import type {
  EditInput,
  GenerateInput,
  ImageResult,
  Provider,
} from "./providers/types.js";
import { UnsupportedFeature } from "./errors.js";

export type RunRequest =
  | { kind: "generate"; modelIds: string[]; input: GenerateInput }
  | { kind: "edit"; modelIds: string[]; input: EditInput };

export interface RunOutcome {
  successes: ImageResult[];
  failures: { modelId: string; error: Error }[];
}

export interface RunFanOutOptions {
  // Max in-flight requests per provider. Undefined = no limit.
  concurrency?: number;
  onModelStart?: (modelId: string) => void;
  onModelDone?: (modelId: string, ok: boolean) => void;
}

export async function runFanOut(
  req: RunRequest,
  providers: Record<string, Provider>,
  providerForModel: (modelId: string) => string,
  opts: RunFanOutOptions = {},
): Promise<RunOutcome> {
  const limiters: Record<string, ReturnType<typeof createLimiter>> = {};
  const getLimiter = (providerId: string) => {
    if (!opts.concurrency) return undefined;
    return (limiters[providerId] ??= createLimiter(opts.concurrency));
  };

  const tasks = req.modelIds.map(async (modelId) => {
    const providerId = providerForModel(modelId);
    const provider = providers[providerId];
    if (!provider) {
      throw new Error(`No provider registered for "${providerId}"`);
    }
    const limiter = getLimiter(providerId);
    const run = async () => {
      opts.onModelStart?.(modelId);
      try {
        if (req.kind === "edit") {
          if (!provider.edit) throw new UnsupportedFeature(modelId, "edit");
          const r = await provider.edit(modelId, req.input);
          opts.onModelDone?.(modelId, true);
          return r;
        }
        const r = await provider.generate(modelId, req.input);
        opts.onModelDone?.(modelId, true);
        return r;
      } catch (e) {
        opts.onModelDone?.(modelId, false);
        throw e;
      }
    };
    return limiter ? limiter(run) : run();
  });

  const settled = await Promise.allSettled(tasks);
  const outcome: RunOutcome = { successes: [], failures: [] };
  settled.forEach((res, i) => {
    const modelId = req.modelIds[i]!;
    if (res.status === "fulfilled") {
      for (const r of res.value) outcome.successes.push(r);
    } else {
      outcome.failures.push({
        modelId,
        error: res.reason instanceof Error ? res.reason : new Error(String(res.reason)),
      });
    }
  });
  return outcome;
}

// Tiny FIFO semaphore. Releases by resolving a queued waiter — order is
// insertion-order, so models started later wait for earlier ones to drain.
function createLimiter(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];
  const acquire = (): Promise<void> => {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        active++;
        resolve();
      });
    });
  };
  const release = () => {
    active--;
    const next = queue.shift();
    if (next) next();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}
