import { describe, it, expect } from "vitest";
import {
  resolveConfig,
  parseTomlConfig,
  parseYamlConfig,
  HARD_DEFAULTS,
  apiKeyFor,
  VALID_QUALITIES,
  VALID_SIZES,
} from "../../src/config.js";
import { MissingApiKey } from "../../src/errors.js";

const toml = (text: string) =>
  ({ text, format: "toml", path: "/test/config.toml" } as const);
const yaml = (text: string) =>
  ({ text, format: "yaml", path: "/test/config.yml" } as const);

describe("config", () => {
  it("HARD_DEFAULTS contain expected baseline", () => {
    expect(HARD_DEFAULTS.defaultModel).toBe("gpt-image-1.5");
    expect(HARD_DEFAULTS.outputDir).toBe("~/Pictures/imagnx");
    expect(HARD_DEFAULTS.defaultSize).toBe("auto");
    expect(HARD_DEFAULTS.defaultQuality).toBe("high");
    expect(HARD_DEFAULTS.openAfter).toBe(false);
  });

  it("parseTomlConfig accepts empty input", () => {
    expect(parseTomlConfig("")).toEqual({});
  });

  it("parseTomlConfig parses file overrides", () => {
    const cfg = parseTomlConfig(`
default_model = "gemini-2.5-flash-image"
output_dir = "/tmp/imagnx"
`);
    expect(cfg.defaultModel).toBe("gemini-2.5-flash-image");
    expect(cfg.outputDir).toBe("/tmp/imagnx");
  });

  it("parseYamlConfig parses file overrides", () => {
    const cfg = parseYamlConfig(`
default_model: gemini-2.5-flash-image
output_dir: /tmp/imagnx
default_quality: medium
open_after: true
`);
    expect(cfg.defaultModel).toBe("gemini-2.5-flash-image");
    expect(cfg.outputDir).toBe("/tmp/imagnx");
    expect(cfg.defaultQuality).toBe("medium");
    expect(cfg.openAfter).toBe(true);
  });

  it("parseYamlConfig rejects bad default_quality", () => {
    const cfg = parseYamlConfig("default_quality: garbage");
    expect(cfg.defaultQuality).toBeUndefined();
  });

  it("resolveConfig: hard defaults win when nothing else", () => {
    const c = resolveConfig({ file: undefined, env: {}, flags: {} });
    expect(c.defaultModel).toBe(HARD_DEFAULTS.defaultModel);
  });

  it("resolveConfig: TOML overrides defaults", () => {
    const c = resolveConfig({
      file: toml('default_model = "gemini-2.5-flash-image"'),
      env: {},
      flags: {},
    });
    expect(c.defaultModel).toBe("gemini-2.5-flash-image");
  });

  it("resolveConfig: YAML overrides defaults", () => {
    const c = resolveConfig({
      file: yaml("default_model: gemini-2.5-flash-image"),
      env: {},
      flags: {},
    });
    expect(c.defaultModel).toBe("gemini-2.5-flash-image");
  });

  it("resolveConfig: env overrides file via IMAGNX_OUTPUT_DIR", () => {
    const c = resolveConfig({
      file: toml('output_dir = "/from-toml"'),
      env: { IMAGNX_OUTPUT_DIR: "/from-env" },
      flags: {},
    });
    expect(c.outputDir).toBe("/from-env");
  });

  it("resolveConfig: flags win over everything", () => {
    const c = resolveConfig({
      file: toml('default_model = "gemini-2.5-flash-image"'),
      env: { IMAGNX_DEFAULT_MODEL: "gpt-image-1.5" },
      flags: { defaultModel: "gpt-image-2" },
    });
    expect(c.defaultModel).toBe("gpt-image-2");
  });

  it("resolveConfig expands ~ in outputDir", () => {
    const c = resolveConfig({
      file: toml('output_dir = "~/Pictures/imagnx"'),
      env: { HOME: "/Users/test" },
      flags: {},
    });
    expect(c.outputDir).toBe("/Users/test/Pictures/imagnx");
  });

  it("resolveConfig: legacy IMAGN_* env vars are NOT honored", () => {
    const c = resolveConfig({
      file: undefined,
      env: { IMAGN_DEFAULT_MODEL: "gpt-image-2" },
      flags: {},
    });
    expect(c.defaultModel).toBe(HARD_DEFAULTS.defaultModel);
  });

  it("apiKeyFor returns key from env", () => {
    expect(apiKeyFor("openai", { IMAGNX_OPENAI_API_KEY: "sk-test" })).toBe(
      "sk-test",
    );
    expect(apiKeyFor("google", { IMAGNX_GEMINI_API_KEY: "g-test" })).toBe(
      "g-test",
    );
  });

  it("apiKeyFor accepts IMAGNX_GOOGLE_API_KEY as alias for google", () => {
    expect(apiKeyFor("google", { IMAGNX_GOOGLE_API_KEY: "g3" })).toBe("g3");
  });

  it("apiKeyFor ignores unprefixed provider env vars", () => {
    expect(() => apiKeyFor("openai", { OPENAI_API_KEY: "sk-other" })).toThrow(
      MissingApiKey,
    );
    expect(() => apiKeyFor("google", { GEMINI_API_KEY: "g-other" })).toThrow(
      MissingApiKey,
    );
    expect(() => apiKeyFor("google", { GOOGLE_API_KEY: "g-other" })).toThrow(
      MissingApiKey,
    );
  });

  it("apiKeyFor throws MissingApiKey when env is missing", () => {
    expect(() => apiKeyFor("openai", {})).toThrow(MissingApiKey);
  });

  it("parseTomlConfig rejects non-string default_model", () => {
    const cfg = parseTomlConfig("default_model = 42");
    expect(cfg.defaultModel).toBeUndefined();
  });

  it("parseTomlConfig rejects bad default_quality", () => {
    const cfg = parseTomlConfig('default_quality = "garbage"');
    expect(cfg.defaultQuality).toBeUndefined();
  });

  it("envOverrides rejects bad IMAGNX_DEFAULT_QUALITY", () => {
    // We exercise envOverrides indirectly via resolveConfig
    const c = resolveConfig({
      file: undefined,
      env: { IMAGNX_DEFAULT_QUALITY: "garbage" },
      flags: {},
    });
    // Bad quality is rejected → falls back to HARD_DEFAULTS
    expect(c.defaultQuality).toBe("high");
  });

  it("VALID_QUALITIES is the canonical set", () => {
    expect(VALID_QUALITIES).toEqual(["low", "medium", "high", "auto"]);
  });

  it("VALID_SIZES contains all model presets, including gpt-image-2's", () => {
    expect(VALID_SIZES).toContain("auto");
    expect(VALID_SIZES).toContain("1024x1024");
    expect(VALID_SIZES).toContain("2048x2048");
    expect(VALID_SIZES).toContain("3840x2160");
    expect(VALID_SIZES).toContain("2160x3840");
  });
});
