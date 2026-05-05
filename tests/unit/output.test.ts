import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  slugify,
  resolveOutputPath,
  writeImageBytes,
  type OutputContext,
} from "../../src/output.js";
import { InvalidArgs } from "../../src/errors.js";

describe("slugify", () => {
  it("takes up to 6 words, lowercased, hyphenated", () => {
    expect(slugify("A Cat Astronaut on the Moon Riding a Rocket")).toBe(
      "a-cat-astronaut-on-the-moon",
    );
  });
  it("strips non-ASCII", () => {
    expect(slugify("a café in paris ☕")).toBe("a-cafe-in-paris");
  });
  it("falls back to 'image' for empty result", () => {
    expect(slugify("☕☕☕")).toBe("image");
  });
  it("clamps to 40 chars", () => {
    expect(
      slugify("supercalifragilistic word two three four five six seven").length,
    ).toBeLessThanOrEqual(40);
  });
});

describe("resolveOutputPath", () => {
  let dir: string;
  const ctx = (): OutputContext => ({
    outputDir: dir,
    now: new Date("2026-05-01T14:30:22Z"),
    prompt: "a cat astronaut",
    modelId: "gpt-image-2",
    extension: "png",
    fanOut: false,
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "imgen-out-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("default path uses date subfolder + slug + model name", () => {
    const path = resolveOutputPath(ctx());
    expect(path.endsWith("/2026-05-01/143022-a-cat-astronaut-gpt-image-2.png")).toBe(
      true,
    );
  });

  it("explicit file path is honored", () => {
    const path = resolveOutputPath({ ...ctx(), explicitOutput: "/tmp/x.png" });
    expect(path).toBe("/tmp/x.png");
  });

  it("explicit file path rejected when fanning out across multiple models", () => {
    expect(() =>
      resolveOutputPath({ ...ctx(), explicitOutput: "/tmp/x.png", fanOut: true }),
    ).toThrow(InvalidArgs);
  });

  it("explicit directory uses default naming", () => {
    const path = resolveOutputPath({ ...ctx(), explicitOutput: dir });
    expect(path.startsWith(dir)).toBe(true);
    expect(path).toContain("a-cat-astronaut");
  });
});

describe("writeImageBytes", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "imgen-write-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates parent dirs and writes bytes", async () => {
    const path = join(dir, "sub", "deep", "out.png");
    const bytes = new Uint8Array([137, 80, 78, 71]); // PNG magic
    await writeImageBytes(path, bytes);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path)).toEqual(Buffer.from(bytes));
  });

  it("leaves no .tmp file after a successful write", async () => {
    const { readdirSync } = await import("node:fs");
    const path = join(dir, "out.png");
    const bytes = new Uint8Array([137, 80, 78, 71]);
    await writeImageBytes(path, bytes);
    const entries = readdirSync(dir);
    const tmpFiles = entries.filter((e) => e.includes(".tmp."));
    expect(tmpFiles).toHaveLength(0);
  });
});
