// Shared citty arg-set and helpers used by `generate`, `edit`, and the
// bare-prompt entry in cli.ts. Keeping these in one place lets us add a
// flag once and have every command pick it up.
import { InvalidArgs } from "../errors.js";
import type { ParamEntry, SharedGenerateOpts } from "../pipeline.js";

export const sharedArgs = {
  model: {
    type: "string" as const,
    alias: "m",
    description:
      "Model ID or comma-separated list for multi-model fan-out (defaults to config or gpt-image-1.5)",
  },
  size: {
    type: "string" as const,
    alias: "s",
    description: "Image size (auto, 1024x1024, etc.)",
  },
  quality: {
    type: "string" as const,
    alias: "q",
    description: "Image quality (low, medium, high, auto)",
  },
  style: {
    type: "string" as const,
    description:
      "Style preset (e.g. minimalism, pixel, neon) — applies a directive to the prompt",
  },
  "openai-api-key": {
    type: "string" as const,
    description:
      "OpenAI API key (one-shot; overrides IMAGNX_OPENAI_API_KEY and credentials.toml; not persisted)",
  },
  "gemini-api-key": {
    type: "string" as const,
    description:
      "Gemini API key (one-shot; overrides IMAGNX_GEMINI_API_KEY and credentials.toml; not persisted)",
  },
  n: {
    type: "string" as const,
    description: "Number of images to generate (positive integer)",
  },
  retries: {
    type: "string" as const,
    description:
      "Retry HTTP 429/5xx N times with exponential backoff + jitter (default 0)",
  },
  concurrency: {
    type: "string" as const,
    description:
      "Max in-flight requests per provider during multi-model fan-out (default unlimited)",
  },
  param: {
    type: "string" as const,
    description:
      "Repeatable extra provider param: key=value or provider:key=value. Passed verbatim into the request body.",
  },
  output: {
    type: "string" as const,
    alias: "o",
    description: "Output file or directory override",
  },
  open: {
    type: "boolean" as const,
    description: "Open results in default viewer after writing",
    default: false,
  },
  json: {
    type: "boolean" as const,
    description: "Stable JSON output: {results:[...],errors:[...]}",
    default: false,
  },
  "dry-run": {
    type: "boolean" as const,
    description: "Validate args + print what would run, no API call",
    default: false,
  },
  // Detection happens in pipeline.ts:isDebugEnabled (off process.argv) so
  // reportAndExit can read it from the top-level catch handler too. This
  // entry exists purely so citty surfaces --debug in --help.
  debug: {
    type: "boolean" as const,
    alias: "d",
    default: false,
    description: "Verbose error output (stack traces)",
  },
};

export function parseN(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || String(n) !== raw.trim()) {
    throw new InvalidArgs("--n must be a positive integer");
  }
  return n;
}

export function parseNonNegativeInt(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || String(n) !== raw.trim()) {
    throw new InvalidArgs(`${flag} must be a non-negative integer`);
  }
  return n;
}

export function parsePositiveInt(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || String(n) !== raw.trim()) {
    throw new InvalidArgs(`${flag} must be a positive integer`);
  }
  return n;
}

// citty represents --param both as a single string (if given once) and as an
// array (if given multiple times). Normalize and parse each `key=value` (or
// `provider:key=value`) into a typed structure.
export function parseParamFlags(raw: string | string[] | undefined): ParamEntry[] {
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(parseOneParam);
}

function parseOneParam(s: string): ParamEntry {
  const eq = s.indexOf("=");
  if (eq < 0) {
    throw new InvalidArgs(`--param "${s}" is missing '='. Use key=value or provider:key=value`);
  }
  const lhs = s.slice(0, eq);
  const value = s.slice(eq + 1);
  const colon = lhs.indexOf(":");
  if (colon < 0) return { key: lhs, value };
  const provider = lhs.slice(0, colon);
  if (provider !== "openai" && provider !== "google") {
    throw new InvalidArgs(`--param provider scope must be 'openai' or 'google' (got "${provider}")`);
  }
  return { provider, key: lhs.slice(colon + 1), value };
}

// Build a SharedGenerateOpts from a citty args object. Used by both the
// `generate` subcommand and the bare-prompt entry point in cli.ts so the
// two stay in lockstep when flags are added.
export function sharedOptsFromArgs(args: {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  n?: string;
  output?: string;
  open?: boolean;
  json?: boolean;
  "dry-run"?: boolean;
  style?: string;
  "openai-api-key"?: string;
  "gemini-api-key"?: string;
  retries?: string;
  concurrency?: string;
  param?: string | string[];
}): SharedGenerateOpts {
  return {
    prompt: args.prompt,
    model: args.model,
    size: args.size,
    quality: args.quality,
    n: parseN(args.n),
    output: args.output,
    open: args.open,
    json: args.json,
    dryRun: args["dry-run"],
    style: args.style,
    openaiApiKey: args["openai-api-key"],
    geminiApiKey: args["gemini-api-key"],
    retries: parseNonNegativeInt(args.retries, "--retries"),
    concurrency: parsePositiveInt(args.concurrency, "--concurrency"),
    params: parseParamFlags(args.param),
  };
}
