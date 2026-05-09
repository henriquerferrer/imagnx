---
name: imagnx
description: Use when the user wants to generate, create, edit, or modify an image, including app icons and logos. Triggers include "generate/create/make/draw/render/paint image", "edit/remove/change/swap X", "app icon", "logo", "thumbnail"; the user names a model (gpt-image-1.5, gpt-image-2, nano-banana, nano-banana-pro, gemini-2.5-flash-image, gemini-3-pro-image-preview), names a style preset (minimalism, glassy, pixel, kawaii, neon, etc.), or invokes /imagnx. SKIP for vision tasks (describe/analyze/OCR/extract text from an image) and for charts, plots, or data visualizations.
allowed-tools: Bash(npx --yes imagnx*) Bash(jq *)
---

# imagnx

Generate or edit images via the `imagnx` CLI. Dispatches to OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` alias `nano-banana`, `gemini-3-pro-image-preview` alias `nano-banana-pro`). Full flag list, supported models, and exit codes: [references/reference.md](references/reference.md).

## How to invoke the CLI

Always invoke via `npx --yes imagnx@latest` — no install needed and you stay current automatically:

```bash
npx --yes imagnx@latest <args>
```

The `--yes` is required so npx doesn't prompt for an install confirmation.

## Generate

Always pass `--json` so the output is parseable.

```bash
npx --yes imagnx@latest "<prompt>" --json [-m <model>[,<model>...]] [--open]
```

Pass a comma-separated `-m` list (e.g. `-m gpt-image-1.5,nano-banana`) to fan out across multiple models. For fan-outs that mix `gpt-image-*` with `nano-banana` (`gemini-2.5-flash-image`), pass `-q auto` — it's the only value both accept, and the default `high` is rejected by Gemini-flash. Fan-outs that include `nano-banana-pro` (`gemini-3-pro-image-preview`, only `1k`/`2k`/`4k`) share no `-q` value with OpenAI; split those into separate per-provider calls. `--open` opens results in the default viewer after writing.

## Edit

```bash
npx --yes imagnx@latest edit <ref1> [<ref2> ...] "<prompt>" --json [--mask <m>] [-m <model>] [--open]
```

The last positional is the prompt. `--mask` requires exactly one ref image. Gemini models (`gemini-2.5-flash-image`, `gemini-3-pro-image-preview`) do not support masks; use a `gpt-image-*` model when a mask is needed.

## Icon

For app-icon-style requests ("app icon for X", "logo for my Y app", "icon for Z app"), use the icon subcommand. It wraps the prompt in multi-layer scaffolding (archetype selection, anti-padding rules, blur QA) tuned for app-icon outputs.

```bash
npx --yes imagnx@latest icon "<prompt>" --json [--style <name>] [-m <model>] [--open]
```

If the icon comes out wrong, re-run with `--prompt-only` to inspect the enhanced prompt that was sent — useful for diagnosing why the result drifted.

`--style <name>` accepts a preset name or a free-form description. Some presets are icon-only and exit 4 on `generate`/`edit`. Full split (universal vs icon-only): see [references/reference.md](references/reference.md).

## Parse the user's request

Extract:
- **prompt**: required, the user's textual description as a single quoted string.
- **refs**: file paths the user mentioned. Use absolute paths.
- **mask**: a path mentioned alongside the word "mask".
- **model**: if the user named one (`gpt-image-1.5`, `nano-banana`, etc.). For "compare", "all models", "side by side", pass a comma-separated `-m` list.
- **style**: if the user named a preset (`minimalism`, `glassy`, `pixel`, etc.) or asked for a vibe ("make it neon", "more kawaii"). Pass via `--style`. Icon-only presets are listed in [references/reference.md](references/reference.md) — using one on `generate`/`edit` exits 4.
- **open**: set when the user says "show me", "open it", "let me see".

## Present results

Output is `{"results": [...], "errors": [...]}`. Print each result as `✓ <model>: <path>` and each error as `✗ <model>: <message>`.

## Common mistakes

- Forgot `--json` → output is decorative, not parseable.
- Forgot `--yes` on `npx` → first call hangs on an install confirmation.
- Fan-out mixing `gpt-image-*` with `nano-banana` without `-q auto` → exit 4 (default `high` is rejected by Gemini-flash).
- Fan-out includes `nano-banana-pro` alongside `gpt-image-*` → no shared `-q` value; split into per-provider calls.
- `--mask` with a Gemini model → exit 3. Masks are `gpt-image-*` only.
- `--mask` with more than one ref image → exit 4. Mask requires exactly one ref.
- Icon-only preset (e.g. `glassy`, `ios-classic`) on `generate`/`edit` → exit 4.

## Errors and recovery

| Exit | Action |
|---|---|
| 2 (`MissingApiKey`) | The error names the missing env var (`IMAGNX_OPENAI_API_KEY` or `IMAGNX_GEMINI_API_KEY`). Ask the user **only for the named key**. Persist via `npx --yes imagnx@latest login --openai <key>` (or `--gemini <key>`), or pass inline with `--openai-api-key <key>` / `--gemini-api-key <key>`. Persist is preferred for repeated use; precedence and `credentials.toml` details in [references/reference.md](references/reference.md). Unprefixed `OPENAI_API_KEY`/`GEMINI_API_KEY` are not read. |
| 3 (`UnsupportedFeature`) | Re-run with a model that supports the feature; the message names valid models. |
| 4 (`InvalidArgs`) | Surface the validation error verbatim. Ask the user to correct flags or arguments. |
| 5 (`RateLimited`) | Wait 30 to 60 seconds, then retry the same command. |
| 6 (`ProviderError`) | Surface the provider's message. Do not retry without user input. |
| 7 (`PartialFailure`) | Some models in the fan-out succeeded, others failed. Report successes as `✓ <model>: <path>` and surface each failure's message. Offer to retry only the failed models. |

Node.js ≥18 is required (npx is bundled with npm). No global install of imagnx is needed; npx fetches and caches the package on first call.

## Examples

User: "generate a cat astronaut on the moon"
```bash
npx --yes imagnx@latest "a cat astronaut on the moon" --json
```

User: "make a red car and show it to me"
```bash
npx --yes imagnx@latest "a red car" --json --open
```

User: "generate a sunset across multiple models"
```bash
npx --yes imagnx@latest "a sunset over mountains" -m gpt-image-1.5,nano-banana -q auto --json
```

User: "edit /tmp/photo.png to make the sky purple"
```bash
npx --yes imagnx@latest edit /tmp/photo.png "make the sky purple" --json
```

User: "edit /tmp/photo.png with mask /tmp/sky.png, change the sky to stars"
```bash
npx --yes imagnx@latest edit /tmp/photo.png --mask /tmp/sky.png "stars in the sky" --json
```

User: "make me an app icon for a weather app, minimalist"
```bash
npx --yes imagnx@latest icon "weather app" --style minimalism --json
```

User asks to generate but `IMAGNX_OPENAI_API_KEY` is missing (exit 2). Ask only for the OpenAI key, then either persist (preferred — works for future calls too):
```bash
npx --yes imagnx@latest login --openai sk-...
npx --yes imagnx@latest "<original prompt>" --json
```
or pass it inline (one-shot, not persisted):
```bash
npx --yes imagnx@latest "<original prompt>" --openai-api-key sk-... --json
```
