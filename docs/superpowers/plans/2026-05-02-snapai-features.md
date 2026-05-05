# SnapAI Feature Absorption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `imagnx icon` subcommand with multi-layer prompt enhancement, ship a 16-entry generic `--style` preset library with subcommand-scoped allowlists, support `gemini-3-pro-image-preview` (alias `nano-banana-pro`), and add four DX flags (`--style`, `--prompt-only`, `--raw-prompt`, `--use-icon-words`).

**Architecture:** New files isolate the new behavior — `src/styles.ts` (preset library + validation), `src/icon-prompt.ts` (multi-layer prompt builder, ported from SnapAI MIT), `src/commands/icon.ts` (citty subcommand). `src/cli.ts` only registers the new subcommand and adds `--style` to existing generate/edit. Existing handlers are not refactored. Quality validation becomes model-aware in the registry, since `gemini-3-pro-image-preview` uses tier values (`1k`/`2k`/`4k`) instead of OpenAI's `low/medium/high/auto`.

**Tech Stack:** TypeScript, Node ≥18, citty (CLI parsing), vitest (tests), `@iarna/toml`/`yaml` (config). No new runtime deps.

**Spec:** [`docs/superpowers/specs/2026-05-02-snapai-features-design.md`](../specs/2026-05-02-snapai-features-design.md)

**Source porting URLs (SnapAI, MIT):**
- `https://raw.githubusercontent.com/betomoedano/snapai/main/src/utils/styleTemplates.ts`
- `https://raw.githubusercontent.com/betomoedano/snapai/main/src/utils/icon-prompt.ts`

---

## Task 1: Style preset library (`src/styles.ts`)

**Files:**
- Create: `src/styles.ts`
- Test: `tests/unit/styles.test.ts`

- [ ] **Step 1: Write the failing structural test**

Create `tests/unit/styles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  STYLE_DEFINITIONS,
  getAvailableStyles,
  getStyleDirective,
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/styles.test.ts`
Expected: FAIL with "Cannot find module '../../src/styles.js'"

- [ ] **Step 3: Create `src/styles.ts` — types + helpers skeleton**

Create the file with the type definitions and helpers, leaving `STYLE_DEFINITIONS` as a stub:

```typescript
// Style preset library. Ported (with adaptations) from SnapAI's
// src/utils/styleTemplates.ts (MIT, https://github.com/betomoedano/snapai).
import { InvalidArgs } from "./errors.js";

export type StyleId =
  | "minimalism" | "glassy" | "woven" | "geometric" | "neon" | "gradient"
  | "flat" | "material" | "ios-classic" | "android-material" | "pixel"
  | "game" | "clay" | "holographic" | "kawaii" | "cute";

export type StyleCommand = "generate" | "icon" | "edit";

export interface StyleDefinition {
  readonly id: StyleId;
  readonly summary: string;
  readonly appliesTo: ReadonlyArray<StyleCommand>;
  readonly culturalDna?: ReadonlyArray<string>;
  readonly description?: string;
  readonly visualTraits?: ReadonlyArray<string>;
  readonly mandatory?: ReadonlyArray<string>;
  readonly forbidden?: ReadonlyArray<string>;
  readonly avoid?: ReadonlyArray<string>;
  readonly checklist?: ReadonlyArray<string>;
  readonly includeBaseRules?: boolean;
}

// Universal presets work everywhere; the rest are icon-only.
const UNIVERSAL: ReadonlySet<StyleId> = new Set([
  "minimalism", "flat", "pixel", "kawaii", "neon", "holographic", "material",
]);

function appliesToFor(id: StyleId): ReadonlyArray<StyleCommand> {
  return UNIVERSAL.has(id) ? ["generate", "icon", "edit"] : ["icon"];
}

export const STYLE_DEFINITIONS: Record<StyleId, StyleDefinition> = {
  // FILLED IN STEP 5
} as Record<StyleId, StyleDefinition>;

export function getAvailableStyles(forCommand?: StyleCommand): StyleId[] {
  const all = Object.keys(STYLE_DEFINITIONS) as StyleId[];
  if (!forCommand) return all;
  return all.filter((id) => STYLE_DEFINITIONS[id].appliesTo.includes(forCommand));
}

export function getStyleDirective(id: StyleId): string {
  const def = STYLE_DEFINITIONS[id];
  if (!def) throw new InvalidArgs(`Unknown style "${id}"`);
  // Compose a single-paragraph directive from the structured fields.
  const parts: string[] = [def.summary];
  if (def.mandatory?.length) parts.push(`MUST: ${def.mandatory.join("; ")}.`);
  if (def.forbidden?.length) parts.push(`MUST NOT: ${def.forbidden.join("; ")}.`);
  return parts.join(" ");
}

export function getStyleDescription(id: StyleId): string {
  const def = STYLE_DEFINITIONS[id];
  if (!def) throw new InvalidArgs(`Unknown style "${id}"`);
  return def.description ?? def.summary;
}

export function validateStyleForCommand(name: string, command: StyleCommand): StyleId {
  const lower = name.trim().toLowerCase() as StyleId;
  const def = STYLE_DEFINITIONS[lower];
  if (!def) {
    throw new InvalidArgs(
      `unknown style '${name}'; valid: ${(Object.keys(STYLE_DEFINITIONS) as StyleId[]).join(", ")}`,
    );
  }
  if (!def.appliesTo.includes(command)) {
    throw new InvalidArgs(
      `'${lower}' only supported on: ${def.appliesTo.join(", ")}`,
    );
  }
  return lower;
}
```

- [ ] **Step 4: Fill in `STYLE_DEFINITIONS` from SnapAI**

Fetch the source data:

```bash
curl -fsSL https://raw.githubusercontent.com/betomoedano/snapai/main/src/utils/styleTemplates.ts > /tmp/snapai-styles.ts
```

