import { describe, it, expect } from "vitest";
import { buildFinalIconPrompt } from "../../src/icon-prompt.js";

describe("buildFinalIconPrompt", () => {
  it("plain prompt: includes subject, base context, technical constraints", () => {
    const out = buildFinalIconPrompt({ prompt: "weather app" });
    expect(out).toContain("Subject: weather app");
    expect(out).toContain("Square 1:1 aspect ratio.");
    expect(out).toContain("Technical constraints:");
    // default look guardrail must apply when no glossy keyword present
    expect(out).toContain("Default-look guardrail");
  });

  it("--raw-prompt with no style returns the prompt verbatim", () => {
    expect(buildFinalIconPrompt({ prompt: "weather app", rawPrompt: true })).toBe("weather app");
  });

  it("--raw-prompt with a preset still applies style as dominant", () => {
    const out = buildFinalIconPrompt({
      prompt: "weather app",
      rawPrompt: true,
      style: "minimalism",
    });
    expect(out).toContain("STYLE PRESET (dominant): minimalism");
    expect(out).toContain("User prompt: weather app");
    expect(out).not.toContain("Square 1:1 aspect ratio");
  });

  it("--use-icon-words switches the artwork noun", () => {
    const off = buildFinalIconPrompt({ prompt: "weather app" });
    const on = buildFinalIconPrompt({ prompt: "weather app", useIconWords: true });
    expect(off).toContain("Create a 1024x1024 square symbol illustration.");
    expect(on).toContain("icon-style, but not an app launcher tile");
  });

  it("--style preset is woven in as a hard constraint", () => {
    const out = buildFinalIconPrompt({ prompt: "weather app", style: "minimalism" });
    expect(out).toContain("Primary style preset (dominant): minimalism");
    expect(out).toContain("HARD constraint");
  });

  it("free-form style applies as soft hint", () => {
    const out = buildFinalIconPrompt({ prompt: "weather app", style: "made of moss" });
    expect(out).toContain("Style: made of moss");
  });

  it("isDefaultLook drops matte guardrails when prompt mentions glassy keywords", () => {
    const out = buildFinalIconPrompt({ prompt: "neon glow weather widget" });
    expect(out).not.toContain("Default-look guardrail");
  });
});
