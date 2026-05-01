#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { existsSync } from "node:fs";

import { exitCodeFor, InvalidArgs, PartialFailure } from "./errors";
import {
  KNOWN_MODELS,
  listModels,
  modelCapabilities,
  providerForModel,
  validateRequest,
} from "./registry";
import {
  apiKeyFor,
  loadConfigFile,
  resolveConfig,
} from "./config";
import {
  openInViewer,
  resolveOutputPath,
  writeImageBytes,
} from "./output";
import type { OutputContext } from "./output";
import { runFanOut } from "./runner";
import type { RunRequest } from "./runner";
import { formatJsonOutput } from "./json";
import type { SavedResult, SerializedFailure } from "./json";
import { createOpenAIProvider } from "./providers/openai";
import { createGeminiProvider } from "./providers/gemini";
import type { Provider } from "./providers/types";
import type { Quality, Size } from "./providers/types";

// ---------------------------------------------------------------------------
// Shared generate/edit options shape
// ---------------------------------------------------------------------------
interface SharedGenerateOpts {
  prompt: string;
  model?: string;
  compare?: boolean;
  size?: string;
  quality?: string;
  n?: number;
  output?: string;
  open?: boolean;
  json?: boolean;
  dryRun?: boolean;
}

interface EditOpts extends SharedGenerateOpts {
  refs: string[];
  mask?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mimeToExt(mime: string): "png" | "jpg" | "webp" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

// ---------------------------------------------------------------------------
// Core generate logic
// ---------------------------------------------------------------------------

async function runGenerate(opts: SharedGenerateOpts): Promise<void> {
  const env = process.env;
  const cfg = resolveConfig({ tomlText: loadConfigFile(env), env, flags: {} });

  // Determine model list
  let modelIds: string[];
  if (opts.compare) {
    modelIds = [...KNOWN_MODELS];
  } else if (opts.model) {
    modelIds = opts.model.split(",").map((m) => m.trim()).filter(Boolean);
  } else {
    modelIds = [cfg.defaultModel];
  }

  const size = (opts.size ?? cfg.defaultSize) as Size;
  const quality = (opts.quality ?? cfg.defaultQuality) as Quality;
  const n = opts.n ?? 1;

  // Validate every model
  for (const modelId of modelIds) {
    validateRequest(modelId, { kind: "generate", size });
  }

  // Build providers map (also validates keys)
  const neededProviders = new Set(modelIds.map((m) => providerForModel(m)));
  const providers: Record<string, Provider> = {};
  for (const pid of neededProviders) {
    const key = apiKeyFor(pid, env);
    if (pid === "openai") {
      providers[pid] = createOpenAIProvider({ apiKey: key });
    } else {
      providers[pid] = createGeminiProvider({ apiKey: key });
    }
  }

  if (opts.dryRun) {
    process.stdout.write(
      `[dry-run] kind=generate models=${modelIds.join(",")} prompt=${opts.prompt}\n`,
    );
    return;
  }

  const now = new Date();
  const req: RunRequest = {
    kind: "generate",
    modelIds,
    input: { prompt: opts.prompt, size, quality, n },
  };

  const outcome = await runFanOut(req, providers, providerForModel);

  const saved: SavedResult[] = [];
  const failures: SerializedFailure[] = [];
  const fanOut = modelIds.length > 1;

  for (const result of outcome.successes) {
    const ext = mimeToExt(result.mimeType);
    const outCtx: OutputContext = {
      outputDir: cfg.outputDir,
      now,
      prompt: opts.prompt,
      modelId: result.modelId,
      extension: ext,
      fanOut,
      explicitOutput: opts.output,
    };
    const path = resolveOutputPath(outCtx);
    await writeImageBytes(path, result.bytes);
    saved.push({ path, modelId: result.modelId, mimeType: result.mimeType, costEstimateUsd: result.costEstimateUsd });
    if (opts.open || cfg.openAfter) {
      await openInViewer(path);
    }
  }

  for (const f of outcome.failures) {
    failures.push({ modelId: f.modelId, message: f.error.message });
  }

  outputResults(saved, failures, outcome.failures, opts.json ?? false);
}

// ---------------------------------------------------------------------------
// Core edit logic
// ---------------------------------------------------------------------------

async function runEdit(opts: EditOpts): Promise<void> {
  const env = process.env;
  const cfg = resolveConfig({ tomlText: loadConfigFile(env), env, flags: {} });

  if (opts.refs.length === 0) {
    throw new InvalidArgs("edit requires at least one reference image path");
  }
  if (!opts.prompt) {
    throw new InvalidArgs("edit requires a prompt (last positional argument)");
  }

  // Validate ref paths exist
  for (const ref of opts.refs) {
    if (!existsSync(ref)) {
      throw new InvalidArgs(`Reference image not found: ${ref}`);
    }
  }

  // Read ref images
  const { readFile } = await import("node:fs/promises");
  const refImages: Uint8Array[] = await Promise.all(
    opts.refs.map(async (r) => new Uint8Array(await readFile(r))),
  );

  // Read mask if provided
  let mask: Uint8Array | undefined;
  if (opts.mask) {
    if (!existsSync(opts.mask)) {
      throw new InvalidArgs(`Mask image not found: ${opts.mask}`);
    }
    mask = new Uint8Array(await readFile(opts.mask));
  }

  // Determine model list
  let modelIds: string[];
  if (opts.compare) {
    modelIds = [...KNOWN_MODELS];
  } else if (opts.model) {
    modelIds = opts.model.split(",").map((m) => m.trim()).filter(Boolean);
  } else {
    modelIds = [cfg.defaultModel];
  }

  const size = (opts.size ?? cfg.defaultSize) as Size;
  const quality = (opts.quality ?? cfg.defaultQuality) as Quality;
  const n = opts.n ?? 1;

  // Validate every model for edit
  for (const modelId of modelIds) {
    validateRequest(modelId, {
      kind: "edit",
      refCount: refImages.length,
      size,
      hasMask: !!mask,
    });
  }

  // Build providers map
  const neededProviders = new Set(modelIds.map((m) => providerForModel(m)));
  const providers: Record<string, Provider> = {};
  for (const pid of neededProviders) {
    const key = apiKeyFor(pid, env);
    if (pid === "openai") {
      providers[pid] = createOpenAIProvider({ apiKey: key });
    } else {
      providers[pid] = createGeminiProvider({ apiKey: key });
    }
  }

  if (opts.dryRun) {
    process.stdout.write(
      `[dry-run] kind=edit models=${modelIds.join(",")} refs=${opts.refs.join(",")} prompt=${opts.prompt}\n`,
    );
    return;
  }

  const now = new Date();
  const req: RunRequest = {
    kind: "edit",
    modelIds,
    input: { prompt: opts.prompt, size, quality, n, refImages, mask },
  };

  const outcome = await runFanOut(req, providers, providerForModel);

  const saved: SavedResult[] = [];
  const failures: SerializedFailure[] = [];
  const fanOut = modelIds.length > 1;

  for (const result of outcome.successes) {
    const ext = mimeToExt(result.mimeType);
    const outCtx: OutputContext = {
      outputDir: cfg.outputDir,
      now,
      prompt: opts.prompt,
      modelId: result.modelId,
      extension: ext,
      fanOut,
      explicitOutput: opts.output,
    };
    const path = resolveOutputPath(outCtx);
    await writeImageBytes(path, result.bytes);
    saved.push({ path, modelId: result.modelId, mimeType: result.mimeType, costEstimateUsd: result.costEstimateUsd });
    if (opts.open || cfg.openAfter) {
      await openInViewer(path);
    }
  }

  for (const f of outcome.failures) {
    failures.push({ modelId: f.modelId, message: f.error.message });
  }

  outputResults(saved, failures, outcome.failures, opts.json ?? false);
}

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

function outputResults(
  saved: SavedResult[],
  failures: SerializedFailure[],
  rawFailures: { modelId: string; error: Error }[],
  asJson: boolean,
): void {
  if (asJson) {
    process.stdout.write(formatJsonOutput(saved, failures) + "\n");
  } else {
    for (const s of saved) {
      process.stdout.write(`✓ ${s.modelId}: ${s.path}\n`);
    }
    for (const f of failures) {
      process.stderr.write(`✗ ${f.modelId}: ${f.message}\n`);
    }
  }

  if (saved.length > 0 && rawFailures.length > 0) {
    throw new PartialFailure(
      saved.map((s) => ({ modelId: s.modelId, path: s.path })),
      rawFailures,
    );
  } else if (saved.length === 0 && rawFailures.length > 0) {
    throw rawFailures[0]!.error;
  }
  // All successes: fall through, exit 0
}

// ---------------------------------------------------------------------------
// Shared args definition for generate/edit
// ---------------------------------------------------------------------------

const sharedArgs = {
  model: {
    type: "string" as const,
    alias: "m",
    description: "Model ID or comma-separated list (defaults to config or gpt-image-1.5)",
  },
  compare: {
    type: "boolean" as const,
    description: "Fan out across all KNOWN_MODELS (overrides -m)",
    default: false,
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
  n: {
    type: "string" as const,
    description: "Number of images to generate",
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
};

// ---------------------------------------------------------------------------
// generate subcommand
// ---------------------------------------------------------------------------

const generateCmd = defineCommand({
  meta: {
    name: "generate",
    description: "Generate an image from a text prompt",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "Text prompt",
      required: true,
    },
    ...sharedArgs,
  },
  run({ args }) {
    return runGenerate({
      prompt: args.prompt,
      model: args.model,
      compare: args.compare,
      size: args.size,
      quality: args.quality,
      n: args.n ? parseInt(args.n, 10) : undefined,
      output: args.output,
      open: args.open,
      json: args.json,
      dryRun: args["dry-run"],
    });
  },
});

// ---------------------------------------------------------------------------
// edit subcommand
// ---------------------------------------------------------------------------

const editCmd = defineCommand({
  meta: {
    name: "edit",
    description: "Edit an image using reference images (last positional is the prompt)",
  },
  args: {
    mask: {
      type: "string" as const,
      description: "Path to an alpha PNG mask (edit only)",
    },
    ...sharedArgs,
  },
  run({ args }) {
    // All positional args: the last one is the prompt, rest are ref paths
    const positionals: string[] = args._;
    if (positionals.length < 2) {
      throw new InvalidArgs(
        "edit requires at least one reference image and a prompt. Usage: imgen edit <ref...> <prompt>",
      );
    }
    const prompt = positionals[positionals.length - 1]!;
    const refs = positionals.slice(0, -1);

    return runEdit({
      prompt,
      refs,
      mask: args.mask,
      model: args.model,
      compare: args.compare,
      size: args.size,
      quality: args.quality,
      n: args.n ? parseInt(args.n, 10) : undefined,
      output: args.output,
      open: args.open,
      json: args.json,
      dryRun: args["dry-run"],
    });
  },
});

// ---------------------------------------------------------------------------
// models subcommand
// ---------------------------------------------------------------------------

const modelsCmd = defineCommand({
  meta: {
    name: "models",
    description: "List available models grouped by provider, with capabilities",
  },
  run() {
    const grouped = listModels();
    for (const [pid, models] of Object.entries(grouped)) {
      process.stdout.write(`${pid}:\n`);
      for (const m of models) {
        const cap = modelCapabilities(m);
        process.stdout.write(
          `  ${m}  edit=${cap.supportsEdit} mask=${cap.supportsMask} sizes=[${cap.validSizes.join(",")}]\n`,
        );
      }
    }
  },
});

// ---------------------------------------------------------------------------
// init subcommand
// ---------------------------------------------------------------------------

const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "Write a starter ~/.config/imgen/config.toml",
  },
  async run() {
    const home = process.env.HOME ?? "";
    const xdg = process.env.XDG_CONFIG_HOME ?? `${home}/.config`;
    const dir = `${xdg}/imgen`;
    const path = `${dir}/config.toml`;
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    const sample = `# imgen configuration
default_model    = "gpt-image-1.5"
output_dir       = "~/Pictures/imgen"
default_size     = "auto"
default_quality  = "high"
open_after       = false
`;
    try {
      await writeFile(path, sample, { flag: "wx" });
      process.stdout.write(`Wrote ${path}\n`);
    } catch (e: any) {
      if (e.code === "EEXIST") {
        process.stderr.write(`Config already exists at ${path}. Not overwriting.\n`);
      } else {
        throw e;
      }
    }
  },
});