Open `/tmp/snapai-styles.ts`. The file exports `STYLE_DEFINITIONS: Record<IconStyle, StyleDefinition>`. For each of the 16 entries, copy its structured fields (`id`, `summary`, `culturalDna`, `description`, `visualTraits`, `mandatory`, `forbidden`, `avoid`, `checklist`, `includeBaseRules`) into `src/styles.ts` and add `appliesTo: appliesToFor("<id>")` immediately after `id`. Do **not** copy `systemName` (we don't use it).

Resulting shape per entry:

```typescript
minimalism: {
  id: "minimalism",
  appliesTo: appliesToFor("minimalism"),
  summary: "Extreme reduction for clarity and function (Swiss/Braun/Apple). One dominant symbol, max 3 colors, must work in monochrome and remain readable at tiny sizes. No gradients, shadows, textures, or 3D.",
  culturalDna: ["Swiss design", "Apple", "Braun", "Dieter Rams", "Functionalism"],
  description: "Extreme reduction focused on clarity and function.",
  visualTraits: ["max 3 colors", "simple primary silhouettes", "large negative space", "textures: false", "effects: false"],
  mandatory: ["Must be readable at very small sizes", "Must work in monochrome", "Single dominant symbol"],
  forbidden: ["Gradients", "Shadows", "3D effects", "Decorative details", "Textures"],
  avoid: ["Over-design", "Complex metaphors", "Visual noise"],
  checklist: ["Can it be drawn in under 5 strokes?", "Is it clear without color?", "Is it recognizable at 24px?"],
  includeBaseRules: true,
},
```

Repeat for all 16. The MIT header at the top of `src/styles.ts` already attributes SnapAI.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/styles.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Add allowlist enforcement tests**

Append to `tests/unit/styles.test.ts`:

```typescript
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
```

- [ ] **Step 7: Run the full file**

Run: `npx vitest run tests/unit/styles.test.ts`
Expected: PASS (11 tests total).

- [ ] **Step 8: Commit**

```bash
git add src/styles.ts tests/unit/styles.test.ts
git commit -m "feat(styles): add 16-preset style library with appliesTo allowlist

Ports SnapAI's styleTemplates.ts (MIT) into src/styles.ts. Each
preset declares which subcommands accept it. Universal presets work
on generate/icon/edit; the rest are icon-only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Icon prompt builder (`src/icon-prompt.ts`)

**Files:**
- Create: `src/icon-prompt.ts`
- Test: `tests/unit/icon-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/icon-prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildFinalIconPrompt } from "../../src/icon-prompt.js";

