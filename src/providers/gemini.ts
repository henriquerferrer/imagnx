import type {
  EditInput,
  GenerateInput,
  ImageResult,
  Provider,
} from "./types";
import { ProviderError, RateLimited } from "../errors";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

export function createGeminiProvider(opts: GeminiProviderOptions): Provider {
  const baseUrl = opts.baseUrl ?? BASE;

  async function call(
    modelId: string,
    parts: Array<Record<string, unknown>>,
    promptForResult: string,
  ): Promise<ImageResult[]> {
    const url = `${baseUrl}/models/${modelId}:generateContent?key=${opts.apiKey}`;
    const body = {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"] },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      throw new RateLimited("google");
    }
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError("google", msg);
    }
    const out: ImageResult[] = [];
    for (const cand of data.candidates ?? []) {
      for (const part of cand.content?.parts ?? []) {
        const inline = part.inlineData;
        if (!inline?.data) continue;
        const bytes = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
        out.push({
          bytes,
          mimeType: (inline.mimeType ?? "image/png") as ImageResult["mimeType"],
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
    models: ["gemini-2.5-flash-image"],
    async generate(modelId, input: GenerateInput) {
      return call(modelId, [{ text: input.prompt }], input.prompt);
    },
    async edit(modelId, input: EditInput) {
      const parts: Array<Record<string, unknown>> = [];
      for (const ref of input.refImages) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: btoa(String.fromCharCode(...ref)),
          },
        });
      }
      parts.push({ text: input.prompt });
      return call(modelId, parts, input.prompt);
    },
  };
}
