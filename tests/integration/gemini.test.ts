import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeminiProvider } from "../../src/providers/gemini.js";
import { installFetchMock } from "../helpers/fetch-mock.js";
import { ProviderError } from "../../src/errors.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIX = (name: string) =>
  readFileSync(join(HERE, "fixtures", name), "utf8");

describe("gemini provider", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("generate posts to generateContent endpoint with API key in header", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: FIX("gemini-generate.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    const results = await provider.generate("gemini-2.5-flash-image", {
      prompt: "a fox",
    });
    expect(mock.calls[0]!.url).toContain("generateContent");
    expect(mock.calls[0]!.url).not.toContain("key=");
    const init = mock.calls[0]!.init!;
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("g-test");
    expect(results).toHaveLength(1);
    expect(results[0]!.mimeType).toBe("image/png");
    expect(results[0]!.bytes.length).toBeGreaterThan(0);
  });

  it("edit includes inlineData parts for each ref image", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: FIX("gemini-edit.json"),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    const results = await provider.edit!("gemini-2.5-flash-image", {
      prompt: "swap the background to a beach",
      refImages: [new Uint8Array([137, 80, 78, 71])],
    });
    expect(results).toHaveLength(1);
    const body = JSON.parse(String(mock.calls[0]!.init!.body)) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    const parts = body.contents[0]!.parts;
    const hasImage = parts.some((p) => "inlineData" in p);
    const hasText = parts.some((p) => "text" in p);
    expect(hasImage).toBe(true);
    expect(hasText).toBe(true);
  });

  it("maps non-200 to ProviderError", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ error: { message: "bad" } }),
        responseStatus: 400,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    await expect(
      provider.generate("gemini-2.5-flash-image", { prompt: "x" }),
    ).rejects.toThrow();
  });

  it("maps HTML response (503) to ProviderError with useful message", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: "<html><body>Service Unavailable</body></html>",
        responseStatus: 503,
        responseHeaders: { "content-type": "text/html" },
      },
    ]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    let caught: unknown;
    try {
      await provider.generate("gemini-2.5-flash-image", { prompt: "x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).message).toMatch(/invalid json/i);
  });

  it("maps malformed JSON response to ProviderError with missing 'candidates' message", async () => {
    const mock = installFetchMock([
      {
        url: "",
        responseBody: JSON.stringify({ oops: true }),
        responseStatus: 200,
        responseHeaders: { "content-type": "application/json" },
      },
    ]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    let caught: unknown;
    try {
      await provider.generate("gemini-2.5-flash-image", { prompt: "x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).message).toMatch(/missing/i);
  });
});

describe("gemini-3-pro-image-preview", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  const baseFixture = {
    url: "",
    responseBody: JSON.stringify({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } }],
        },
      }],
    }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
  };

  it("calls the pro model endpoint and forwards the quality tier as imageSize=2K", async () => {
    const mock = installFetchMock([baseFixture]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    await provider.generate("gemini-3-pro-image-preview", {
      prompt: "icon test",
      quality: "2k",
    });
    expect(mock.calls[0]!.url).toContain("/models/gemini-3-pro-image-preview:generateContent");
    const body = JSON.parse(String(mock.calls[0]!.init!.body)) as {
      generationConfig: { imageConfig?: { imageSize?: string } };
    };
    expect(body.generationConfig.imageConfig?.imageSize).toBe("2K");
  });

  it("defaults to 1K when no quality given", async () => {
    const mock = installFetchMock([baseFixture]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    await provider.generate("gemini-3-pro-image-preview", { prompt: "icon test" });
    const body = JSON.parse(String(mock.calls[0]!.init!.body)) as {
      generationConfig: { imageConfig?: { imageSize?: string } };
    };
    expect(body.generationConfig.imageConfig?.imageSize).toBe("1K");
  });

  it("does not add imageConfig when calling gemini-2.5-flash-image", async () => {
    const mock = installFetchMock([baseFixture]);
    restore = mock.restore;
    const provider = createGeminiProvider({ apiKey: "g-test" });
    await provider.generate("gemini-2.5-flash-image", { prompt: "x", quality: "auto" });
    const body = JSON.parse(String(mock.calls[0]!.init!.body)) as {
      generationConfig: { imageConfig?: unknown };
    };
    expect(body.generationConfig.imageConfig).toBeUndefined();
  });
});
