// End-to-end CLI dispatch tests. Each test spawns `tsx src/cli.ts <args>` so
// citty argv parsing, alias resolution, exit-code mapping, and stdout/stderr
// formatting are exercised together. Tests run in an isolated $HOME so the
// user's real ~/.imagnx/{config,credentials}.toml never bleeds in.
//
// Why these tests live here and not as unit tests: every regression we care
// about — bare-prompt routing, alias resolution, exit codes, JSON shape —
// only fails when citty's full pipeline runs. Unit tests against runGenerate
// directly bypass exactly the layer we want to verify.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CLI = resolve(HERE, "../../src/cli.ts");

let isolatedHome: string;

beforeAll(() => {
  isolatedHome = mkdtempSync(`${tmpdir()}/imagnx-cli-test-`);
});

afterAll(() => {
  rmSync(isolatedHome, { recursive: true, force: true });
});

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runCli(args: string[], env: Record<string, string> = {}): RunResult {
  const r = spawnSync("npx", ["tsx", CLI, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: isolatedHome,
      IMAGNX_OPENAI_API_KEY: "test-openai-key",
      IMAGNX_GEMINI_API_KEY: "test-gemini-key",
      ...env,
      NO_COLOR: "1",
    },
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? -1 };
}

describe("imagnx top-level", () => {
  // citty's built-in --version / --help printing is its own concern; we trust
  // it. What we own and must verify is the bare-prompt → generate routing in
  // argv.ts and the subCommands wiring.

  it("bare prompt routes to generate via the argv-patcher", () => {
    const r = runCli(["a tiny dragon", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("[dry-run] kind=generate");
    expect(r.stderr).toContain("a tiny dragon");
  });

  it("bare prompt with a string flag and value resolves correctly", () => {
    // Regression guard: STRING_FLAGS in commands/index.ts must include -m so
    // the argv-patcher doesn't mis-read 'gpt-image-1.5' as a subcommand.
    const r = runCli(["-m", "gpt-image-1.5", "a tiny dragon", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("models=gpt-image-1.5");
    expect(r.stderr).toContain("a tiny dragon");
  });
});

describe("imagnx generate", () => {
  it("--dry-run reports planned operation and exits 0", () => {
    const r = runCli(["generate", "a serene mountain", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("[dry-run] kind=generate models=gpt-image-1.5");
    expect(r.stderr).toContain("a serene mountain");
  });

  it("nano-banana alias resolves to gemini-2.5-flash-image", () => {
    const r = runCli([
      "generate", "blue circle",
      "-m", "nano-banana", "-q", "auto",
      "--dry-run",
    ]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("models=gemini-2.5-flash-image");
  });

  it("comma-separated -m fans out across models", () => {
    const r = runCli([
      "generate", "blue circle",
      "-m", "gpt-image-1.5,nano-banana", "-q", "auto",
      "--dry-run",
    ]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("models=gpt-image-1.5,gemini-2.5-flash-image");
  });

  it("rejects icon-only style with exit 4 and a clear message", () => {
    const r = runCli([
      "generate", "weather",
      "--style", "ios-classic",
      "--dry-run",
    ]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("only supported on: icon");
  });

  it("rejects unknown size with exit 4", () => {
    const r = runCli([
      "generate", "weather",
      "-s", "9999x9999",
      "--dry-run",
    ]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("not a known preset");
  });

  it("--openai-api-key flag works without IMAGNX_OPENAI_API_KEY env", () => {
    // Cleared env + isolated $HOME → no env, no credentials file. The flag is
    // the only key source. If runGenerate succeeds, the override is wired.
    const r = runCli(
      ["generate", "blue circle", "--openai-api-key", "sk-flag-only", "--dry-run"],
      { IMAGNX_OPENAI_API_KEY: "", IMAGNX_GEMINI_API_KEY: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("[dry-run] kind=generate models=gpt-image-1.5");
  });

  it("--gemini-api-key flag works without IMAGNX_GEMINI_API_KEY env", () => {
    const r = runCli(
      [
        "generate", "blue circle",
        "-m", "nano-banana", "-q", "auto",
        "--gemini-api-key", "g-flag-only",
        "--dry-run",
      ],
      { IMAGNX_OPENAI_API_KEY: "", IMAGNX_GEMINI_API_KEY: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("models=gemini-2.5-flash-image");
  });

  it("missing key still surfaces exit 2 when neither flag nor env is set", () => {
    const r = runCli(
      ["generate", "blue circle", "--dry-run"],
      { IMAGNX_OPENAI_API_KEY: "", IMAGNX_GEMINI_API_KEY: "" },
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("IMAGNX_OPENAI_API_KEY is not set");
  });
});

describe("imagnx edit", () => {
  it("missing args exits 4 with a usage hint", () => {
    const r = runCli(["edit"]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("at least one reference image and a prompt");
  });

  it("nonexistent reference image exits 4", () => {
    const r = runCli([
      "edit", "/tmp/imagnx-does-not-exist-xyz.png", "make it pink",
      "--dry-run",
    ]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("Reference image not found");
  });

  it("--openai-api-key flag works without env", () => {
    // edit needs a real ref file to validate; a 1-byte file is enough for
    // dry-run (validateLocalImage just checks existence + size).
    const tmpRef = `${isolatedHome}/ref.png`;
    writeFileSync(tmpRef, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const r = runCli(
      [
        "edit", tmpRef, "make it pink",
        "--openai-api-key", "sk-flag-only",
        "--dry-run",
      ],
      { IMAGNX_OPENAI_API_KEY: "", IMAGNX_GEMINI_API_KEY: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("[dry-run] kind=edit");
  });
});

describe("imagnx models", () => {
  it("text output groups by provider with capabilities", () => {
    const r = runCli(["models"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("openai:");
    expect(r.stdout).toContain("google:");
    expect(r.stdout).toContain("gpt-image-1.5");
    expect(r.stdout).toContain("gemini-2.5-flash-image");
    expect(r.stdout).toContain("edit=true");
  });

  it("--json emits a parseable provider→models map", () => {
    const r = runCli(["models", "--json"]);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toHaveProperty("openai");
    expect(parsed).toHaveProperty("google");
    expect(Array.isArray(parsed.openai)).toBe(true);
    expect(parsed.openai[0]).toHaveProperty("modelId");
    expect(parsed.openai[0]).toHaveProperty("supportsEdit");
    expect(parsed.openai[0]).toHaveProperty("validSizes");
  });
});

describe("imagnx config", () => {
  it("prints resolved config as JSON and key status on stderr", () => {
    const r = runCli(["config"]);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toHaveProperty("defaultModel");
    expect(parsed).toHaveProperty("outputDir");
    expect(parsed).toHaveProperty("defaultQuality");
    expect(r.stderr).toContain("openai key: ✓");
    expect(r.stderr).toContain("gemini key: ✓");
  });

  it("reports missing keys when env vars are cleared", () => {
    const r = runCli(["config"], {
      IMAGNX_OPENAI_API_KEY: "",
      IMAGNX_GEMINI_API_KEY: "",
    });
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("openai key: ✗");
    expect(r.stderr).toContain("gemini key: ✗");
  });
});
