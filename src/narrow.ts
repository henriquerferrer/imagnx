/**
 * Narrow a string to a known literal-union type via membership check.
 * Returns the value typed as T if it's in `allowed`, else undefined.
 */
export function narrowEnum<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
): T | undefined {
  if (typeof value !== "string") return undefined;
  return (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : undefined;
}

/**
 * Return value if it's a string, else undefined. (No coercion.)
 */
export function narrowString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Return value if it's a boolean, else undefined.
 */
export function narrowBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Read a property off an unknown value safely.
 * Returns undefined if value is not an object or property is missing.
 */
export function getProp(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) return undefined;
  return (obj as Record<string, unknown>)[key];
}
