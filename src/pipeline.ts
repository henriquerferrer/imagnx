// Shared CLI infrastructure used by every subcommand:
//   resolveShared: config + credentials + provider construction
//   executeAndOutput: fan-out execution + image writing + output formatting
//   withExitCode/reportAndExit: enforce our exit-code contract over citty's
//     unconditional process.exit(1) on thrown errors
// Lives in its own module so commands/*.ts can import it without pulling in
// cli.ts (and the circular-import problem that previously forced us to
// monkey-patch iconCmd.run from cli.ts).
import { existsSync, statSync } from "node:fs";
import { exitCodeFor, InvalidArgs, PartialFailure } from "./errors.js";
import {
  apiKeyFor,
  loadConfigFile,
  loadCredentialsFile,
  resolveConfig,
  resolveCredentials,
  VALID_QUALITIES,
  VALID_SIZES,
} from "./config.js";
import type { LoadedCredentials, ResolvedConfig } from "./config.js";
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
import { providerForModel, resolveModelId } from "./registry.js";

export interface SharedGenerateOpts {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  n?: number;
  output?: string;
  open?: boolean;
  json?: boolean;
  dryRun?: boolean;
  style?: string;
  // One-shot per-call key overrides. Highest priority — beat env vars and
  // credentials.toml. Useful for agent contexts where the user just typed
  // the key in chat and persisting it on disk isn't wanted.
  openaiApiKey?: string;
  geminiApiKey?: string;
}

export interface ResolvedShared {
  cfg: ResolvedConfig;
  modelIds: string[];
  size: Size;
  quality: Quality;
  n: number;
  providers: Record<string, Provider>;
}

export interface OutputOpts {
  prompt: string;
  output?: string;
  open?: boolean;
  json?: boolean;
}

export function mimeToExt(mime: string): "png" | "jpg" | "webp" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export function validateLocalImage(
  path: string,
  label: string,
  maxBytes: number,
): void {
  if (!existsSync(path)) throw new InvalidArgs(`${label} not found: ${path}`);
  const st = statSync(path);
  if (!st.isFile()) throw new InvalidArgs(`${label} path is not a file: ${path}`);
  if (st.size > maxBytes) {
    throw new InvalidArgs(
      `${label} too large: ${path} (${st.size} bytes, max ${maxBytes})`,
    );
  }
}

export function narrowSizeFlag(raw: string | undefined): Size | undefined {
  if (raw === undefined) return undefined;
  const v = narrowEnum(raw, VALID_SIZES);
  if (v === undefined) {
    throw new InvalidArgs(
      `--size "${raw}" is not a known preset. Valid: ${VALID_SIZES.join(", ")}`,
    );
  }
  return v;
}

export function narrowQualityFlag(raw: string | undefined): Quality | undefined {
  if (raw === undefined) return undefined;
  // Aliases (DALL-E vocabulary some users still type)
  const aliased = raw === "hd" ? "high" : raw === "standard" ? "medium" : raw;
  const v = narrowEnum(aliased, VALID_QUALITIES);
  if (v === undefined) {
    throw new InvalidArgs(
      `--quality "${raw}" is not a known value. Valid: ${VALID_QUALITIES.join(", ")}`,
    );
  }
  return v;
}

export function warnIfCredentialsInsecure(file: LoadedCredentials): void {
  if ((file.mode & 0o077) !== 0) {
    const octal = (file.mode & 0o777).toString(8).padStart(3, "0");
    process.stderr.write(
      `warning: ${file.path} has permissions ${octal} (group/world-readable). Run: chmod 600 ${file.path}\n`,
    );
  }
}

export function resolveShared(
  opts: SharedGenerateOpts,
  env: Record<string, string | undefined>,
): ResolvedShared {
  const cfg = resolveConfig({ file: loadConfigFile(env), env, flags: {} });
  const credsFile = loadCredentialsFile(env);
  if (credsFile) warnIfCredentialsInsecure(credsFile);
  const creds = resolveCredentials(credsFile);

  // Multi-model fan-out is opt-in via comma-separated -m. No model → default.
  const modelIds: string[] = opts.model
    ? opts.model.split(",").map((m) => m.trim()).filter(Boolean).map(resolveModelId)
    : [cfg.defaultModel];

  const size = narrowSizeFlag(opts.size) ?? cfg.defaultSize;
  const quality = narrowQualityFlag(opts.quality) ?? cfg.defaultQuality;
  const n = opts.n ?? 1;

  const neededProviders = new Set(modelIds.map((m) => providerForModel(m)));
  const providers: Record<string, Provider> = {};
  for (const pid of neededProviders) {
    // Per-call flag wins over env / credentials.toml (apiKeyFor handles those).
    const flagKey =
      pid === "openai" ? opts.openaiApiKey : opts.geminiApiKey;
    const key = flagKey || apiKeyFor(pid, env, creds);
    providers[pid] =
      pid === "openai"
        ? createOpenAIProvider({ apiKey: key })
        : createGeminiProvider({ apiKey: key });
  }

  return { cfg, modelIds, size, quality, n, providers };
}

export async function executeAndOutput(
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

// Cached after the first call; --debug/IMAGNX_DEBUG don't change mid-run.
// We can't read it off citty's parsed args because reportAndExit is invoked
// from the top-level catch handler in cli.ts where those args aren't in scope.
// Single source of truth so the sharedArgs entry can stay descriptive without
// drifting from the actual behavior.
let _debugCache: boolean | undefined;
export function isDebugEnabled(): boolean {
  if (_debugCache === undefined) {
    _debugCache =
      process.env.IMAGNX_DEBUG === "true" ||
      process.argv.includes("--debug") ||
      process.argv.includes("-d");
  }
  return _debugCache;
}

export function reportAndExit(err: unknown): never {
  if (err instanceof Error) {
    process.stderr.write(`error: ${err.message}\n`);
    if (isDebugEnabled() && err.stack) process.stderr.write(err.stack + "\n");
  }
  process.exit(exitCodeFor(err));
}

// citty's runMain catches every thrown error and unconditionally calls
// process.exit(1), which breaks our documented exit-code contract
// (errors.ts: 2-7). Wrap each subcommand body so we exit with the right
// code before runMain ever sees the error.
export async function withExitCode(fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (err) {
    reportAndExit(err);
  }
}
