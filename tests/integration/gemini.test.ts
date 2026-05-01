import { describe, it, expect, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGeminiProvider } from "../../src/providers/gemini";
import { installFetchMock } from "../helpers/fetch-mock";

const FIX = (name: string) =>
  readFileSync(join(import.meta.dir, "fixtures", name), "utf8");

describe("gemini provider", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("generate posts to generateContent endpoint with API key", async () => {
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
    expect(mock.calls[0]!.url).toContain("key=g-test");
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
    const body = JSON.parse(String(mock.calls[0]!.init!.body));
    const parts = body.contents[0].parts;
    const hasImage = parts.some((p: any) => p.inlineData);
    const hasText = parts.some((p: any) => p.text);
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
});
