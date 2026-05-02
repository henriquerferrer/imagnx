import { describe, it, expect } from "vitest";
import { patchedRawArgs } from "../../src/argv.js";

describe("patchedRawArgs", () => {
  it("passes through known subcommands unchanged", () => {
    expect(patchedRawArgs(["generate", "test"])).toEqual(["generate", "test"]);
    expect(patchedRawArgs(["edit", "ref.png", "do thing"])).toEqual([
      "edit",
      "ref.png",
      "do thing",
    ]);
    expect(patchedRawArgs(["models", "--json"])).toEqual(["models", "--json"]);
  });

  it("injects 'generate' before a bare prompt", () => {
    expect(patchedRawArgs(["a cat"])).toEqual(["generate", "a cat"]);
    expect(patchedRawArgs(["a cat", "--dry-run"])).toEqual([
      "generate",
      "a cat",
      "--dry-run",
    ]);
  });

  it("injects 'generate' at position 0 when string flags precede the prompt", () => {
    expect(patchedRawArgs(["-m", "gpt-image-2", "a cat"])).toEqual([
      "generate",
      "-m",
      "gpt-image-2",
      "a cat",
    ]);
    expect(patchedRawArgs(["--quality", "high", "-s", "1024x1024", "a cat"])).toEqual([
      "generate",
      "--quality",
      "high",
      "-s",
      "1024x1024",
      "a cat",
    ]);
  });

  it("does not double-inject when 'generate' is explicit with flags", () => {
    expect(patchedRawArgs(["generate", "-m", "gpt-image-2", "a cat"])).toEqual([
      "generate",
      "-m",
      "gpt-image-2",
      "a cat",
    ]);
  });

  it("treats prompts that look like subcommand names as flag values via shorthand", () => {
    // `imagnx "models are cool"` — quoted prompt that happens to start with a
    // known subcommand word. The whole string is a single argv entry.
    expect(patchedRawArgs(["models are cool"])).toEqual([
      "generate",
      "models are cool",
    ]);
  });

  it("leaves boolean-only flag invocations alone (no positional)", () => {
    expect(patchedRawArgs(["--version"])).toEqual(["--version"]);
    expect(patchedRawArgs(["--help"])).toEqual(["--help"]);
    expect(patchedRawArgs([])).toEqual([]);
  });

  it("handles --flag=value syntax (no skip needed)", () => {
    expect(patchedRawArgs(["--model=gpt-image-2", "a cat"])).toEqual([
      "generate",
      "--model=gpt-image-2",
      "a cat",
    ]);
  });
});
