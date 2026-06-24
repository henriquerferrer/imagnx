import { describe, it, expect } from "vitest";
import { runFanOut, type RunRequest } from "../../src/runner.js";
import type { Provider, ImageResult, GenerateInput, EditInput } from "../../src/providers/types.js";
import { ProviderError } from "../../src/errors.js";

function fakeProvider(id: string, models: string[], behavior: "ok" | "fail"): Provider {
  return {
    id,
    models,
    async generate(modelId: string, _input: GenerateInput): Promise<ImageResult[]> {
      if (behavior === "fail") throw new ProviderError(id, "boom");
      return [
        {
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: "image/png",
          modelId,
          promptUsed: _input.prompt,
        },
      ];
    },
    async edit(modelId: string, _input: EditInput): Promise<ImageResult[]> {
      if (behavior === "fail") throw new ProviderError(id, "edit boom");
      return [
        {
          bytes: new Uint8Array([4, 5, 6]),
          mimeType: "image/png",
          modelId,
          promptUsed: _input.prompt,
        },
      ];
    },
  };
}

const baseReq = (modelIds: string[]): RunRequest => ({
  kind: "generate",
  modelIds,
  input: { prompt: "test prompt" },
});

describe("runFanOut", () => {
  it("single model success returns one result", async () => {
    const p = fakeProvider("openai", ["m1"], "ok");
    const result = await runFanOut(baseReq(["m1"]), { openai: p } as Record<string, Provider>, () => "openai");
    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(0);
    expect(result.successes[0]!.modelId).toBe("m1");
  });

  it("multiple models run in parallel and aggregate", async () => {
    const p1 = fakeProvider("openai", ["m1"], "ok");
    const p2 = fakeProvider("google", ["m2"], "ok");
    const result = await runFanOut(
      baseReq(["m1", "m2"]),
      { openai: p1, google: p2 } as Record<string, Provider>,
      (m) => (m === "m1" ? "openai" : "google"),
    );
    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
  });

  it("partial failure surfaces both successes and failures", async () => {
    const p1 = fakeProvider("openai", ["m1"], "ok");
    const p2 = fakeProvider("google", ["m2"], "fail");
    const result = await runFanOut(
      baseReq(["m1", "m2"]),
      { openai: p1, google: p2 } as Record<string, Provider>,
      (m) => (m === "m1" ? "openai" : "google"),
    );
    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.modelId).toBe("m2");
  });

  it("all-fail surfaces all failures, no successes", async () => {
    const p = fakeProvider("openai", ["m1", "m2"], "fail");
    const result = await runFanOut(
      baseReq(["m1", "m2"]),
      { openai: p } as Record<string, Provider>,
      () => "openai",
    );
    expect(result.successes).toHaveLength(0);
    expect(result.failures).toHaveLength(2);
  });

  it("concurrency=1 serializes models on the same provider", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const slowProvider: Provider = {
      id: "openai",
      models: ["a", "b", "c"],
      async generate(modelId, input): Promise<ImageResult[]> {
        order.push(`start:${modelId}`);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        order.push(`end:${modelId}`);
        return [{
          bytes: new Uint8Array(),
          mimeType: "image/png",
          modelId,
          promptUsed: input.prompt,
        }];
      },
    };
    const result = await runFanOut(
      baseReq(["a", "b", "c"]),
      { openai: slowProvider },
      () => "openai",
      { concurrency: 1 },
    );
    expect(result.successes).toHaveLength(3);
    expect(maxInFlight).toBe(1);
  });

  it("concurrency limits are per-provider, not global", async () => {
    let inFlightOpenAI = 0;
    let inFlightGoogle = 0;
    let maxConcurrentTotal = 0;
    const makeProvider = (which: "openai" | "google"): Provider => ({
      id: which,
      models: [],
      async generate(modelId, input): Promise<ImageResult[]> {
        if (which === "openai") inFlightOpenAI++;
        else inFlightGoogle++;
        maxConcurrentTotal = Math.max(maxConcurrentTotal, inFlightOpenAI + inFlightGoogle);
        await new Promise((r) => setTimeout(r, 5));
        if (which === "openai") inFlightOpenAI--;
        else inFlightGoogle--;
        return [{
          bytes: new Uint8Array(),
          mimeType: "image/png",
          modelId,
          promptUsed: input.prompt,
        }];
      },
    });
    const openai = makeProvider("openai");
    const google = makeProvider("google");
    await runFanOut(
      baseReq(["o1", "o2", "g1", "g2"]),
      { openai, google },
      (m) => (m.startsWith("o") ? "openai" : "google"),
      { concurrency: 1 },
    );
    // Each provider runs serially, but they overlap across providers.
    expect(maxConcurrentTotal).toBeGreaterThanOrEqual(2);
  });

  it("onModelDone fires for both success and failure", async () => {
    const events: Array<[string, boolean]> = [];
    const ok = fakeProvider("openai", ["m1"], "ok");
    const fail = fakeProvider("google", ["m2"], "fail");
    await runFanOut(
      baseReq(["m1", "m2"]),
      { openai: ok, google: fail },
      (m) => (m === "m1" ? "openai" : "google"),
      { onModelDone: (id, success) => events.push([id, success]) },
    );
    const map = Object.fromEntries(events);
    expect(map.m1).toBe(true);
    expect(map.m2).toBe(false);
  });

  it("edit kind dispatches to provider.edit", async () => {
    const p = fakeProvider("openai", ["m1"], "ok");
    const result = await runFanOut(
      {
        kind: "edit",
        modelIds: ["m1"],
        input: { prompt: "edit me", refImages: [new Uint8Array([0])] },
      },
      { openai: p } as Record<string, Provider>,
      () => "openai",
    );
    expect(result.successes[0]!.bytes).toEqual(new Uint8Array([4, 5, 6]));
  });
});
