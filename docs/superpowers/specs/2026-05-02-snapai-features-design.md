# SnapAI feature absorption — design

**Date:** 2026-05-02
**Status:** Draft (pending user review)
**Scope:** Pull SnapAI's icon-mode prompt engineering, style preset library, and DX flags into `imagnx`. Add `gemini-3-pro-image-preview` model support.

## Motivation

`imagnx` is a general-purpose multi-provider image-generation CLI. SnapAI is a focused app-icon CLI built on the same provider set (OpenAI gpt-image, Google Nano Banana). SnapAI's value is concentrated in two files: an opinionated multi-layer prompt builder for app-icon outputs and a 16-entry style preset library with hard-constraint enforcement. Both are independently useful in `imagnx` if structured to fit a multi-purpose tool — icon-mode as a focused subcommand, styles as a generic mechanism with subcommand-scoped allowlists.

## Non-goals

- No hard `1024×1024` output lock (anti-feature for general use).
- No icon-edit subcommand (`imagnx edit … --style …` covers it).
- No refactor of existing `generate` / `edit` paths beyond adding two flags.
- No `imagnx icon edit …` flow.

## User-facing surface

```
imagnx "<prompt>" [--style <name>] ...                  # existing + style
imagnx edit <ref...> "<prompt>" [--style <name>] ...    # existing + style
imagnx icon "<prompt>" ...                              # NEW subcommand
   --style <name>            preset, allowlist-validated
   --prompt-only             print enhanced prompt; no API call
   --raw-prompt / -r         skip enhancement; send prompt verbatim
   --use-icon-words / -i     opt-in "icon"/"logo" wording (default off)
   --model <id>              gpt-image-1.5 | gpt-image-2 | gemini-2.5-flash-image
                             | gemini-3-pro-image-preview | nano-banana | nano-banana-pro
   --quality                 model-aware: auto/high/medium/low (OpenAI),
                             1k/2k/4k (gemini-3-pro), hd→high / standard→medium aliases
   -n <int>                  multi-image; rejected for gemini-2.5-flash-image
   --size, --output, --json, --open, --compare    inherited semantics
```

`--prompt-only` is icon-only (root generate has nothing to preview when there is no enhancement).

### Style preset library

Ports SnapAI's 16 presets:

| Preset | `appliesTo` |
|---|---|
| `minimalism`, `flat`, `pixel`, `kawaii`, `neon`, `holographic`, `material` | `['generate', 'icon', 'edit']` |
| `ios-classic`, `android-material`, `glassy`, `clay`, `woven`, `geometric`, `gradient`, `game`, `cute` | `['icon']` |

Selecting a style outside its `appliesTo` list errors with exit code 4 and message: `'<name>' only supported on: <subcommand list>`.

For root `generate` and `edit`, an applicable style prepends a single style directive to the user prompt. For `icon`, the preset is woven into the multi-layer prompt and acts as a hard constraint that wins conflicts with other instructions.

### New model: `gemini-3-pro-image-preview`

- Alias: `nano-banana-pro` (mirrors existing `nano-banana` alias).
- Quality tiers: `1k` (default), `2k`, `4k`.
- Multi-image (`-n > 1`): allowed.
- Default size: `1024x1024` when invoked via `imagnx icon`; on root `generate` / `edit`, the existing default-size logic applies.

## File structure

### New files

- **`src/styles.ts`** — Style preset library.
  - `type StyleId` (16-member union).
  - `interface StyleDefinition` with: `id`, `summary`, `appliesTo`, `culturalDna?`, `mandatory?`, `forbidden?`, `checklist?`.
  - `STYLE_DEFINITIONS: Record<StyleId, StyleDefinition>` — 16 entries ported from SnapAI's `styleTemplates.ts`, each tagged with `appliesTo`.
  - `getStyleDirective(id)`, `getStyleDescription(id)`, `getAvailableStyles(forCommand?: 'generate' | 'icon' | 'edit')`.
  - `validateStyleForCommand(name, command)` — throws `InvalidArgs` on mismatch.

- **`src/icon-prompt.ts`** — Multi-layer prompt builder ported from SnapAI's `utils/icon-prompt.ts`.
  - Single export: `buildFinalIconPrompt({ prompt, rawPrompt, style, useIconWords })`.
  - Three layers: concept + art-direction, technical constraints, optional style enforcement.
  - `isDefaultLook` heuristic that disables matte guardrails when the user explicitly requests glassy/neon/holographic/etc.

- **`src/commands/icon.ts`** — citty subcommand definition + handler.
  - Parses args, calls `validateStyleForCommand(..., 'icon')`, calls `buildFinalIconPrompt(...)`.
  - On `--prompt-only`: writes to stdout and exits 0 — no credentials needed, no API call.
  - Otherwise: reuses existing `config`, `credentials`, `output`, `runner`, `providers` modules; default model `gpt-image-1.5`; default size `1024x1024`.

### Modified files

- **`src/cli.ts`** — Register the icon subcommand. Add `--style` to root `generate` and `edit`. No restructuring of existing handlers.
- **`src/registry.ts`** — Register `gemini-3-pro-image-preview` (with `nano-banana-pro` alias). Update model capabilities (multi-image OK; quality tier set `{1k, 2k, 4k}`).
- **`src/providers/gemini.ts`** — Add branch for `gemini-3-pro-image-preview` (uses thinking config + maps `--quality 1k|2k|4k` to API params).
- **`src/config.ts`** — Extend `VALID_QUALITIES` with `1k|2k|4k`. Quality validation becomes model-aware (delegated to `validateRequest` in `registry.ts`).

## Data flow

### `imagnx icon "weather app" --style minimalism`

