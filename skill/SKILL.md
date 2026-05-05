---
name: imagnx
description: Generate or edit images using the imagnx CLI (OpenAI gpt-image, Google Gemini "Nano Banana"), or generate app-icon-style outputs via `imagnx icon` with 16 style presets. Use whenever the user wants to create or modify an image. Triggers include "generate", "create", "make", "draw", "render", "paint", "design", "illustrate", "picture", "logo", "icon", "app icon", "thumbnail", "sketch", "art", and edit phrasings like "edit this photo", "remove the background", "change the sky", "swap the X", "make it more X". Also use when the user names an image model (gpt-image-1.5, gpt-image-2, nano-banana, nano-banana-pro, gemini-2.5-flash-image, gemini-3-pro-image-preview), names a style preset (minimalism, glassy, pixel, kawaii, neon, etc.), or invokes /imagnx. SKIP when the user wants to describe, analyze, OCR, or extract text from an image (vision, not generation), or wants charts, plots, or data visualizations.
disable-model-invocation: false
allowed-tools: Bash(npx --yes imagnx*) Bash(jq *)
metadata:
  version: "0.3.0"
  repository: github.com/henriquerferrer/imagnx
---

# imagnx

Generate or edit images via the `imagnx` CLI. Dispatches to OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` alias `nano-banana`, `gemini-3-pro-image-preview` alias `nano-banana-pro`). Full flag list, supported models, and exit codes: [reference.md](reference.md).

## How to invoke the CLI

Always invoke via `npx --yes imagnx@latest` — no install needed and you stay current automatically:

```bash
npx --yes imagnx@latest <args>
```

Cold call ≈1s, warm ≈300ms. The `--yes` is required so npx doesn't prompt for an install confirmation.

## Generate

Always pass `--json` so the output is parseable.

```bash
npx --yes imagnx@latest "<prompt>" --json [-m <model>[,<model>...]] [--open]
```

Pass a comma-separated `-m` list (e.g. `-m gpt-image-1.5,nano-banana`) to fan out across multiple models. When the chosen models have different valid `--quality` values, pass `-q auto` (the only setting all OpenAI + Gemini-flash models accept). `--open` opens results in the default viewer after writing.

## Edit

```bash
npx --yes imagnx@latest edit <ref1> [<ref2> ...] "<prompt>" --json [--mask <m>] [-m <model>] [--open]
```

The last positional is the prompt. `--mask` requires exactly one ref image. `gemini-2.5-flash-image` does not support masks; use a `gpt-image-*` model when a mask is needed.

## Icon

For app-icon-style requests ("app icon for X", "logo for my Y app", "icon for Z app"), use the icon subcommand. It wraps the prompt in multi-layer scaffolding (archetype selection, anti-padding rules, blur QA) tuned for app-icon outputs.

```bash
npx --yes imagnx@latest icon "<prompt>" --json [--style <name>] [-m <model>] [--open]
```

If the icon comes out wrong, re-run with `--prompt-only` to inspect the enhanced prompt that was sent — useful for diagnosing why the result drifted.

`--style <name>` accepts presets (`minimalism`, `glassy`, `pixel`, `neon`, `kawaii`, `holographic`, `material`, `flat`, `ios-classic`, `android-material`, `clay`, `woven`, `geometric`, `gradient`, `game`, `cute`) or a free-form description. Icon-only presets (e.g. `glassy`, `ios-classic`) are rejected on `imagnx generate` / `imagnx edit` with exit 4.

## Parse the user's request

Extract:
- **prompt**: required, the user's textual description as a single quoted string.
- **refs**: file paths the user mentioned. Use absolute paths.
- **mask**: a path mentioned alongside the word "mask".
- **model**: if the user named one (`gpt-image-1.5`, `nano-banana`, etc.). For "compare", "all models", "side by side", pass a comma-separated `-m` list.
- **open**: set when the user says "show me", "open it", "let me see".

## Present results

Output is `{"results": [...], "errors": [...]}`. Print each result as `✓ <model>: <path>` and each error as `✗ <model>: <message>`.

## Errors and recovery

| Exit | Action |
|---|---|
| 2 (`MissingApiKey`) | The error names exactly which env var is missing — `IMAGNX_OPENAI_API_KEY` or `IMAGNX_GEMINI_API_KEY`. Ask the user **only for that one key** (do not ask for both unless both are missing). Save it with `npx --yes imagnx@latest login --openai <key>` (or `--gemini <key>`) — writes `~/.imagnx/credentials.toml` mode 600. Then retry the original call. The unprefixed `OPENAI_API_KEY` / `GEMINI_API_KEY` env vars are not read. |
| 3 (`UnsupportedFeature`) | Re-run with a model that supports the feature; the message names valid models. |
| 4 (`InvalidArgs`) | Surface the validation error verbatim. Ask the user to correct flags or arguments. |
| 5 (`RateLimited`) | Wait 30 to 60 seconds, then retry the same command. |
| 6 (`ProviderError`) | Surface the provider's message. Do not retry without user input. |

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

User asks to generate but `IMAGNX_OPENAI_API_KEY` is missing (exit 2). Ask only for the OpenAI key, then:
```bash
npx --yes imagnx@latest login --openai sk-...
npx --yes imagnx@latest "<original prompt>" --json
```
