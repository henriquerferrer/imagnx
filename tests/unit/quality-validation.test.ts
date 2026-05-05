import { describe, it, expect } from "vitest";
import { validateRequest } from "../../src/registry.js";
import { InvalidArgs } from "../../src/errors.js";

const cases: Array<[string, string, "ok" | "throws"]> = [
  ["gpt-image-1.5", "high", "ok"],
  ["gpt-image-1.5", "auto", "ok"],
  ["gpt-image-1.5", "1k", "throws"],
  ["gpt-image-2", "low", "ok"],
  ["gemini-2.5-flash-image", "auto", "ok"],
  ["gemini-2.5-flash-image", "high", "throws"],
  ["gemini-3-pro-image-preview", "1k", "ok"],
  ["gemini-3-pro-image-preview", "2k", "ok"],
  ["gemini-3-pro-image-preview", "4k", "ok"],
  ["gemini-3-pro-image-preview", "high", "throws"],
];

describe("validateRequest quality enforcement", () => {
  for (const [model, quality, expected] of cases) {
    it(`${model} + quality=${quality} → ${expected}`, () => {
      const fn = () =>
        validateRequest(model, { kind: "generate", quality: quality as never });
      if (expected === "ok") expect(fn).not.toThrow();
      else expect(fn).toThrow(InvalidArgs);
    });
  }
});
