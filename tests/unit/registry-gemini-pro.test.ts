import { describe, it, expect } from "vitest";
import {
  modelCapabilities,
  resolveModelId,
  KNOWN_MODELS,
  providerForModel,
} from "../../src/registry.js";

describe("gemini-3-pro-image-preview registration", () => {
  it("is in KNOWN_MODELS", () => {
    expect(KNOWN_MODELS).toContain("gemini-3-pro-image-preview");
  });

  it("nano-banana-pro alias resolves", () => {
    expect(resolveModelId("nano-banana-pro")).toBe("gemini-3-pro-image-preview");
  });

  it("has google provider id and supports edit", () => {
    const c = modelCapabilities("gemini-3-pro-image-preview");
    expect(c.providerId).toBe("google");
    expect(c.supportsEdit).toBe(true);
    expect(c.supportsMask).toBe(false);
  });

  it("declares 1k/2k/4k as valid quality tier values", () => {
    const c = modelCapabilities("gemini-3-pro-image-preview");
    expect(c.qualityValues).toEqual(["1k", "2k", "4k"]);
  });

  it("default quality is 1k", () => {
    expect(modelCapabilities("gemini-3-pro-image-preview").defaultQuality).toBe("1k");
  });

  it("providerForModel resolves alias", () => {
    expect(providerForModel("nano-banana-pro")).toBe("google");
  });
});
