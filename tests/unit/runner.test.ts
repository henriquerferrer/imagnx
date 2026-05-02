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
