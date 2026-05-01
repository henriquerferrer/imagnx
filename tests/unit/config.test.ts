import { describe, it, expect } from "bun:test";
import {
  resolveConfig,
  parseTomlConfig,
  HARD_DEFAULTS,
  apiKeyFor,
} from "../../src/config";
import { MissingApiKey } from "../../src/errors";

describe("config", () => {
  it("HARD_DEFAULTS contain expected baseline", () => {
    expect(HARD_DEFAULTS.defaultModel).toBe("gpt-image-1.5");
    expect(HARD_DEFAULTS.outputDir).toBe("~/Pictures/imagn");
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
output_dir = "/tmp/imagn"
`);
    expect(cfg.defaultModel).toBe("gemini-2.5-flash-image");
    expect(cfg.outputDir).toBe("/tmp/imagn");
  });

  it("resolveConfig: hard defaults win when nothing else", () => {
    const c = resolveConfig({ tomlText: undefined, env: {}, flags: {} });
    expect(c.defaultModel).toBe(HARD_DEFAULTS.defaultModel);
  });

  it("resolveConfig: TOML overrides defaults", () => {
    const c = resolveConfig({
      tomlText: 'default_model = "gemini-2.5-flash-image"',
      env: {},
      flags: {},
    });
    expect(c.defaultModel).toBe("gemini-2.5-flash-image");
  });

  it("resolveConfig: env overrides TOML for output dir via IMGEN_OUTPUT_DIR", () => {
    const c = resolveConfig({
      tomlText: 'output_dir = "/from-toml"',
      env: { IMGEN_OUTPUT_DIR: "/from-env" },
      flags: {},
    });
    expect(c.outputDir).toBe("/from-env");
  });

  it("resolveConfig: flags win over everything", () => {
    const c = resolveConfig({
      tomlText: 'default_model = "gemini-2.5-flash-image"',
      env: { IMGEN_DEFAULT_MODEL: "gpt-image-1.5" },
      flags: { defaultModel: "gpt-image-2" },
    });
    expect(c.defaultModel).toBe("gpt-image-2");
  });

  it("resolveConfig expands ~ in outputDir", () => {
    const c = resolveConfig({
      tomlText: 'output_dir = "~/Pictures/imagn"',
      env: { HOME: "/Users/test" },
      flags: {},
    });
    expect(c.outputDir).toBe("/Users/test/Pictures/imagn");
  });

  it("apiKeyFor returns key from env", () => {
    expect(apiKeyFor("openai", { OPENAI_API_KEY: "sk-test" })).toBe("sk-test");
    expect(apiKeyFor("google", { GEMINI_API_KEY: "g-test" })).toBe("g-test");
  });

  it("apiKeyFor accepts GOOGLE_API_KEY as fallback for google", () => {
    expect(apiKeyFor("google", { GOOGLE_API_KEY: "g2" })).toBe("g2");
  });

  it("apiKeyFor throws MissingApiKey when env is missing", () => {
    expect(() => apiKeyFor("openai", {})).toThrow(MissingApiKey);
  });
});
