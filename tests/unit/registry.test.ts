import { describe, it, expect } from "vitest";
import {
  modelCapabilities,
  providerForModel,
  listModels,
  resolveModelId,
  validateRequest,
  KNOWN_MODELS,
} from "../../src/registry.js";
import { UnsupportedFeature, InvalidArgs } from "../../src/errors.js";

describe("registry", () => {
  it("KNOWN_MODELS lists all supported model IDs", () => {
    expect(KNOWN_MODELS).toContain("gpt-image-1.5");
    expect(KNOWN_MODELS).toContain("gemini-2.5-flash-image");
  });

  it("modelCapabilities returns details for known model", () => {
    const c = modelCapabilities("gpt-image-1.5");
    expect(c.supportsEdit).toBe(true);
    expect(c.supportsMask).toBe(true);
    expect(c.validSizes).toContain("1024x1024");
    expect(c.maxRefImages).toBeGreaterThan(0);
  });

  it("modelCapabilities throws for unknown model", () => {
    expect(() => modelCapabilities("not-a-model")).toThrow(InvalidArgs);
  });

  it("providerForModel returns provider id", () => {
    expect(providerForModel("gpt-image-1.5")).toBe("openai");
    expect(providerForModel("gemini-2.5-flash-image")).toBe("google");
  });

  it("listModels groups by provider", () => {
    const grouped = listModels();
    expect(grouped.openai).toContain("gpt-image-1.5");
    expect(grouped.google).toContain("gemini-2.5-flash-image");
  });

  it("validateRequest accepts valid generation", () => {
    expect(() =>
      validateRequest("gpt-image-1.5", {
        kind: "generate",
        size: "1024x1024",
      }),
    ).not.toThrow();
  });

  it("validateRequest rejects edit on non-edit model", () => {
    expect(() =>
      validateRequest("dall-e-3", { kind: "edit", refCount: 1 }),
    ).toThrow(UnsupportedFeature);
  });

  it("validateRequest rejects mask on non-mask model", () => {
    expect(() =>
      validateRequest("gemini-2.5-flash-image", {
        kind: "edit",
        refCount: 1,
        hasMask: true,
      }),
    ).toThrow(UnsupportedFeature);
  });

  it("validateRequest rejects invalid size", () => {
    expect(() =>
      validateRequest("gpt-image-1.5", { kind: "generate", size: "999x999" }),
    ).toThrow(InvalidArgs);
  });

  it("validateRequest rejects too many refs", () => {
    expect(() =>
      validateRequest("gpt-image-1.5", { kind: "edit", refCount: 999 }),
    ).toThrow(InvalidArgs);
  });

  it("KNOWN_MODELS contains gpt-image-2", () => {
    expect(KNOWN_MODELS).toContain("gpt-image-2");
  });

  it("gpt-image-2 supports the new size presets", () => {
    const c = modelCapabilities("gpt-image-2");
    expect(c.validSizes).toContain("2048x2048");
    expect(c.validSizes).toContain("3840x2160");
  });

  it("resolveModelId maps nano-banana to gemini-2.5-flash-image", () => {
    expect(resolveModelId("nano-banana")).toBe("gemini-2.5-flash-image");
  });

  it("resolveModelId is identity for unknown ids", () => {
    expect(resolveModelId("gpt-image-1.5")).toBe("gpt-image-1.5");
    expect(resolveModelId("not-a-model")).toBe("not-a-model");
  });

  it("modelCapabilities resolves nano-banana alias", () => {
    const c = modelCapabilities("nano-banana");
    expect(c.modelId).toBe("gemini-2.5-flash-image");
    expect(c.providerId).toBe("google");
  });

  it("providerForModel resolves nano-banana alias", () => {
    expect(providerForModel("nano-banana")).toBe("google");
  });
});

describe("registry invariants", () => {
  it("every model's defaultQuality is contained in its qualityValues", () => {
    for (const modelId of KNOWN_MODELS) {
      const c = modelCapabilities(modelId);
      expect(c.qualityValues).toContain(c.defaultQuality);
    }
  });
});
