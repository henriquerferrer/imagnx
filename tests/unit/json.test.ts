import { describe, it, expect } from "vitest";
import { formatJsonOutput, type SavedResult } from "../../src/json.js";

describe("formatJsonOutput", () => {
  it("produces results array and empty errors when all succeed", () => {
    const saved: SavedResult[] = [
      {
        path: "/tmp/a.png",
        modelId: "gpt-image-1.5",
        mimeType: "image/png",
      },
    ];
    const out = JSON.parse(formatJsonOutput(saved, []));
    expect(out.results).toHaveLength(1);
    expect(out.results[0].path).toBe("/tmp/a.png");
    expect(out.results[0].mimeType).toBe("image/png");
    expect(out.errors).toEqual([]);
  });

  it("includes errors when failures present", () => {
    const out = JSON.parse(
      formatJsonOutput(
        [],
        [{ modelId: "gemini-2.5-flash-image", message: "rate limited" }],
      ),
    );
    expect(out.results).toEqual([]);
    expect(out.errors[0].modelId).toBe("gemini-2.5-flash-image");
    expect(out.errors[0].message).toBe("rate limited");
  });
});
