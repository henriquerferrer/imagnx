import { describe, it, expect } from "vitest";
import {
  modelCapabilities,
  providerForModel,
  listModels,
  resolveModelId,
  validateRequest,
  validateAgainstCapabilities,
  KNOWN_MODELS,
  type ModelCapabilities,
} from "../../src/registry.js";
import { UnsupportedFeature, InvalidArgs } from "../../src/errors.js";

// Fabricated cap so we can exercise the "non-edit model" rejection path
// without keeping a disabled real model in the registry.
const NON_EDIT_CAP: ModelCapabilities = {
  modelId: "fake-non-edit",
  providerId: "openai",
  supportsEdit: false,
  supportsMask: false,
  validSizes: ["1024x1024"],
  defaultQuality: "auto",
  qualityValues: ["auto"],
  maxRefImages: 0,
};

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

  it("validateAgainstCapabilities rejects edit on non-edit model", () => {
    expect(() =>
      validateAgainstCapabilities(NON_EDIT_CAP, { kind: "edit", refCount: 1 }),
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

  it("validateRequest rejects mask with multiple ref images", () => {
    expect(() =>
      validateRequest("gpt-image-1.5", {
        kind: "edit",
        refCount: 2,
        hasMask: true,
      }),
    ).toThrow(InvalidArgs);
  });

  it("validateRequest accepts mask with exactly one ref image", () => {
    expect(() =>
      validateRequest("gpt-image-1.5", {
        kind: "edit",
        refCount: 1,
        hasMask: true,
      }),
    ).not.toThrow();
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

  it("gpt-image-2 accepts a custom WxH within constraints", () => {
    expect(() =>
      validateRequest("gpt-image-2", { kind: "generate", size: "1280x720" }),
    ).not.toThrow();
  });

  it("gpt-image-2 rejects custom size with non-16-multiple edge", () => {
    expect(() =>
      validateRequest("gpt-image-2", { kind: "generate", size: "1281x720" }),
    ).toThrow(/multiples of 16/);
  });

  it("gpt-image-2 rejects custom size exceeding max edge", () => {
    expect(() =>
      validateRequest("gpt-image-2", { kind: "generate", size: "4096x1024" }),
    ).toThrow(/max 3840/);
  });

  it("gpt-image-2 rejects custom size with aspect ratio over 3:1", () => {
    expect(() =>
      validateRequest("gpt-image-2", { kind: "generate", size: "3840x1024" }),
    ).toThrow(/aspect/);
  });

  it("gpt-image-2 rejects custom size below min total pixels", () => {
    expect(() =>
      validateRequest("gpt-image-2", { kind: "generate", size: "256x256" }),
    ).toThrow(/total pixels/);
  });

  it("gpt-image-1.5 rejects custom WxH (no customSize capability)", () => {
    expect(() =>
      validateRequest("gpt-image-1.5", { kind: "generate", size: "1280x720" }),
    ).toThrow(/does not support size/);
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
