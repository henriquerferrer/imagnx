import type {
  EditInput,
  GenerateInput,
  ImageResult,
  Provider,
} from "./types.js";
import { ProviderError, RateLimited } from "../errors.js";
import { getProp } from "../narrow.js";
import { RetryableError, withRetry, type RetryOptions } from "../retry.js";

const BASE = "https://api.openai.com";

export interface OpenAIProviderOptions {
  apiKey: string;
  baseUrl?: string;
  retries?: number;
  extraParams?: Record<string, unknown>;
  // Test seam: deterministic sleep
  sleep?: (ms: number) => Promise<void>;
}

// Internal signal: a retryable 429 with optional retry-after hint. Survives
// withRetry's final re-throw and is converted to user-facing RateLimited at
// the public boundary in `wrap`.
class RetryableRateLimit extends RetryableError {
  constructor(retryAfterMs?: number) {
    super(`rate limited by openai`, retryAfterMs);
  }
}

export function createOpenAIProvider(opts: OpenAIProviderOptions): Provider {
  const baseUrl = opts.baseUrl ?? BASE;
  const retryOpts: RetryOptions = { retries: opts.retries ?? 0, sleep: opts.sleep };
  const extra = opts.extraParams;

  function wrap<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(fn, retryOpts).catch((e) => {
      if (e instanceof RetryableRateLimit) {
        throw new RateLimited("openai", e.retryAfterMs);
      }
      if (e instanceof RetryableError) {
        throw new ProviderError("openai", e.message);
      }
      throw e;
    });
  }

  async function callJson(modelId: string, input: GenerateInput): Promise<ImageResult[]> {
    const body: Record<string, unknown> = {
      model: modelId,
      prompt: input.prompt,
      n: input.n ?? 1,
    };
    if (input.size) body.size = input.size;
    if (input.quality) body.quality = input.quality;
    if (extra) Object.assign(body, extra);

    return wrap(() =>
      fetchAndParse({
        url: `${baseUrl}/v1/images/generations`,
        init: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        modelId,
        prompt: input.prompt,
      }),
    );
  }

  async function callEdit(modelId: string, input: EditInput): Promise<ImageResult[]> {
    return wrap(() => {
      // Rebuild FormData per attempt — its Blob streams can't be replayed.
      const form = new FormData();
      form.set("model", modelId);
      form.set("prompt", input.prompt);
      form.set("n", String(input.n ?? 1));
      if (input.size) form.set("size", input.size);
      if (input.quality) form.set("quality", input.quality);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          form.set(k, typeof v === "string" ? v : JSON.stringify(v));
        }
      }
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
      return fetchAndParse({
        url: `${baseUrl}/v1/images/edits`,
        init: {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.apiKey}` },
          body: form,
        },
        modelId,
        prompt: input.prompt,
      });
    });
  }

  return {
    id: "openai",
    models: ["gpt-image-1.5", "gpt-image-2"],
    generate: callJson,
    edit: callEdit,
  };
}

interface FetchAndParseArgs {
  url: string;
  init: RequestInit;
  modelId: string;
  prompt: string;
}

async function fetchAndParse(args: FetchAndParseArgs): Promise<ImageResult[]> {
  const timeoutMs = Number(process.env.IMAGNX_REQUEST_TIMEOUT_MS) || 120_000;
  let res: Response;
  try {
    res = await fetch(args.url, {
      ...args.init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new ProviderError("openai", `Request timed out after ${timeoutMs / 1000}s`);
    }
    throw e;
  }
  return parseImagesResponse(res, args.modelId, args.prompt);
}

async function parseImagesResponse(
  res: Response,
  modelId: string,
  prompt: string,
): Promise<ImageResult[]> {
  if (res.status === 429) {
    const ra = res.headers.get("retry-after");
    throw new RetryableRateLimit(ra ? Number(ra) * 1000 : undefined);
  }
  if (res.status >= 500 && res.status < 600) {
    throw new RetryableError(`HTTP ${res.status}`);
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
