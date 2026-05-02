import type {
  EditInput,
  GenerateInput,
  ImageResult,
  Provider,
} from "./types.js";
import { ProviderError, RateLimited } from "../errors.js";
import { getProp } from "../narrow.js";

const BASE = "https://api.openai.com";

export interface OpenAIProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

export function createOpenAIProvider(opts: OpenAIProviderOptions): Provider {
  const baseUrl = opts.baseUrl ?? BASE;

  async function callJson(modelId: string, input: GenerateInput): Promise<ImageResult[]> {
    const body: Record<string, unknown> = {
      model: modelId,
      prompt: input.prompt,
      n: input.n ?? 1,
    };
    if (input.size) body.size = input.size;
    if (input.quality) body.quality = input.quality;
    body.response_format = "b64_json";

    const timeoutMs = Number(process.env.IMAGN_REQUEST_TIMEOUT_MS) || 120_000;
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new ProviderError("openai", `Request timed out after ${timeoutMs / 1000}s`);
      }
      throw e;
    }
    return parseImagesResponse(res, modelId, input.prompt);
  }

  async function callEdit(modelId: string, input: EditInput): Promise<ImageResult[]> {
    const form = new FormData();
    form.set("model", modelId);
    form.set("prompt", input.prompt);
    form.set("n", String(input.n ?? 1));
    if (input.size) form.set("size", input.size);
    if (input.quality) form.set("quality", input.quality);
    form.set("response_format", "b64_json");
    input.refImages.forEach((bytes, i) => {
      form.append(
        input.refImages.length > 1 ? "image[]" : "image",
        new Blob([bytes], { type: "image/png" }),
        `ref-${i}.png`,
      );
    });
    if (input.mask) {
      form.set("mask", new Blob([input.mask], { type: "image/png" }), "mask.png");
    }

    const timeoutMs = Number(process.env.IMAGN_REQUEST_TIMEOUT_MS) || 120_000;
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new ProviderError("openai", `Request timed out after ${timeoutMs / 1000}s`);
      }
      throw e;
    }
    return parseImagesResponse(res, modelId, input.prompt);
  }

  return {
    id: "openai",
    models: ["gpt-image-1.5", "gpt-image-2"],
    generate: callJson,
    edit: callEdit,
  };
}

async function parseImagesResponse(
  res: Response,
  modelId: string,
  prompt: string,
): Promise<ImageResult[]> {
  if (res.status === 429) {
    const ra = res.headers.get("retry-after");
    throw new RateLimited("openai", ra ? Number(ra) * 1000 : undefined);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (e) {
    throw new ProviderError(
      "openai",
      `Invalid JSON response (HTTP ${res.status}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!res.ok) {
    const errMsg = getProp(getProp(data, "error"), "message");
    const msg = typeof errMsg === "string" ? errMsg : `HTTP ${res.status}`;
    throw new ProviderError("openai", msg);
  }

  const dataArray = getProp(data, "data");
  if (!Array.isArray(dataArray)) {
    throw new ProviderError("openai", "Malformed response: missing 'data' array");
  }

  const items: ImageResult[] = [];
  for (const item of dataArray) {
    const b64 = getProp(item, "b64_json");
    if (typeof b64 !== "string") continue;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    items.push({
      bytes,
      mimeType: "image/png",
      modelId,
      promptUsed: prompt,
    });
  }

  if (items.length === 0) {
    throw new ProviderError("openai", "No images in response");
  }
  return items;
}
