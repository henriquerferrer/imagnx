import TOML from "@iarna/toml";
import { homedir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MissingApiKey } from "./errors.js";
import type { Quality, Size } from "./providers/types.js";
import { narrowEnum, narrowString, narrowBool, getProp } from "./narrow.js";

export interface ResolvedConfig {
  defaultModel: string;
  outputDir: string;
  defaultSize: Size;
  defaultQuality: Quality;
  openAfter: boolean;
}

export const HARD_DEFAULTS: ResolvedConfig = {
  defaultModel: "gpt-image-1.5",
  outputDir: "~/Pictures/imagn",
  defaultSize: "auto",
  defaultQuality: "high",
  openAfter: false,
};

export interface ConfigOverrides {
  defaultModel?: string;
  outputDir?: string;
  defaultSize?: Size;
  defaultQuality?: Quality;
  openAfter?: boolean;
}

export const VALID_QUALITIES: ReadonlyArray<Quality> = ["low", "medium", "high", "auto"];
// Union of presets accepted by any supported model. Per-model validity is
// narrowed by registry.validateRequest; this is just the "is this a known
// preset string" gate at the CLI boundary.
export const VALID_SIZES: ReadonlyArray<Size> = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
];

export function parseTomlConfig(text: string): ConfigOverrides {
  const data: unknown = TOML.parse(text);
  return {
    defaultModel: narrowString(getProp(data, "default_model")),
    outputDir: narrowString(getProp(data, "output_dir")),
    defaultSize: narrowEnum(getProp(data, "default_size"), VALID_SIZES),
    defaultQuality: narrowEnum(getProp(data, "default_quality"), VALID_QUALITIES),
    openAfter: narrowBool(getProp(data, "open_after")),
  };
}

function envOverrides(env: Record<string, string | undefined>): ConfigOverrides {
  return {
    defaultModel: narrowString(env.IMAGN_DEFAULT_MODEL),
    outputDir: narrowString(env.IMAGN_OUTPUT_DIR),
    defaultSize: narrowEnum(env.IMAGN_DEFAULT_SIZE, VALID_SIZES),
    defaultQuality: narrowEnum(env.IMAGN_DEFAULT_QUALITY, VALID_QUALITIES),
    openAfter:
      env.IMAGN_OPEN_AFTER === "true"
        ? true
        : env.IMAGN_OPEN_AFTER === "false"
          ? false
          : undefined,
  };
}

function expandTilde(p: string, env: Record<string, string | undefined>): string {
  if (!p.startsWith("~")) return p;
  const home = env.HOME ?? homedir();
  return join(home, p.slice(1).replace(/^\/+/, ""));
}

function merge(...layers: ConfigOverrides[]): ResolvedConfig {
  const out: ResolvedConfig = { ...HARD_DEFAULTS };
  for (const layer of layers) {
    if (layer.defaultModel !== undefined) out.defaultModel = layer.defaultModel;
    if (layer.outputDir !== undefined) out.outputDir = layer.outputDir;
    if (layer.defaultSize !== undefined) out.defaultSize = layer.defaultSize;
    if (layer.defaultQuality !== undefined)
      out.defaultQuality = layer.defaultQuality;
    if (layer.openAfter !== undefined) out.openAfter = layer.openAfter;
  }
  return out;
}

export interface ResolveInput {
  tomlText: string | undefined;
  env: Record<string, string | undefined>;
  flags: ConfigOverrides;
}

export function resolveConfig(input: ResolveInput): ResolvedConfig {
  const fromToml = input.tomlText ? parseTomlConfig(input.tomlText) : {};
  const fromEnv = envOverrides(input.env);
  const merged = merge(fromToml, fromEnv, input.flags);
  merged.outputDir = expandTilde(merged.outputDir, input.env);
  return merged;
}

export function loadConfigFile(env: Record<string, string | undefined>): string | undefined {
  const xdg = env.XDG_CONFIG_HOME ?? join(env.HOME ?? homedir(), ".config");
  const path = join(xdg, "imagn", "config.toml");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return undefined;
}

export function apiKeyFor(
  providerId: "openai" | "google",
  env: Record<string, string | undefined>,
): string {
  if (providerId === "openai") {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new MissingApiKey("OPENAI_API_KEY");
    return key;
  }
  const key = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY;
  if (!key) throw new MissingApiKey("GEMINI_API_KEY");
  return key;
}
