#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";

const pkg = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

import { exitCodeFor, InvalidArgs, PartialFailure } from "./errors.js";
import {
  KNOWN_MODELS,
  listModels,
  modelCapabilities,
  providerForModel,
  resolveModelId,
  validateRequest,
} from "./registry.js";
import {
  apiKeyFor,
  loadConfigFile,
  resolveConfig,
  VALID_QUALITIES,
  VALID_SIZES,
} from "./config.js";
import type { ResolvedConfig } from "./config.js";
import { narrowEnum } from "./narrow.js";
import {
  openInViewer,
  resolveOutputPath,
  writeImageBytes,
} from "./output.js";
import { runFanOut } from "./runner.js";
import type { RunRequest } from "./runner.js";
import { formatJsonOutput } from "./json.js";
import type { SavedResult, SerializedFailure } from "./json.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { createGeminiProvider } from "./providers/gemini.js";
import type { Provider, Quality, Size } from "./providers/types.js";
import { patchedRawArgs } from "./argv.js";

// ---------------------------------------------------------------------------
// Option shapes (citty → run* funcs)
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

function validateLocalImage(path: string, label: string, maxBytes: number): void {
  if (!existsSync(path)) throw new InvalidArgs(`${label} not found: ${path}`);
  const st = statSync(path);
  if (!st.isFile()) throw new InvalidArgs(`${label} path is not a file: ${path}`);
  if (st.size > maxBytes) {
    throw new InvalidArgs(
      `${label} too large: ${path} (${st.size} bytes, max ${maxBytes})`,
    );
  }
}

function narrowSizeFlag(raw: string | undefined): Size | undefined {
  if (raw === undefined) return undefined;
  const v = narrowEnum(raw, VALID_SIZES);
  if (v === undefined) {
    throw new InvalidArgs(
      `--size "${raw}" is not a known preset. Valid: ${VALID_SIZES.join(", ")}`,
    );
  }
  return v;
}

function narrowQualityFlag(raw: string | undefined): Quality | undefined {
  if (raw === undefined) return undefined;
  const v = narrowEnum(raw, VALID_QUALITIES);
  if (v === undefined) {
    throw new InvalidArgs(
      `--quality "${raw}" is not valid. Valid: ${VALID_QUALITIES.join(", ")}`,
    );
  }
  return v;
}

interface ResolvedShared {
  cfg: ResolvedConfig;
  modelIds: string[];
  size: Size;
  quality: Quality;
  n: number;
  providers: Record<string, Provider>;
}

// Shared resolution path for generate + edit:
// config → modelIds (with alias resolution) → narrowed flags → providers map.
function resolveShared(
  opts: SharedGenerateOpts,
  env: Record<string, string | undefined>,
): ResolvedShared {
  const cfg = resolveConfig({ tomlText: loadConfigFile(env), env, flags: {} });

  let modelIds: string[];
  if (opts.compare) {
    modelIds = [...KNOWN_MODELS];
  } else if (opts.model) {
    modelIds = opts.model
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .map(resolveModelId);
  } else {
    modelIds = [cfg.defaultModel];
  }

  const size = narrowSizeFlag(opts.size) ?? cfg.defaultSize;
  const quality = narrowQualityFlag(opts.quality) ?? cfg.defaultQuality;
  const n = opts.n ?? 1;

  const neededProviders = new Set(modelIds.map((m) => providerForModel(m)));
  const providers: Record<string, Provider> = {};
  for (const pid of neededProviders) {
    const key = apiKeyFor(pid, env);
    providers[pid] =
      pid === "openai"
        ? createOpenAIProvider({ apiKey: key })
        : createGeminiProvider({ apiKey: key });
  }

  return { cfg, modelIds, size, quality, n, providers };
}

interface OutputOpts {
  prompt: string;
  output?: string;
  open?: boolean;
  json?: boolean;
}

