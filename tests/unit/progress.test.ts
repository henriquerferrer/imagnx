import { describe, it } from "vitest";
import { createProgress } from "../../src/progress.js";

describe("createProgress", () => {
  it("is a no-op when not a TTY", () => {
    const r = createProgress(["m1"], { isTTY: false, json: false });
    // The noop reporter is safe to call any number of times without side effects.
    r.start(); r.done("m1", true); r.stop();
  });

  it("is a no-op when --json is set, even on a TTY", () => {
    const r = createProgress(["m1"], { isTTY: true, json: true });
    r.start(); r.done("m1", true); r.stop();
  });

  it("is a no-op when IMAGNX_NO_PROGRESS is set", () => {
    const r = createProgress(["m1"], {
      isTTY: true,
      json: false,
      env: { IMAGNX_NO_PROGRESS: "1" },
    });
    r.start(); r.done("m1", true); r.stop();
  });

  it("is a no-op when there are no models", () => {
    const r = createProgress([], { isTTY: true, json: false });
    r.start(); r.stop();
  });
});
