import type {
  EditInput,
  GenerateInput,
  ImageResult,
  Provider,
} from "./providers/types";
import { UnsupportedFeature } from "./errors";

export type RunRequest =
  | { kind: "generate"; modelIds: string[]; input: GenerateInput }
  | { kind: "edit"; modelIds: string[]; input: EditInput };

export interface RunOutcome {
  successes: ImageResult[];
  failures: { modelId: string; error: Error }[];
}

export async function runFanOut(
  req: RunRequest,
  providers: Record<string, Provider>,
  providerForModel: (modelId: string) => string,
): Promise<RunOutcome> {
  const tasks = req.modelIds.map(async (modelId) => {
    const providerId = providerForModel(modelId);
    const provider = providers[providerId];
    if (!provider) {
      throw new Error(`No provider registered for "${providerId}"`);
    }
    if (req.kind === "edit") {
      if (!provider.edit) throw new UnsupportedFeature(modelId, "edit");
      return provider.edit(modelId, req.input);
    }
    return provider.generate(modelId, req.input);
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
