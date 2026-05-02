import { describe, it, expect } from "vitest";
import {
  ImgenError,
  MissingApiKey,
  UnsupportedFeature,
  InvalidArgs,
  RateLimited,
  ProviderError,
  PartialFailure,
  exitCodeFor,
} from "../../src/errors.js";

describe("errors", () => {
  it("each error class exposes exit code", () => {
    expect(new MissingApiKey("OPENAI_API_KEY").exitCode).toBe(2);
    expect(new UnsupportedFeature("gpt-image-1.5", "mask").exitCode).toBe(3);
    expect(new InvalidArgs("--bad").exitCode).toBe(4);
    expect(new RateLimited("openai").exitCode).toBe(5);
    expect(new ProviderError("openai", "bad request").exitCode).toBe(6);
    expect(new PartialFailure([], []).exitCode).toBe(7);
  });

  it("MissingApiKey carries env var name", () => {
    const e = new MissingApiKey("OPENAI_API_KEY");
    expect(e.envVar).toBe("OPENAI_API_KEY");
    expect(e.message).toContain("OPENAI_API_KEY");
  });

  it("UnsupportedFeature names model and feature", () => {
    const e = new UnsupportedFeature("gpt-image-1.5", "mask");
    expect(e.message).toContain("gpt-image-1.5");
    expect(e.message).toContain("mask");
  });

  it("exitCodeFor returns 1 for unknown errors", () => {
    expect(exitCodeFor(new Error("boom"))).toBe(1);
    expect(exitCodeFor(new InvalidArgs("x"))).toBe(4);
  });

  it("ImgenError instances are detectable", () => {
    expect(new MissingApiKey("X")).toBeInstanceOf(ImgenError);
  });
});
