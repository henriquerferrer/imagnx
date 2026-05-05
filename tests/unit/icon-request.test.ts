import { describe, it, expect } from "vitest";
import { buildIconRequest } from "../../src/commands/icon.js";
import { InvalidArgs } from "../../src/errors.js";

describe("buildIconRequest", () => {
  it("plain prompt produces enhanced prompt and printOnly=false", () => {
    const r = buildIconRequest({ prompt: "weather app" });
    expect(r.printOnly).toBe(false);
    expect(r.enhancedPrompt).toContain("Subject: weather app");
  });

  it("--prompt-only sets printOnly true", () => {
    expect(buildIconRequest({ prompt: "x", promptOnly: true }).printOnly).toBe(true);
  });

  it("invalid style throws InvalidArgs", () => {
    expect(() => buildIconRequest({ prompt: "x", style: "foobar" })).toThrow(InvalidArgs);
  });

  it("valid icon-only style passes through", () => {
    const r = buildIconRequest({ prompt: "x", style: "glassy" });
    expect(r.enhancedPrompt).toContain("glassy");
  });
});
