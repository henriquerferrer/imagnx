// tests/integration/cli-icon.test.ts
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CLI = resolve(HERE, "../../src/cli.ts");

function runCli(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; code: number } {
  const r = spawnSync("npx", ["tsx", CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env, NO_COLOR: "1" },
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? -1 };
}

describe("imagnx icon", () => {
  it("--prompt-only prints the enhanced prompt and exits 0 without API calls", () => {
    const r = runCli(["icon", "weather app", "--prompt-only"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Subject: weather app");
    expect(r.stdout).toContain("Square 1:1 aspect ratio.");
  });

  it("--prompt-only works with no API key set", () => {
    const r = runCli(
      ["icon", "weather app", "--prompt-only"],
      { IMAGNX_OPENAI_API_KEY: "", IMAGNX_GEMINI_API_KEY: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Subject: weather app");
  });

  it("--prompt-only + --raw-prompt echoes prompt verbatim", () => {
    const r = runCli(["icon", "weather app", "--prompt-only", "--raw-prompt"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("weather app");
  });

  it("--prompt-only + --style minimalism includes the preset directive", () => {
    const r = runCli(["icon", "weather app", "--prompt-only", "--style", "minimalism"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Primary style preset (dominant): minimalism");
  });

  it("rejects an unknown style with exit 4", () => {
    const r = runCli(["icon", "weather app", "--prompt-only", "--style", "foobar"]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("unknown style 'foobar'");
  });

  it("rejects an icon-only style on non-icon command", () => {
    const r = runCli(["generate", "weather app", "--style", "glassy"]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("'glassy' only supported on: icon");
  });
});

describe("imagnx generate --style", () => {
  it("--style pixel prepends a Style directive to the prompt", () => {
    const r = runCli(["generate", "weather app", "--style", "pixel", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("[dry-run] kind=generate");
    expect(r.stderr).toContain("Style directive:");
    expect(r.stderr).toContain("Style system: PIXEL");
  });

  it("--style minimalism prepends Style system: MINIMALISM", () => {
    const r = runCli(["generate", "weather app", "--style", "minimalism", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("Style system: MINIMALISM");
  });
});
