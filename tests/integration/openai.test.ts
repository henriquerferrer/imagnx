import { describe, it, expect, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createOpenAIProvider } from "../../src/providers/openai";
import { installFetchMock } from "../helpers/fetch-mock";

const FIX = (name: string) =>
  readFileSync(join(import.meta.dir, "fixtures", name), "utf8");

describe("openai provider", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("generate posts to /v1/images/generations and decodes base64", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: FIX("openai-generate.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    const results = await provider.generate("gpt-image-1.5", {
      prompt: "a cat",
      size: "1024x1024",
      quality: "high",
    });
    expect(mock.calls[0]!.url).toContain("/v1/images/generations");
    expect(results).toHaveLength(1);
    expect(results[0]!.modelId).toBe("gpt-image-1.5");
    expect(results[0]!.mimeType).toBe("image/png");
    expect(results[0]!.bytes.length).toBeGreaterThan(0);
  });

  it("generate sends Authorization header with bearer token", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: FIX("openai-generate.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    await provider.generate("gpt-image-1.5", { prompt: "x" });
    const init = mock.calls[0]!.init!;
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test");
  });

  it("edit posts multipart with reference image", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: FIX("openai-edit.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    const results = await provider.edit!("gpt-image-1.5", {
      prompt: "make it orange",
      refImages: [new Uint8Array([137, 80, 78, 71])],
    });
    expect(mock.calls[0]!.url).toContain("/v1/images/edits");
    expect(results).toHaveLength(1);
  });

  it("maps 401 to ProviderError", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ error: { message: "Invalid auth" } }),
        responseStatus: 401,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    await expect(
      provider.generate("gpt-image-1.5", { prompt: "x" }),
    ).rejects.toThrow();
  });

  it("maps 429 to RateLimited", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ error: { message: "rate limited" } }),
        responseStatus: 429,
        responseHeaders: {
          "content-type": "application/json",
          "retry-after": "1",
        },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    await expect(
      provider.generate("gpt-image-1.5", { prompt: "x" }),
    ).rejects.toThrow(/rate/i);
  });
});
