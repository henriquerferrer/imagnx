import TOML from "@iarna/toml";
import { homedir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MissingApiKey } from "./errors";
import type { Quality, Size } from "./providers/types";

export interface ResolvedConfig {
  defaultModel: string;
  outputDir: string;
  defaultSize: Size;
  defaultQuality: Quality;
  openAfter: boolean;
}

export const HARD_DEFAULTS: ResolvedConfig = {
  defaultModel: "gpt-image-1.5",
  outputDir: "~/Pictures/imgen",
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

export function parseTomlConfig(text: string): ConfigOverrides {
  const data = TOML.parse(text) as Record<string, unknown>;
  return {
    defaultModel: data.default_model as string | undefined,
    outputDir: data.output_dir as string | undefined,
    defaultSize: data.default_size as Size | undefined,
    defaultQuality: data.default_quality as Quality | undefined,
    openAfter: data.open_after as boolean | undefined,
  };
}

function envOverrides(env: Record<string, string | undefined>): ConfigOverrides {
  return {
    defaultModel: env.IMGEN_DEFAULT_MODEL,
    outputDir: env.IMGEN_OUTPUT_DIR,
    defaultSize: env.IMGEN_DEFAULT_SIZE as Size | undefined,
    defaultQuality: env.IMGEN_DEFAULT_QUALITY as Quality | undefined,
    openAfter:
      env.IMGEN_OPEN_AFTER === "true"
        ? true
        : env.IMGEN_OPEN_AFTER === "false"
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
  const path = join(xdg, "imgen", "config.toml");
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