describe("buildFinalIconPrompt", () => {
  it("plain prompt: includes subject, base context, technical constraints", () => {
    const out = buildFinalIconPrompt({ prompt: "weather app" });
    expect(out).toContain("Subject: weather app");
    expect(out).toContain("Square 1:1 aspect ratio.");
    expect(out).toContain("Technical constraints:");
    // default look guardrail must apply when no glossy keyword present
    expect(out).toContain("Default-look guardrail");
  });

  it("--raw-prompt with no style returns the prompt verbatim", () => {
    expect(buildFinalIconPrompt({ prompt: "weather app", rawPrompt: true })).toBe("weather app");
  });

  it("--raw-prompt with a preset still applies style as dominant", () => {
    const out = buildFinalIconPrompt({
      prompt: "weather app",
      rawPrompt: true,
      style: "minimalism",
    });
    expect(out).toContain("STYLE PRESET (dominant): minimalism");
    expect(out).toContain("User prompt: weather app");
    expect(out).not.toContain("Square 1:1 aspect ratio");
  });

  it("--use-icon-words switches the artwork noun", () => {
    const off = buildFinalIconPrompt({ prompt: "weather app" });
    const on = buildFinalIconPrompt({ prompt: "weather app", useIconWords: true });
    expect(off).toContain("Create a 1024x1024 square symbol illustration.");
    expect(on).toContain("icon-style, but not an app launcher tile");
  });

  it("--style preset is woven in as a hard constraint", () => {
    const out = buildFinalIconPrompt({ prompt: "weather app", style: "minimalism" });
    expect(out).toContain("Primary style preset (dominant): minimalism");
    expect(out).toContain("HARD constraint");
  });

  it("free-form style applies as soft hint", () => {
    const out = buildFinalIconPrompt({ prompt: "weather app", style: "made of moss" });
    expect(out).toContain("Style: made of moss");
  });

  it("isDefaultLook drops matte guardrails when prompt mentions glassy keywords", () => {
    const out = buildFinalIconPrompt({ prompt: "neon glow weather widget" });
    expect(out).not.toContain("Default-look guardrail");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/icon-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Port the file from SnapAI**

Fetch the source:

```bash
curl -fsSL https://raw.githubusercontent.com/betomoedano/snapai/main/src/utils/icon-prompt.ts > /tmp/snapai-icon-prompt.ts
```

Create `src/icon-prompt.ts`. Copy `/tmp/snapai-icon-prompt.ts` verbatim with these adjustments:

1. Replace the import line:
   ```typescript
   import { StyleTemplates, type IconStyle } from "./styleTemplates.js";
   ```
   With:
   ```typescript
   // Multi-layer prompt builder. Ported from SnapAI's src/utils/icon-prompt.ts
   // (MIT, https://github.com/betomoedano/snapai).
   import {
     STYLE_DEFINITIONS,
     getStyleDirective,
     getStyleDescription,
     getAvailableStyles,
     type StyleId,
   } from "./styles.js";
   ```

2. Replace the `IconStyle` type alias usage with `StyleId`. There should be exactly one occurrence inside `resolveStylePreset`.

3. Replace `StyleTemplates.getAvailableStyles()` with `getAvailableStyles("icon")`.

4. Replace `StyleTemplates.getStyleDirective(...)` with `getStyleDirective(...)`.

5. Replace `StyleTemplates.getStyleDescription(...)` with `getStyleDescription(...)`.

6. Keep everything else (the constants, the layer composition, the `isDefaultLook` heuristic, the function signature) identical.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/icon-prompt.test.ts`
Expected: PASS (7 tests).

If any assertion fails, the difference is most likely in the literal strings emitted by the SnapAI source. Update test expectations to match the ported file's actual output rather than rewriting the port.

- [ ] **Step 5: Commit**

```bash
git add src/icon-prompt.ts tests/unit/icon-prompt.test.ts
git commit -m "feat(icon-prompt): port SnapAI multi-layer prompt builder

Ports SnapAI's src/utils/icon-prompt.ts (MIT). Builds three-layer
prompt: concept + art-direction, technical constraints, optional
style enforcement. Routes through src/styles.ts for preset lookup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Register `gemini-3-pro-image-preview` model

**Files:**
- Modify: `src/registry.ts`
- Modify: `src/providers/gemini.ts:104` (`models` array)
- Test: `tests/unit/registry-gemini-pro.test.ts`

- [ ] **Step 1: Write the failing registry test**

Create `tests/unit/registry-gemini-pro.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/registry-gemini-pro.test.ts`
Expected: FAIL — model not registered, `qualityValues` not on `ModelCapabilities`.

- [ ] **Step 3: Broaden `Quality` type**

Edit `src/providers/types.ts:11`:

```typescript
// before
export type Quality = "low" | "medium" | "high" | "auto";

// after
export type Quality = "low" | "medium" | "high" | "auto" | "1k" | "2k" | "4k";
```

- [ ] **Step 4: Add `qualityValues` to `ModelCapabilities` and update entries**

Edit `src/registry.ts`. Add a new field to the interface (between `defaultQuality` and `maxRefImages`):

```typescript
export interface ModelCapabilities {
  modelId: string;
  providerId: "openai" | "google";
  supportsEdit: boolean;
  supportsMask: boolean;
  validSizes: ReadonlyArray<Size>;
  defaultQuality: Quality;
  qualityValues: ReadonlyArray<Quality>;   // NEW
  maxRefImages: number;
  enabled?: boolean;
}
```

For each existing CAPABILITIES entry, add `qualityValues`:

- `gpt-image-1.5`, `gpt-image-2`: `qualityValues: ["low", "medium", "high", "auto"]`
- `dall-e-3`: `qualityValues: ["auto"]` (placeholder; entry is disabled)
- `gemini-2.5-flash-image`: `qualityValues: ["auto"]`

Add the new model entry alongside the others:

```typescript
"gemini-3-pro-image-preview": {
  modelId: "gemini-3-pro-image-preview",
  providerId: "google",
  supportsEdit: true,
  supportsMask: false,
  validSizes: ["auto", "1024x1024"],
  defaultQuality: "1k",
  qualityValues: ["1k", "2k", "4k"],
  maxRefImages: 8,
},
```

Add to `ALIASES`:

```typescript
const ALIASES: Record<string, string> = {
  "nano-banana": "gemini-2.5-flash-image",
  "nano-banana-pro": "gemini-3-pro-image-preview",
};
```

- [ ] **Step 5: Update gemini provider's `models` declaration**

Edit `src/providers/gemini.ts:104`:

```typescript
// before
models: ["gemini-2.5-flash-image"],

// after
models: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
```

- [ ] **Step 6: Run all unit tests**

Run: `npx vitest run tests/unit`
Expected: existing tests still pass, new `registry-gemini-pro.test.ts` passes (6 tests). If the typecheck step in `package.json` is part of CI, also run:

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/providers/types.ts src/registry.ts src/providers/gemini.ts \
  tests/unit/registry-gemini-pro.test.ts
git commit -m "feat(registry): add gemini-3-pro-image-preview (alias nano-banana-pro)

New Google model with quality tiers 1k/2k/4k and multi-image support.
Adds qualityValues to ModelCapabilities so per-model quality
validation works.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Model-aware quality validation

**Files:**
- Modify: `src/registry.ts` (`validateRequest`)
- Modify: `src/cli.ts:100-109` (`narrowQualityFlag`)
- Modify: `src/config.ts:34` (`VALID_QUALITIES`)
- Test: `tests/unit/quality-validation.test.ts`

- [ ] **Step 1: Write failing table-driven test**

Create `tests/unit/quality-validation.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/quality-validation.test.ts`
Expected: FAIL — `validateRequest` does not currently accept `quality` and does not enforce it.

- [ ] **Step 3: Extend `ValidationRequest` to carry quality**

Edit `src/registry.ts`. Update `ValidationRequest`:

```typescript
export type ValidationRequest =
  | { kind: "generate"; size?: Size; quality?: Quality }
  | { kind: "edit"; refCount: number; size?: Size; hasMask?: boolean; quality?: Quality };
```

In `validateRequest`, after the existing size check, add:

```typescript
if (req.quality !== undefined && !cap.qualityValues.includes(req.quality)) {
  throw new InvalidArgs(
    `'${req.quality}' not valid for ${modelId}; valid: ${cap.qualityValues.join(", ")}`,
  );
}
```

- [ ] **Step 4: Run quality tests**

Run: `npx vitest run tests/unit/quality-validation.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Update `narrowQualityFlag` in cli.ts to accept new tier values + aliases**

Edit `src/cli.ts:100-109`:

```typescript
function narrowQualityFlag(raw: string | undefined): Quality | undefined {
  if (raw === undefined) return undefined;
  // Aliases (DALL-E vocabulary some users still type)
  const aliased = raw === "hd" ? "high" : raw === "standard" ? "medium" : raw;
  const v = narrowEnum(aliased, VALID_QUALITIES);
  if (v === undefined) {
    throw new InvalidArgs(
      `--quality "${raw}" is not a known value. Valid: ${VALID_QUALITIES.join(", ")}`,
    );
  }
  return v;
}
```

(Per-model rejection happens later in `validateRequest`. This function only checks "is this a recognized string at all".)

- [ ] **Step 6: Extend `VALID_QUALITIES` in config.ts**

Edit `src/config.ts:34`:

```typescript
export const VALID_QUALITIES: ReadonlyArray<Quality> = [
  "low", "medium", "high", "auto", "1k", "2k", "4k",
];
```

- [ ] **Step 7: Wire `quality` into existing `validateRequest` calls**

Edit `src/cli.ts` — in `runGenerate` (around line 224) and `runEdit` (around line 273), pass `quality` into the validation call:

```typescript
// runGenerate
validateRequest(modelId, { kind: "generate", size, quality });

// runEdit
validateRequest(modelId, {
  kind: "edit",
  refCount: refImages.length,
  size,
  hasMask: !!mask,
  quality,
});
```

- [ ] **Step 8: Run all tests + typecheck**

Run: `npx vitest run tests/unit && npm run typecheck`
Expected: all pass. (Alias coverage — `hd`→`high`, `standard`→`medium` — is exercised through CLI integration tests in Task 7.)

- [ ] **Step 9: Commit**

```bash
git add src/registry.ts src/cli.ts src/config.ts tests/unit/quality-validation.test.ts
git commit -m "feat(registry): model-aware quality validation

Each ModelCapabilities entry now declares qualityValues. validateRequest
enforces per-model quality with a clear error. CLI narrows hd→high and
standard→medium aliases at the boundary.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Gemini provider — pro-tier handling

**Files:**
- Modify: `src/providers/gemini.ts`
- Test: `tests/integration/gemini.test.ts` (extend existing)

- [ ] **Step 1: Inspect existing gemini integration tests**

Run: `cat tests/integration/gemini.test.ts`

This file mocks `fetch` via `tests/helpers/fetch-mock.ts`. The new test will follow the same pattern.

- [ ] **Step 2: Write a failing test for the pro endpoint + tier mapping**

Append to `tests/integration/gemini.test.ts`:

```typescript
describe("gemini-3-pro-image-preview", () => {
  it("calls the pro model endpoint and forwards quality tier", async () => {
    const mock = installFetchMock([
      jsonResponse({
        candidates: [{
          content: {
            parts: [{
              inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" },
            }],
          },
        }],
      }),
    ]);
    const provider = createGeminiProvider({ apiKey: "k" });
    await provider.generate("gemini-3-pro-image-preview", {
      prompt: "icon test", quality: "2k",
    });
    expect(mock.calls[0]!.url).toContain("/models/gemini-3-pro-image-preview:generateContent");
    const body = JSON.parse(mock.calls[0]!.init.body);
    // SnapAI's wire format: generationConfig.imageConfig.imageSize, uppercased.
    expect(body.generationConfig.imageConfig.imageSize).toBe("2K");
  });

  it("defaults to 1K when no quality given", async () => {
    const mock = installFetchMock([
      jsonResponse({
        candidates: [{
          content: { parts: [{ inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } }] },
        }],
      }),
    ]);
    const provider = createGeminiProvider({ apiKey: "k" });
    await provider.generate("gemini-3-pro-image-preview", { prompt: "icon test" });
    const body = JSON.parse(mock.calls[0]!.init.body);
    expect(body.generationConfig.imageConfig.imageSize).toBe("1K");
  });

  it("does not add imageConfig for gemini-2.5-flash-image", async () => {
    const mock = installFetchMock([
      jsonResponse({
        candidates: [{
          content: { parts: [{ inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } }] },
        }],
      }),
    ]);
    const provider = createGeminiProvider({ apiKey: "k" });
    await provider.generate("gemini-2.5-flash-image", { prompt: "x", quality: "auto" });
    const body = JSON.parse(mock.calls[0]!.init.body);
    expect(body.generationConfig.imageConfig).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npx vitest run tests/integration/gemini.test.ts`
Expected: FAIL — current `call()` doesn't include quality in the body.

- [ ] **Step 4: Add tier mapping to the gemini provider**

Edit `src/providers/gemini.ts`. Modify `call()` to accept an optional `extraConfig` and the `generate`/`edit` wrappers to populate it for pro:

```typescript
const PRO_MODEL = "gemini-3-pro-image-preview";

function isPro(modelId: string): boolean {
  return modelId === PRO_MODEL;
}

function imageConfigFor(modelId: string, quality?: string): Record<string, unknown> | undefined {
  if (!isPro(modelId)) return undefined;
  const tier = quality && ["1k", "2k", "4k"].includes(quality) ? quality : "1k";
  // SnapAI's wire format (src/services/gemini.ts): { imageConfig: { imageSize: "1K" | "2K" | "4K" } }.
  return { imageConfig: { imageSize: tier.toUpperCase() } };
}

async function call(
  modelId: string,
  parts: Array<Record<string, unknown>>,
  promptForResult: string,
  extraConfig?: Record<string, unknown>,
): Promise<ImageResult[]> {
  const url = `${baseUrl}/models/${modelId}:generateContent`;
  const generationConfig = {
    responseModalities: ["IMAGE"],
    ...(extraConfig ?? {}),
  };
  const body = { contents: [{ parts }], generationConfig };
  // ... rest unchanged
}

return {
  id: "google",
  models: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
  async generate(modelId, input: GenerateInput) {
    return call(
      modelId,
      [{ text: input.prompt }],
      input.prompt,
      imageConfigFor(modelId, input.quality),
    );
  },
  async edit(modelId, input: EditInput) {
    const parts: Array<Record<string, unknown>> = [];
    for (const ref of input.refImages) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: Buffer.from(ref).toString("base64"),
        },
      });
    }
    parts.push({ text: input.prompt });
    return call(modelId, parts, input.prompt, imageConfigFor(modelId, input.quality));
  },
};
```

(The `outputSize` value is the documented Google Gemini Image API field; the test only asserts the tier string appears in the request body, so adapt naming if Google's API requires a different key — but **do not** silently drop the tier.)

- [ ] **Step 5: Run the integration tests**

Run: `npx vitest run tests/integration/gemini.test.ts`
Expected: PASS (3 new tests + existing).

- [ ] **Step 6: Commit**

```bash
git add src/providers/gemini.ts tests/integration/gemini.test.ts
git commit -m "feat(gemini): forward quality tier for gemini-3-pro-image-preview

Pro model accepts 1k/2k/4k tiers, mapped into generationConfig.imageConfig.
Existing 2.5-flash-image path unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Icon command (`src/commands/icon.ts`)

**Files:**
- Create: `src/commands/icon.ts`
- Test: `tests/integration/cli-icon.test.ts`

- [ ] **Step 1: Write the failing integration test for `--prompt-only`**

Create `tests/integration/cli-icon.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(__dirname, "../../src/cli.ts");

function runCli(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; code: number } {
  const r = spawnSync("npx", ["tsx", CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env, NO_COLOR: "1" },
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? -1 };
}

describe("imagnx icon", () => {
  it("--prompt-only prints the enhanced prompt and exits 0 without API calls", () => {
    const r = runCli(["icon", "weather app", "--prompt-only"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Subject: weather app");
    expect(r.stdout).toContain("Square 1:1 aspect ratio.");
  });

  it("--prompt-only works with no API key set", () => {
    const r = runCli(
      ["icon", "weather app", "--prompt-only"],
      { IMAGNX_OPENAI_API_KEY: "", IMAGNX_GEMINI_API_KEY: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Subject: weather app");
  });

  it("--prompt-only + --raw-prompt echoes prompt verbatim", () => {
    const r = runCli(["icon", "weather app", "--prompt-only", "--raw-prompt"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("weather app");
  });

  it("--prompt-only + --style minimalism includes the preset directive", () => {
    const r = runCli(["icon", "weather app", "--prompt-only", "--style", "minimalism"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Primary style preset (dominant): minimalism");
  });

  it("rejects an unknown style with exit 4", () => {
    const r = runCli(["icon", "weather app", "--prompt-only", "--style", "foobar"]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("unknown style 'foobar'");
  });

  it("rejects an icon-only style on non-icon command", () => {
    const r = runCli(["generate", "weather app", "--style", "glassy"]);
    expect(r.code).toBe(4);
    expect(r.stderr).toContain("'glassy' only supported on: icon");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/integration/cli-icon.test.ts`
Expected: FAIL — `imagnx icon` subcommand does not exist; the first test exits with citty's "unknown command" error.

- [ ] **Step 3: Create `src/commands/icon.ts`**

```typescript
import { defineCommand } from "citty";
import { InvalidArgs } from "../errors.js";
import { buildFinalIconPrompt } from "../icon-prompt.js";
import { validateStyleForCommand } from "../styles.js";

export interface IconOpts {
  prompt: string;
  style?: string;
  promptOnly?: boolean;
  rawPrompt?: boolean;
  useIconWords?: boolean;
}

// Build (or print) the enhanced prompt. Returns the string for the runner;
// when --prompt-only is set, writes to stdout and signals "do not run".
export interface IconBuildResult {
  enhancedPrompt: string;
  printOnly: boolean;
}

export function buildIconRequest(opts: IconOpts): IconBuildResult {
  if (opts.style !== undefined) {
    // Throws InvalidArgs (exit 4) on bad/mismatched style.
    validateStyleForCommand(opts.style, "icon");
  }
  const enhancedPrompt = buildFinalIconPrompt({
    prompt: opts.prompt,
    rawPrompt: opts.rawPrompt,
    style: opts.style,
    useIconWords: opts.useIconWords,
  });
  return { enhancedPrompt, printOnly: opts.promptOnly === true };
}

export const iconCmd = defineCommand({
  meta: {
    name: "icon",
    description: "Generate an app-icon-style image with multi-layer prompt enhancement",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "What the icon represents",
      required: true,
    },
    style: {
      type: "string" as const,
      description: "Style preset (run with --help for list) or free-form style hint",
    },
    "prompt-only": {
      type: "boolean" as const,
      description: "Print the enhanced prompt and exit (no API call)",
      default: false,
    },
    "raw-prompt": {
      type: "boolean" as const,
      alias: "r",
      description: "Skip enhancement and send the prompt verbatim",
      default: false,
    },
    "use-icon-words": {
      type: "boolean" as const,
      alias: "i",
      description: "Include 'icon'/'logo' wording in enhancement (default: off)",
      default: false,
    },
    model: {
      type: "string" as const,
      alias: "m",
      description: "Model ID (defaults to gpt-image-1.5)",
    },
    quality: {
      type: "string" as const,
      alias: "q",
      description: "Image quality (model-aware: e.g. high for OpenAI, 2k for gemini-3-pro)",
    },
    n: {
      type: "string" as const,
      description: "Number of images (positive integer)",
    },
    output: {
      type: "string" as const,
      alias: "o",
      description: "Output file or directory override",
    },
    open: {
      type: "boolean" as const,
      description: "Open results in default viewer after writing",
      default: false,
    },
    json: {
      type: "boolean" as const,
      description: "Stable JSON output: {results:[...],errors:[...]}",
      default: false,
    },
  },
  // The actual run() body lives in cli.ts so it can reuse resolveShared/
  // executeAndOutput without circular imports. cli.ts wires it via the
  // exported iconCmd by overriding .run on registration.
});
```

- [ ] **Step 4: Add a unit test for `buildIconRequest` so this task ships green**

Create `tests/unit/icon-request.test.ts` (the broader CLI integration tests in `tests/integration/cli-icon.test.ts` will start passing only after Task 7 wires the subcommand):

```typescript
import { describe, it, expect } from "vitest";
import { buildIconRequest } from "../../src/commands/icon.js";
import { InvalidArgs } from "../../src/errors.js";

describe("buildIconRequest", () => {
  it("plain prompt produces enhanced prompt and printOnly=false", () => {
    const r = buildIconRequest({ prompt: "weather app" });
    expect(r.printOnly).toBe(false);
    expect(r.enhancedPrompt).toContain("Subject: weather app");
  });

  it("--prompt-only sets printOnly true", () => {
    expect(buildIconRequest({ prompt: "x", promptOnly: true }).printOnly).toBe(true);
  });

  it("invalid style throws InvalidArgs", () => {
    expect(() => buildIconRequest({ prompt: "x", style: "foobar" })).toThrow(InvalidArgs);
  });

  it("valid icon-only style passes through", () => {
    const r = buildIconRequest({ prompt: "x", style: "glassy" });
    expect(r.enhancedPrompt).toContain("glassy");
  });
});
```

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run tests/unit/icon-request.test.ts`
Expected: PASS (4 tests). The CLI integration file (`tests/integration/cli-icon.test.ts`) will still fail — that's expected; it gets wired in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/commands/icon.ts tests/unit/icon-request.test.ts tests/integration/cli-icon.test.ts
git commit -m "feat(commands): icon subcommand definition + buildIconRequest

Defines the citty command shape, args, and a pure buildIconRequest
helper that performs style validation and prompt enhancement. The
handler body is wired in cli.ts (Task 7) to reuse existing
resolveShared/executeAndOutput.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire icon command + add `--style` to generate/edit

**Files:**
- Modify: `src/cli.ts` (register iconCmd, add --style to sharedArgs, validate per command)

- [ ] **Step 1: Add `--style` to `sharedArgs` and the per-command validation**

Edit `src/cli.ts`. In `sharedArgs` (around line 332), add:

```typescript
style: {
  type: "string" as const,
  description: "Style preset (e.g. minimalism, pixel, neon) — applies a directive to the prompt",
},
```

Add to `SharedGenerateOpts` interface (around line 50):

```typescript
interface SharedGenerateOpts {
  prompt: string;
  model?: string;
  compare?: boolean;
  size?: string;
  quality?: string;
  n?: number;
  output?: string;
  open?: boolean;
  json?: boolean;
  dryRun?: boolean;
  style?: string;          // NEW
}
```

In the `generateCmd.run` body (around line 438), pass `style: args.style` into `runGenerate`. Same for `editCmd.run` (around line 484): pass `style: args.style` into `runEdit`.

- [ ] **Step 2: Apply style enhancement in `runGenerate` and `runEdit`**

Edit `src/cli.ts`. Import the validator and directive helper at the top:

```typescript
import { validateStyleForCommand, getStyleDirective } from "./styles.js";
```

In `runGenerate`, after `parseN(args.n)` resolution and before the prompt is wrapped, transform the prompt:

```typescript
async function runGenerate(opts: SharedGenerateOpts): Promise<void> {
  let effectivePrompt = opts.prompt;
  if (opts.style !== undefined) {
    const id = validateStyleForCommand(opts.style, "generate");
    effectivePrompt = `Style directive: ${getStyleDirective(id)}\n\n${opts.prompt}`;
  }
  // ... existing resolveShared call, but use effectivePrompt below
  const req: RunRequest = {
    kind: "generate",
    modelIds,
    input: { prompt: effectivePrompt, size, quality, n },
  };
  await executeAndOutput(req, cfg, providers, { ...opts, prompt: effectivePrompt });
}
```

Mirror the same pattern in `runEdit` with `validateStyleForCommand(opts.style, "edit")`.

- [ ] **Step 3: Wire the icon subcommand**

At the top of `src/cli.ts` near the other imports:

```typescript
import { iconCmd, buildIconRequest, type IconOpts } from "./commands/icon.js";
```

Add the runner function (place after `runEdit`):

```typescript
async function runIcon(opts: IconOpts & SharedGenerateOpts): Promise<void> {
  const built = buildIconRequest({
    prompt: opts.prompt,
    style: opts.style,
    promptOnly: opts.promptOnly,
    rawPrompt: opts.rawPrompt,
    useIconWords: opts.useIconWords,
  });

  if (built.printOnly) {
    process.stdout.write(built.enhancedPrompt + "\n");
    return;
  }

  // Default size for icon mode is 1024x1024.
  const sizedOpts: SharedGenerateOpts = { ...opts, size: opts.size ?? "1024x1024" };
  const { cfg, modelIds, size, quality, n, providers } = resolveShared(sizedOpts, process.env);

  for (const modelId of modelIds) {
    validateRequest(modelId, { kind: "generate", size, quality });
  }

  if (opts.dryRun) {
    process.stderr.write(
      `[dry-run] kind=icon models=${modelIds.join(",")} prompt=${built.enhancedPrompt.slice(0, 80)}...\n`,
    );
    return;
  }

  const req: RunRequest = {
    kind: "generate",
    modelIds,
    input: { prompt: built.enhancedPrompt, size, quality, n },
  };
  await executeAndOutput(req, cfg, providers, { ...opts, prompt: built.enhancedPrompt });
}
```

Add `icon: iconCmd` to the `subCommands` map in the root `main` command at `src/cli.ts:773`:

```typescript
const main = defineCommand({
  meta: { ... },
  subCommands: {
    generate: generateCmd,
    edit: editCmd,
    icon: iconCmd,        // NEW
    models: modelsCmd,
    init: initCmd,
    login: loginCmd,
    config: configCmd,
  },
});
```

Override `iconCmd.run` just before `runMain(main, { rawArgs })` at `src/cli.ts:824`:

```typescript
(iconCmd as { run?: unknown }).run = ({ args }: { args: Record<string, unknown> }) =>
  withExitCode(() =>
    runIcon({
      prompt: String(args.prompt),
      style: args.style as string | undefined,
      promptOnly: args["prompt-only"] === true,
      rawPrompt: args["raw-prompt"] === true,
      useIconWords: args["use-icon-words"] === true,
      model: args.model as string | undefined,
      quality: args.quality as string | undefined,
      n: parseN(args.n as string | undefined),
      output: args.output as string | undefined,
      open: args.open === true,
      json: args.json === true,
    }),
  );

await runMain(main, { rawArgs });
```

- [ ] **Step 4: Reject `--prompt-only`/`--raw-prompt`/`--use-icon-words` on non-icon commands**

These flags are not in `sharedArgs` and aren't in generate/edit args, so citty will already reject them with "unknown flag". Verify by running:

```bash
npx tsx src/cli.ts generate "x" --prompt-only
```

Expected: citty error mentioning unknown flag, non-zero exit. If citty passes them through silently, add explicit rejection in `runGenerate`/`runEdit`:

```typescript
if ((opts as any).promptOnly || (opts as any).rawPrompt || (opts as any).useIconWords) {
  throw new InvalidArgs("--prompt-only / --raw-prompt / --use-icon-words are only valid for 'imagnx icon'");
}
```

(Skip this snippet if citty already rejects unknown flags.)

- [ ] **Step 5: Run all integration tests**

Run: `npx vitest run tests/integration/cli-icon.test.ts`
Expected: PASS (6 tests).

Run: `npx vitest run`
Expected: ALL tests pass.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manual smoke**

```bash
npx tsx src/cli.ts icon "weather app" --prompt-only
npx tsx src/cli.ts icon "weather app" --prompt-only --style minimalism
npx tsx src/cli.ts icon "weather app" --prompt-only --raw-prompt
npx tsx src/cli.ts generate "a cat" --style pixel --dry-run
npx tsx src/cli.ts generate "a cat" --style glassy 2>&1 | grep "icon"
```

Last command should print the friendly "only supported on: icon" error and exit 4.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): wire imagnx icon subcommand and --style on generate/edit

Registers iconCmd with prompt-only short-circuit, style validation,
1024x1024 default size. generate/edit gain --style flag with
allowlist-aware validation that rejects icon-only presets clearly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README to find insertion points**

Run: `wc -l README.md && head -120 README.md`

- [ ] **Step 2: Add a Models row for `gemini-3-pro-image-preview`**

In the Models table, add this row after the existing `gemini-2.5-flash-image` row:

```markdown
| Google | `gemini-3-pro-image-preview` | ✓ | ✗ | up to 1024×1024 (tiers: 1k/2k/4k) |
```

Update the alias note: `nano-banana` → `gemini-2.5-flash-image`; `nano-banana-pro` → `gemini-3-pro-image-preview`.

- [ ] **Step 3: Add an "Icon mode" section after the existing Quick start**

```markdown
## Icon mode

For app-icon-style outputs, use the dedicated subcommand. It wraps your prompt
in multi-layer scaffolding (archetype selection, anti-padding rules, Android
safe-area, blur QA) ported from [SnapAI](https://github.com/betomoedano/snapai).

\`\`\`bash
imagnx icon "weather app, sun and cloud"
imagnx icon "fitness tracker" --style minimalism
imagnx icon "calculator" --prompt-only        # preview the enhanced prompt
imagnx icon "notes app" --raw-prompt          # bypass enhancement
imagnx icon "banking app" --use-icon-words    # include "icon"/"logo" wording
imagnx icon "music player" --model nano-banana-pro --quality 2k -n 3
\`\`\`

Default model is `gpt-image-1.5`; default size is `1024x1024`.
```

- [ ] **Step 4: Add a "Styles" section after Icon mode**

```markdown
## Styles

`--style <name>` applies a preset directive to the prompt. Some presets are
universal; others are icon-only.

| Preset | Applies to |
|---|---|
| `minimalism`, `flat`, `pixel`, `kawaii`, `neon`, `holographic`, `material` | generate / icon / edit |
| `ios-classic`, `android-material`, `glassy`, `clay`, `woven`, `geometric`, `gradient`, `game`, `cute` | icon only |

Selecting an icon-only preset on a non-icon command exits with code 4 and a clear message.
You can also pass a free-form `--style "made of moss, soft light"` for a soft hint.
```

- [ ] **Step 5: Add the icon flag table near the existing flag references**

```markdown
### `imagnx icon` flags

| Flag | Short | Default | Description |
|---|---|---|---|
| `<prompt>` |  | required | What the icon represents (positional) |
| `--style` |  |  | Preset name or free-form hint |
| `--prompt-only` |  | `false` | Print enhanced prompt; no API call |
| `--raw-prompt` | `-r` | `false` | Skip enhancement; send prompt verbatim |
| `--use-icon-words` | `-i` | `false` | Include "icon"/"logo" wording (default: off to reduce padding) |
| `--model` | `-m` | `gpt-image-1.5` | Model ID |
| `--quality` | `-q` |  | Model-aware: `auto/high/medium/low` (OpenAI) or `1k/2k/4k` (gemini-3-pro). Aliases: `hd`→`high`, `standard`→`medium` |
| `--n` |  | `1` | Number of images |
| `--output` | `-o` |  | Output file or directory override |
| `--open` |  | `false` | Open results in default viewer |
| `--json` |  | `false` | Emit structured JSON |
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(readme): icon mode, styles, gemini-3-pro-image-preview

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Read current CHANGELOG to match style**

Run: `head -40 CHANGELOG.md`

- [ ] **Step 2: Prepend a 0.2.0 entry**

Add at the top (above the most recent dated entry), matching existing format:

```markdown
## [0.2.0] — 2026-05-02

### Added
- `imagnx icon "<prompt>"` subcommand with multi-layer prompt enhancement (ported from SnapAI, MIT).
- `--style <name>` on `imagnx`, `imagnx icon`, and `imagnx edit` with 16 presets and subcommand-scoped allowlists.
- `--prompt-only`, `--raw-prompt`, `--use-icon-words` flags on `imagnx icon`.
- `gemini-3-pro-image-preview` model (alias `nano-banana-pro`) with quality tiers `1k`/`2k`/`4k` and multi-image support.
- Quality aliases `hd`→`high` and `standard`→`medium`.

### Changed
- Quality validation is now model-aware. Each model declares `qualityValues`; mismatches exit with code 4 and a clear message.
```

- [ ] **Step 3: Bump package.json version**

Edit `package.json`: change `"version": "0.1.7"` to `"version": "0.2.0"`.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore(release): 0.2.0

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Don't tag or publish — that's a separate user decision.)

---

## Task 10: Update skill (`skill/SKILL.md` + `skill/reference.md`)

**Files:**
- Modify: `skill/SKILL.md`
- Modify: `skill/reference.md`

- [ ] **Step 1: Update SKILL.md frontmatter**

Edit `skill/SKILL.md` (the `version` field is auto-bumped by `scripts/sync-skill-version.mjs` on `npm version` — see `package.json` scripts). Manually set:

```yaml
metadata:
  version: "0.2.0"
```

Add `Bash(imagnx icon *)` to `allowed-tools`:

```yaml
allowed-tools: Bash(command -v *) Bash(imagnx *) Bash(imagnx icon *) Bash(npm install *) Bash(jq *)
```

(Note: `Bash(imagnx *)` likely already covers `imagnx icon *` due to glob expansion — verify by checking the existing pattern. If so, skip the second permission.)

Update the `description` field to add icon triggers:

```yaml
description: Generate or edit images using the imagnx CLI (OpenAI gpt-image, Google Gemini "Nano Banana"). Use whenever the user wants to create or modify an image. Triggers include "generate", "create", "make", "draw", "render", "paint", "design", "illustrate", "picture", "logo", "icon", "app icon", "thumbnail", "sketch", "art", and edit phrasings like "edit this photo", "remove the background", "change the sky", "swap the X", "make it more X". Also use when the user names an image model (gpt-image-1.5, gpt-image-2, nano-banana, nano-banana-pro, gemini-2.5-flash-image, gemini-3-pro-image-preview), names a style preset (minimalism, glassy, pixel, kawaii, neon, etc.), asks to "compare image models", or invokes /imagnx. SKIP when the user wants to describe, analyze, OCR, or extract text from an image (vision, not generation), or wants charts, plots, or data visualizations.
```

- [ ] **Step 2: Add a new "Icon" section between "Generate" and "Edit"**

```markdown
## Icon

For app-icon-style requests ("app icon for X", "logo for my Y app", "icon for Z"), use the icon subcommand. It wraps the prompt in scaffolding tuned for app-icon outputs.

\`\`\`bash
imagnx icon "<prompt>" --json [--style <name>] [-m <model>] [--open]
\`\`\`

If the icon comes out wrong, re-run with `--prompt-only` to see the enhanced prompt that was sent — useful for diagnosing why the result drifted.

`--style <name>` accepts presets (`minimalism`, `glassy`, `pixel`, `neon`, `kawaii`, `holographic`, `material`, `flat`, `ios-classic`, `android-material`, `clay`, `woven`, `geometric`, `gradient`, `game`, `cute`) or a free-form description. Icon-only presets (e.g. `glassy`, `ios-classic`) are rejected on `imagnx generate`/`imagnx edit` with exit 4.
```

Add an icon example under Examples:

```markdown
User: "make me an app icon for a weather app, minimalist"
\`\`\`bash
imagnx icon "weather app" --style minimalism --json
\`\`\`
```

- [ ] **Step 3: Update reference.md**

Edit `skill/reference.md`. Add:

1. New row in models table: `gemini-3-pro-image-preview` (alias `nano-banana-pro`), edit ✓, mask ✗, sizes "auto / 1024x1024 (tiers: 1k|2k|4k)".
2. New "imagnx icon" flag list (mirror the table from Task 8 Step 5).
3. New "Styles" section listing all 16 presets with their `appliesTo` and a sentence each.
4. Quality matrix:

```markdown
### Quality by model

| Model | Valid `--quality` |
|---|---|
| `gpt-image-1.5`, `gpt-image-2` | `auto`, `high`, `medium`, `low` (aliases: `hd`→`high`, `standard`→`medium`) |
| `gemini-2.5-flash-image` | `auto` |
| `gemini-3-pro-image-preview` | `1k`, `2k`, `4k` (default `1k`) |
```

- [ ] **Step 4: Commit**

```bash
git add skill/SKILL.md skill/reference.md
git commit -m "docs(skill): icon subcommand, styles, gemini-3-pro

Bumps SKILL.md version to 0.2.0. Adds icon section, --style guidance,
gemini-3-pro-image-preview to model lists, and full styles reference.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Run the full test suite**

```bash
npm run typecheck
npx vitest run
```

Expected: typecheck clean; all tests pass.

- [ ] **Verify the build**

```bash
npm run build
./dist/cli.js icon "weather app" --prompt-only
./dist/cli.js icon "weather app" --prompt-only --style minimalism
./dist/cli.js generate "a cat" --style glassy 2>&1 || true   # expect exit 4
```

Expected: enhanced prompts print; bad-style invocation prints the "only supported on: icon" error.

- [ ] **Final commit if anything was tweaked during verification**

```bash
git status
# If clean: done.
# Otherwise: commit fixes with a clear message.
```
