import { describe, it, expect } from "vitest";
import {
  STYLE_DEFINITIONS,
  getAvailableStyles,
  getStyleDirective,
  getStyleDescription,
  validateStyleForCommand,
  type StyleId,
} from "../../src/styles.js";
import { InvalidArgs } from "../../src/errors.js";

const ALL_STYLES: StyleId[] = [
  "minimalism", "glassy", "woven", "geometric", "neon", "gradient",
  "flat", "material", "ios-classic", "android-material", "pixel",
  "game", "clay", "holographic", "kawaii", "cute",
];

describe("styles library", () => {
  it("defines all 16 presets", () => {
    expect(Object.keys(STYLE_DEFINITIONS).sort()).toEqual([...ALL_STYLES].sort());
  });

  it("each preset has a non-empty appliesTo array", () => {
    for (const id of ALL_STYLES) {
      expect(STYLE_DEFINITIONS[id].appliesTo.length).toBeGreaterThan(0);
    }
  });

  it("getAvailableStyles('icon') returns all 16", () => {
    expect(getAvailableStyles("icon").sort()).toEqual([...ALL_STYLES].sort());
  });

  it("getAvailableStyles('generate') returns the 7 universal presets", () => {
    expect(getAvailableStyles("generate").sort()).toEqual([
      "flat", "holographic", "kawaii", "material", "minimalism", "neon", "pixel",
    ]);
  });

  it("getAvailableStyles('edit') matches generate", () => {
    expect(getAvailableStyles("edit").sort()).toEqual(getAvailableStyles("generate").sort());
  });

  it("getStyleDirective returns a non-empty string for every preset", () => {
    for (const id of ALL_STYLES) {
      expect(getStyleDirective(id).length).toBeGreaterThan(10);
    }
  });

  it("getStyleDirective produces a rich inline block with SnapAI-shape sections", () => {
    const directive = getStyleDirective("minimalism");
    expect(directive).toContain("Style system: MINIMALISM.");
    expect(directive).toContain("Cultural DNA:");
    expect(directive).toContain("Visual traits:");
    expect(directive).toContain("Mandatory:");
    expect(directive).toContain("Forbidden:");
    expect(directive).toContain("Checklist:");
  });

  it("getStyleDirective derives systemName for kebab-case ids", () => {
    expect(getStyleDirective("ios-classic")).toContain("Style system: IOS_CLASSIC.");
    expect(getStyleDirective("android-material")).toContain("Style system: ANDROID_MATERIAL.");
  });

  it("getStyleDescription returns the long summary (SnapAI semantics)", () => {
    // summary is multi-sentence marketing copy, much longer than the short `description`
    expect(getStyleDescription("minimalism").length).toBeGreaterThan(80);
    expect(getStyleDescription("minimalism")).toContain("monochrome");
  });
});

describe("validateStyleForCommand", () => {
  it("accepts a universal preset on any command", () => {
    expect(validateStyleForCommand("minimalism", "generate")).toBe("minimalism");
    expect(validateStyleForCommand("minimalism", "icon")).toBe("minimalism");
    expect(validateStyleForCommand("minimalism", "edit")).toBe("minimalism");
  });

  it("accepts an icon-only preset on icon", () => {
    expect(validateStyleForCommand("glassy", "icon")).toBe("glassy");
  });

  it("rejects an icon-only preset on generate", () => {
    expect(() => validateStyleForCommand("glassy", "generate")).toThrow(InvalidArgs);
    try {
      validateStyleForCommand("glassy", "generate");
    } catch (e) {
      expect((e as Error).message).toContain("'glassy' only supported on: icon");
    }
  });

  it("rejects unknown style with a list of valid names", () => {
    expect(() => validateStyleForCommand("foobar", "icon")).toThrow(/unknown style 'foobar'/);
  });

  it("normalizes case", () => {
    expect(validateStyleForCommand("Minimalism", "icon")).toBe("minimalism");
  });
});