1. citty parses → `IconOpts`.
2. `validateStyleForCommand("minimalism", "icon")` → ok.
3. `buildFinalIconPrompt({ prompt: "weather app", style: "minimalism" })` → enhanced multi-layer prompt.
4. If `--prompt-only`: write to stdout, exit 0.
5. Else: load config + credentials; default model `gpt-image-1.5`; default size `1024x1024`.
6. Build `RunRequest`; call existing `runFanOut`.
7. Write image bytes via existing `output` module; optional `--open`.
8. If `--json`: emit existing `{ results, errors }` shape.

### `imagnx "..." --style pixel`

1. Parse → `validateStyleForCommand("pixel", "generate")` → ok.
2. Lightweight enhancement: prepend `Style directive: <getStyleDirective("pixel")>` to the user prompt. **No** icon scaffolding (no archetype, no anti-tile rules).
3. Continue with existing flow.

### `imagnx edit ref.png "make it glassy" --style glassy`

1. `validateStyleForCommand("glassy", "edit")` → fails (`glassy` is `appliesTo: ['icon']`) → exit 4 with `"glassy only supported on: icon"`.
2. With a valid style (e.g. `pixel`): same as edit today, prompt prefixed with style directive.

### `imagnx icon "..." --model nano-banana-pro --quality 2k -n 3`

1. `resolveModelId("nano-banana-pro")` → `"gemini-3-pro-image-preview"`.
2. `validateRequest`: model-aware `--quality` check passes; `-n > 1` allowed.
3. `gemini.ts` calls the pro API path with thinking config + tier mapping.
4. 3 images written.

## Error handling

Existing exit-code table preserved. New errors map to existing codes:

| Condition | Exit | Message |
|---|---|---|
| Unknown `--style` value | 4 | `unknown style '<name>'; valid: <list>` |
| Style/command mismatch | 4 | `'<name>' only supported on: <subcommand list>` |
| `--quality high` on `gemini-3-pro-image-preview` | 4 | `'high' not valid for gemini-3-pro-image-preview; valid: 1k, 2k, 4k` |
| `--use-icon-words` on non-icon command | 4 | `--use-icon-words is only valid for 'imagnx icon'` |
| `--raw-prompt` on non-icon command | 4 | `--raw-prompt is only valid for 'imagnx icon'` |
| `--prompt-only` on non-icon command | 4 | `--prompt-only is only valid for 'imagnx icon'` |
| Pro-model rate limit / API error | 5 / 6 | existing handling |

`--prompt-only` short-circuits before credentials and API calls — works without any API key set, so users can iterate on prompts offline.

## Testing

Vitest (the repo already uses it; see `package.json` scripts and `tests/{unit,integration,helpers}/`). New unit tests under `tests/unit/`, integration under `tests/integration/`.

- **`tests/unit/styles.test.ts`** — every preset present in `STYLE_DEFINITIONS`; each `appliesTo` non-empty; `validateStyleForCommand` returns ok for in-allowlist combinations and throws `InvalidArgs` with the expected message shape for out-of-allowlist combinations; `getAvailableStyles('icon')` returns all 16; `getAvailableStyles('generate')` and `getAvailableStyles('edit')` each return the same 7.
- **`tests/unit/icon-prompt.test.ts`** — snapshot-style assertions for: (a) plain prompt, (b) `--style minimalism`, (c) `--raw-prompt`, (d) `--use-icon-words`, (e) `--raw-prompt + --style` combination. Verify `isDefaultLook` heuristic triggers correctly on keywords like "glassy", "neon", "holographic".
- **`tests/unit/registry-gemini-pro.test.ts`** — `gemini-3-pro-image-preview` registered; `nano-banana-pro` resolves to it; capabilities (`maxRefImages`, `validSizes`) correct.
- **`tests/unit/quality-validation.test.ts`** — table-driven `(model, quality, expected)` cases covering OpenAI models, gemini-2.5-flash-image, gemini-3-pro-image-preview, the `hd`/`standard` aliases, and rejected cross-family values.
- **`tests/integration/cli-icon.test.ts`** — command integration with a mocked provider: happy path produces an image; `--prompt-only` exits 0 without invoking the provider; bad `--style` exits 4 with the expected message.

Existing tests are not modified unless the same case needs extending (e.g., model registry tests).

## Documentation updates

- **`README.md`** — new "Icon mode" section with quickstart; new "Styles" section with the 16-row table (name, summary, applies-to); model table gains `gemini-3-pro-image-preview` (alias `nano-banana-pro`); flags table for `imagnx icon`.
- **`skill/SKILL.md`** — bump `version` to `0.2.0`; add `Bash(imagnx icon *)` to `allowed-tools`; new "Icon" section after "Edit" (when to use, parse triggers, examples); mention `--style` and `--prompt-only`; add "app icon" to the trigger keywords; recovery hint to re-run with `--prompt-only` when an icon comes out wrong.
- **`skill/reference.md`** — full `imagnx icon` flag list; full styles table with `appliesTo`; new model row; quality matrix updated.
- **`CHANGELOG.md`** — new `[0.2.0]` entry summarizing icon subcommand, 16 style presets, `gemini-3-pro-image-preview` support, and the four new flags (`--style`, `--prompt-only`, `--raw-prompt`, `--use-icon-words`).

## Out of scope

- Refactoring `cli.ts` (827 lines) beyond the necessary additions.
- Moving existing `generate` / `edit` handlers into `src/commands/`.
- Adding more model presets beyond the 16 ported from SnapAI.
- Adding `--preset` semantics beyond styles (e.g., generic "photo"/"poster" presets).
- Telemetry, analytics, or any cross-call caching.

## License attribution

SnapAI is MIT-licensed. The ports of `icon-prompt.ts` and `styleTemplates.ts` carry the SnapAI MIT notice in a header comment.
