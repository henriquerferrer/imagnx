import { Buffer } from "node:buffer";
import type {
  EditInput,
  GenerateInput,
  ImageResult,
  Provider,
} from "./types.js";
import { ProviderError, RateLimited } from "../errors.js";
import { getProp } from "../narrow.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

const PRO_MODEL = "gemini-3-pro-image-preview";

function isPro(modelId: string): boolean {
  return modelId === PRO_MODEL;
}

// SnapAI's wire format (src/services/gemini.ts): generationConfig.imageConfig.imageSize
// expects uppercase tier strings. Default to "1K" when no quality given.
function imageConfigFor(modelId: string, quality?: string): Record<string, unknown> | undefined {
  if (!isPro(modelId)) return undefined;
  const tier = quality && ["1k", "2k", "4k"].includes(quality) ? quality : "1k";
  return { imageConfig: { imageSize: tier.toUpperCase() } };
}

export function createGeminiProvider(opts: GeminiProviderOptions): Provider {
  const baseUrl = opts.baseUrl ?? BASE;

  async function call(
    modelId: string,
    parts: Array<Record<string, unknown>>,
    promptForResult: string,
    extraConfig?: Record<string, unknown>,
  ): Promise<ImageResult[]> {
    const url = `${baseUrl}/models/${modelId}:generateContent`;
    const generationConfig = {
      responseModalities: ["IMAGE"],
      ...(extraConfig ?? {}),
    };
    const body = {
      contents: [{ parts }],
      generationConfig,
    };

    const timeoutMs = Number(process.env.IMAGNX_REQUEST_TIMEOUT_MS) || 120_000;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": opts.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new ProviderError("google", `Request timed out after ${timeoutMs / 1000}s`);
      }
      throw e;
    }

    if (res.status === 429) {
      throw new RateLimited("google");
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch (e) {
      throw new ProviderError(
        "google",
        `Invalid JSON response (HTTP ${res.status}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (!res.ok) {
      const errMsg = getProp(getProp(data, "error"), "message");
      const msg = typeof errMsg === "string" ? errMsg : `HTTP ${res.status}`;
      throw new ProviderError("google", msg);
    }

    const candidates = getProp(data, "candidates");
    if (!Array.isArray(candidates)) {
      throw new ProviderError("google", "Malformed response: missing 'candidates' array");
    }

    const out: ImageResult[] = [];
    for (const cand of candidates) {
      const content = getProp(cand, "content");
      const parts = getProp(content, "parts");
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        const inline = getProp(part, "inlineData");
        const inlineData = getProp(inline, "data");
        if (typeof inlineData !== "string") continue;
        const mimeType = getProp(inline, "mimeType");
        const bytes = Uint8Array.from(atob(inlineData), (c) => c.charCodeAt(0));
        out.push({
          bytes,
          mimeType: (typeof mimeType === "string" ? mimeType : "image/png") as ImageResult["mimeType"],
          modelId,
          promptUsed: promptForResult,
        });
      }
    }

    if (out.length === 0) {
      throw new ProviderError("google", "Empty response: no images returned");
    }
    return out;
  }

  return {
    id: "google",
    models: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
    async generate(modelId, input: GenerateInput) {
      return call(
        modelId,
        [{ text: input.prompt }],
        input.prompt,
        imageConfigFor(modelId, input.quality),
      );
    },
    async edit(modelId, input: EditInput) {
      const parts: Array<Record<string, unknown>> = [];
      for (const ref of input.refImages) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: Buffer.from(ref).toString("base64"),
          },
        });
      }
      parts.push({ text: input.prompt });
      return call(modelId, parts, input.prompt, imageConfigFor(modelId, input.quality));
    },
  };
}