async function executeAndOutput(
  req: RunRequest,
  cfg: ResolvedConfig,
  providers: Record<string, Provider>,
  opts: OutputOpts,
): Promise<void> {
  const now = new Date();
  const outcome = await runFanOut(req, providers, providerForModel);
  const fanOut = req.modelIds.length > 1;

  const saved: SavedResult[] = [];
  for (const result of outcome.successes) {
    const path = resolveOutputPath({
      outputDir: cfg.outputDir,
      now,
      prompt: opts.prompt,
      modelId: result.modelId,
      extension: mimeToExt(result.mimeType),
      fanOut,
      explicitOutput: opts.output,
    });
    await writeImageBytes(path, result.bytes);
    saved.push({ path, modelId: result.modelId, mimeType: result.mimeType });
    if (opts.open || cfg.openAfter) {
      await openInViewer(path);
    }
  }

  const failures: SerializedFailure[] = outcome.failures.map((f) => ({
    modelId: f.modelId,
    message: f.error.message,
  }));

  outputResults(saved, failures, outcome.failures, opts.json ?? false);
}

// ---------------------------------------------------------------------------
// generate / edit entry points
// ---------------------------------------------------------------------------

async function runGenerate(opts: SharedGenerateOpts): Promise<void> {
  const { cfg, modelIds, size, quality, n, providers } = resolveShared(
    opts,
    process.env,
  );

  for (const modelId of modelIds) {
    validateRequest(modelId, { kind: "generate", size });
  }

  if (opts.dryRun) {
    process.stderr.write(
      `[dry-run] kind=generate models=${modelIds.join(",")} prompt=${opts.prompt}\n`,
    );
    return;
  }

  const req: RunRequest = {
    kind: "generate",
    modelIds,
    input: { prompt: opts.prompt, size, quality, n },
  };
  await executeAndOutput(req, cfg, providers, opts);
}

async function runEdit(opts: EditOpts): Promise<void> {
  if (opts.refs.length === 0) {
    throw new InvalidArgs("edit requires at least one reference image path");
  }
  if (!opts.prompt) {
    throw new InvalidArgs("edit requires a prompt (last positional argument)");
  }

  const MAX_REF_BYTES = 25 * 1024 * 1024; // 25 MB

  for (const ref of opts.refs) {
    validateLocalImage(ref, "Reference image", MAX_REF_BYTES);
  }
  if (opts.mask) {
    validateLocalImage(opts.mask, "Mask image", MAX_REF_BYTES);
  }

  const { readFile } = await import("node:fs/promises");
  const refImages: Uint8Array[] = await Promise.all(
    opts.refs.map(async (r) => new Uint8Array(await readFile(r))),
  );
  const mask: Uint8Array | undefined = opts.mask
    ? new Uint8Array(await readFile(opts.mask))
    : undefined;

  const { cfg, modelIds, size, quality, n, providers } = resolveShared(
    opts,
    process.env,
  );

  for (const modelId of modelIds) {
    validateRequest(modelId, {
      kind: "edit",
      refCount: refImages.length,
      size,
      hasMask: !!mask,
    });
  }

  if (opts.dryRun) {
    process.stderr.write(
      `[dry-run] kind=edit models=${modelIds.join(",")} refs=${opts.refs.join(",")} prompt=${opts.prompt}\n`,
    );
    return;
  }

  const req: RunRequest = {
    kind: "edit",
    modelIds,
    input: { prompt: opts.prompt, size, quality, n, refImages, mask },
  };
  await executeAndOutput(req, cfg, providers, opts);
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
  // --debug is read directly off process.argv by the catch handler at the
  // bottom of this file. Keeping it here so citty doesn't reject it as
  // unknown.
  debug: {
    type: "boolean" as const,
    alias: "d",
    default: false,
    description: "Verbose error output (stack traces)",
  },
};

function parseN(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || String(n) !== raw.trim()) {
    throw new InvalidArgs("--n must be a positive integer");
  }
  return n;
}

function reportAndExit(err: unknown): never {
  if (err instanceof Error) {
    process.stderr.write(`error: ${err.message}\n`);
    const debug =
      process.env.IMAGN_DEBUG === "true" ||
      process.argv.includes("--debug") ||
      process.argv.includes("-d");
    if (debug && err.stack) process.stderr.write(err.stack + "\n");
  }
  process.exit(exitCodeFor(err));
}

