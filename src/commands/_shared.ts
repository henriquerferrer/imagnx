// Shared citty arg-set and helpers used by `generate`, `edit`, and the
// bare-prompt entry in cli.ts. Keeping these in one place lets us add a
// flag once and have every command pick it up.
import { InvalidArgs } from "../errors.js";
import type { SharedGenerateOpts } from "../pipeline.js";

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
  n: {
    type: "string" as const,
    description: "Number of images to generate (positive integer)",
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
  };
}
