import { describe, it, expect } from "bun:test";
import { narrowEnum, narrowString, narrowBool, getProp } from "../../src/narrow";

describe("narrowEnum", () => {
  const ALLOWED = ["low", "medium", "high"] as const;

  it("returns the value when it is in allowed", () => {
    expect(narrowEnum("low", ALLOWED)).toBe("low");
    expect(narrowEnum("high", ALLOWED)).toBe("high");
  });

  it("returns undefined when value is not in allowed", () => {
    expect(narrowEnum("garbage", ALLOWED)).toBeUndefined();
  });

  it("returns undefined for non-string input", () => {
    expect(narrowEnum(42, ALLOWED)).toBeUndefined();
    expect(narrowEnum(null, ALLOWED)).toBeUndefined();
    expect(narrowEnum(undefined, ALLOWED)).toBeUndefined();
  });
});

describe("narrowString", () => {
  it("returns the string when input is a string", () => {
    expect(narrowString("hello")).toBe("hello");
    expect(narrowString("")).toBe("");
  });

  it("returns undefined for non-string input", () => {
    expect(narrowString(42)).toBeUndefined();
    expect(narrowString(null)).toBeUndefined();
    expect(narrowString(undefined)).toBeUndefined();
    expect(narrowString(true)).toBeUndefined();
  });
});

describe("narrowBool", () => {
  it("returns the boolean when input is a boolean", () => {
    expect(narrowBool(true)).toBe(true);
    expect(narrowBool(false)).toBe(false);
  });

  it("returns undefined for non-boolean input", () => {
    expect(narrowBool("true")).toBeUndefined();
    expect(narrowBool(1)).toBeUndefined();
    expect(narrowBool(null)).toBeUndefined();
    expect(narrowBool(undefined)).toBeUndefined();
  });
});

describe("getProp", () => {
  it("reads a property from a plain object", () => {
    expect(getProp({ a: 1 }, "a")).toBe(1);
    expect(getProp({ foo: "bar" }, "foo")).toBe("bar");
  });

  it("returns undefined for missing property", () => {
    expect(getProp({ a: 1 }, "b")).toBeUndefined();
  });

  it("returns undefined when input is not an object", () => {
    expect(getProp(null, "a")).toBeUndefined();
    expect(getProp(undefined, "a")).toBeUndefined();
    expect(getProp("string", "length")).toBeUndefined();
    expect(getProp(42, "toString")).toBeUndefined();
  });
});