// citty's runMain catches every thrown error and unconditionally calls
// process.exit(1), which breaks our documented exit-code contract
// (errors.ts: 2-7). Wrap each subcommand body so we exit with the right
// code before runMain ever sees the error.
async function withExitCode(fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (err) {
    reportAndExit(err);
  }
}

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
    return withExitCode(() =>
      runGenerate({
        prompt: args.prompt,
        model: args.model,
        compare: args.compare,
        size: args.size,
        quality: args.quality,
        n: parseN(args.n),
        output: args.output,
        open: args.open,
        json: args.json,
        dryRun: args["dry-run"],
      }),
    );
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
    return withExitCode(() => {
      // All positional args: the last one is the prompt, rest are ref paths
      const positionals: string[] = args._;
      if (positionals.length < 2) {
        throw new InvalidArgs(
          "edit requires at least one reference image and a prompt. Usage: imagn edit <ref...> <prompt>",
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
        n: parseN(args.n),
        output: args.output,
        open: args.open,
        json: args.json,
        dryRun: args["dry-run"],
      });
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
  args: {
    json: {
      type: "boolean" as const,
      default: false,
      description: "Output as JSON",
    },
  },
  run({ args }) {
    return withExitCode(() => {
      const grouped = listModels();
      if (args.json) {
        const out: Record<string, Array<Record<string, unknown>>> = {};
        for (const [pid, models] of Object.entries(grouped)) {
          out[pid] = models.map((m) => {
            const cap = modelCapabilities(m);
            return {
              modelId: m,
              supportsEdit: cap.supportsEdit,
              supportsMask: cap.supportsMask,
              validSizes: cap.validSizes,
            };
          });
        }
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
        return;
      }
      for (const [pid, models] of Object.entries(grouped)) {
        process.stdout.write(`${pid}:\n`);
        for (const m of models) {
          const cap = modelCapabilities(m);
          process.stdout.write(
            `  ${m}  edit=${cap.supportsEdit} mask=${cap.supportsMask} sizes=[${cap.validSizes.join(",")}]\n`,
          );
        }
      }
    });
  },
});

// ---------------------------------------------------------------------------
// init subcommand
// ---------------------------------------------------------------------------

const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "Write a starter ~/.config/imagn/config.toml",
  },
  run() {
    return withExitCode(async () => {
      const home = process.env.HOME ?? "";
      const xdg = process.env.XDG_CONFIG_HOME ?? `${home}/.config`;
      const dir = `${xdg}/imagn`;
      const path = `${dir}/config.toml`;
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
      const sample = `# imagn configuration
default_model    = "gpt-image-1.5"
output_dir       = "~/Pictures/imagn"
default_size     = "auto"
default_quality  = "high"
open_after       = false
`;
      try {
        await writeFile(path, sample, { flag: "wx" });
        process.stdout.write(`Wrote ${path}\n`);
      } catch (e: unknown) {
        if (
          e !== null &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code: unknown }).code === "EEXIST"
        ) {
          process.stderr.write(`Config already exists at ${path}. Not overwriting.\n`);
        } else {
          throw e;
        }
      }
    });
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
    return withExitCode(() => {
      const env = process.env;
      const cfg = resolveConfig({ tomlText: loadConfigFile(env), env, flags: {} });
      process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
      process.stderr.write(`OPENAI_API_KEY: ${env.OPENAI_API_KEY ? "✓" : "✗"}\n`);
      process.stderr.write(
        `GEMINI/GOOGLE_API_KEY: ${env.GEMINI_API_KEY || env.GOOGLE_API_KEY ? "✓" : "✗"}\n`,
      );
    });
  },
});

// ---------------------------------------------------------------------------
// Main command (bare prompt → generate)
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: "imagn",
    version: pkg.version,
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
    return withExitCode(() => {
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
        n: parseN(args.n),
        output: args.output,
        open: args.open,
        json: args.json,
        dryRun: args["dry-run"],
      });
    });
  },
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

try {
  const rawArgs = patchedRawArgs(process.argv.slice(2));
  await runMain(main, { rawArgs });
} catch (err) {
  reportAndExit(err);
}