// ---------------------------------------------------------------------------
// config subcommand
// ---------------------------------------------------------------------------

const configCmd = defineCommand({
  meta: {
    name: "config",
    description: "Print resolved config + provider key status",
  },
  run() {
    const env = process.env;
    const cfg = resolveConfig({ tomlText: loadConfigFile(env), env, flags: {} });
    process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
    process.stdout.write(`OPENAI_API_KEY: ${env.OPENAI_API_KEY ? "✓" : "✗"}\n`);
    process.stdout.write(
      `GEMINI/GOOGLE_API_KEY: ${env.GEMINI_API_KEY || env.GOOGLE_API_KEY ? "✓" : "✗"}\n`,
    );
  },
});

// ---------------------------------------------------------------------------
// Main command (bare prompt → generate)
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: "imgen",
    version: "0.1.0",
    description: "Multi-model image generation CLI",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "Text prompt (shorthand for generate)",
      required: false,
    },
    ...sharedArgs,
  },
  subCommands: {
    generate: generateCmd,
    edit: editCmd,
    models: modelsCmd,
    init: initCmd,
    config: configCmd,
  },
  run({ args, rawArgs }) {
    // If a subcommand was matched, citty still calls the parent run — skip it.
    const subCommandNames = ["generate", "edit", "models", "init", "config"];
    const firstPositional = rawArgs.find((a) => !a.startsWith("-"));
    if (firstPositional && subCommandNames.includes(firstPositional)) {
      return;
    }

    const prompt = args.prompt;
    if (!prompt) {
      // No prompt and no subcommand — nothing to do (citty shows usage on no args)
      return;
    }
    return runGenerate({
      prompt,
      model: args.model,
      compare: args.compare,
      size: args.size,
      quality: args.quality,
      n: args.n ? parseInt(args.n, 10) : undefined,
      output: args.output,
      open: args.open,
      json: args.json,
      dryRun: args["dry-run"],
    });
  },
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// Citty tries to match the first non-flag positional against subcommand names.
// When the user does `imgen "my prompt"`, the prompt string won't match any
// subcommand, causing an "Unknown command" error. We pre-process argv to inject
// the `generate` subcommand when the first positional is not a known subcommand.
const KNOWN_SUBCOMMANDS = new Set(["generate", "edit", "models", "init", "config"]);

// String flags that consume the next token as their value
const STRING_FLAGS = new Set([
  "-m", "--model",
  "-s", "--size",
  "-q", "--quality",
  "--n",
  "-o", "--output",
  "--mask",
]);

function patchedRawArgs(argv: string[]): string[] {
  // Find the first arg that is not a flag or a flag value
  let skipNext = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (arg.startsWith("-")) {
      // If it's a string flag (not --flag=value format), skip its value
      if (!arg.includes("=") && STRING_FLAGS.has(arg)) {
        skipNext = true;
      }
      continue;
    }
    // First non-flag positional
    if (!KNOWN_SUBCOMMANDS.has(arg)) {
      // Inject `generate` before it so citty routes correctly
      return [...argv.slice(0, i), "generate", ...argv.slice(i)];
    }
    return argv;
  }
  return argv;
}

try {
  const rawArgs = patchedRawArgs(process.argv.slice(2));
  await runMain(main, { rawArgs });
} catch (err) {
  if (err instanceof Error) {
    process.stderr.write(`error: ${err.message}\n`);
  }
  process.exit(exitCodeFor(err));
}
