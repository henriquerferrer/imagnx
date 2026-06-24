import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAIProvider } from "../../src/providers/openai.js";
import { installFetchMock } from "../helpers/fetch-mock.js";
import { ProviderError } from "../../src/errors.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIX = (name: string) =>
  readFileSync(join(HERE, "fixtures", name), "utf8");

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
    // FormData body assertion: verify model+prompt landed in the multipart form.
    const form = mock.calls[0]!.init!.body as FormData;
    expect(form.get("model")).toBe("gpt-image-1.5");
    expect(form.get("prompt")).toBe("make it orange");
    expect(form.get("image")).toBeInstanceOf(Blob);
  });

  it("response decoder fails fast when 'data' items lack b64_json", async () => {
    // Lock-in for the response-shape contract: if OpenAI ever renames
    // b64_json or returns a URL instead, this should break CI loudly.
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ data: [{ url: "https://example.com/x.png" }] }),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    await expect(
      provider.generate("gpt-image-1.5", { prompt: "x" }),
    ).rejects.toThrow(/No images/);
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

  it("maps 5xx to ProviderError with status in message (retries=0)", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: "<html><body>Service Unavailable</body></html>",
        responseStatus: 503,
        responseHeaders: { "content-type": "text/html" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    let caught: unknown;
    try {
      await provider.generate("gpt-image-1.5", { prompt: "x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).message).toMatch(/503/);
  });

  it("retries on 5xx and succeeds when retries are enabled", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: "",
        responseStatus: 503,
        responseHeaders: { "content-type": "text/plain" },
      },
      {
        url: "",
        responseBody: FIX("openai-generate.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({
      apiKey: "sk-test",
      retries: 1,
      sleep: async () => {},
    });
    const r = await provider.generate("gpt-image-1.5", { prompt: "x" });
    expect(r).toHaveLength(1);
    expect(mock.calls).toHaveLength(2);
  });

  it("retries on 429 honoring retry-after header", async () => {
    const sleeps: number[] = [];
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ error: { message: "slow down" } }),
        responseStatus: 429,
        responseHeaders: { "content-type": "application/json", "retry-after": "2" },
      },
      {
        url: "",
        responseBody: FIX("openai-generate.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({
      apiKey: "sk-test",
      retries: 1,
      sleep: async (ms: number) => { sleeps.push(ms); },
    });
    const r = await provider.generate("gpt-image-1.5", { prompt: "x" });
    expect(r).toHaveLength(1);
    expect(sleeps).toEqual([2000]);
  });

  it("forwards extraParams into the generate request body", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: FIX("openai-generate.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({
      apiKey: "sk-test",
      extraParams: { response_format: "b64_json", user: "ferrer" },
    });
    await provider.generate("gpt-image-1.5", { prompt: "x" });
    const body = JSON.parse(String(mock.calls[0]!.init!.body)) as Record<string, unknown>;
    expect(body.response_format).toBe("b64_json");
    expect(body.user).toBe("ferrer");
  });

  it("maps malformed JSON response to ProviderError with missing 'data' message", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ oops: true }),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createOpenAIProvider({ apiKey: "sk-test" });
    let caught: unknown;
    try {
      await provider.generate("gpt-image-1.5", { prompt: "x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).message).toMatch(/missing.*data/i);
  });
});
