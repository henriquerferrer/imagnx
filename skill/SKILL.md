---
name: imagnx
description: Generate or edit images with multi-model AI (OpenAI, Gemini Nano Banana). Use when the user says "generate an image", "create a picture", "make an image", "edit this photo", "change the background", or invokes /imagnx.
when_to_use: Trigger on image generation or editing requests. Skip for metaphorical phrases ("paint a picture in your mind") or non-visual tasks.
disable-model-invocation: false
allowed-tools: Bash(command -v *) Bash(imagnx *) Bash(npm install *) Bash(jq *)
compatibility: Requires Node.js ≥18 and either OPENAI_API_KEY or GEMINI_API_KEY in env.
metadata:
  version: "0.1.0"
  repository: github.com/henriquerferrer/imagnx
---

# imagnx

> **Side-effect notice:** This skill makes paid API calls (OpenAI, Gemini) and writes image files. It auto-fires on natural-language image requests. To restrict to manual `/imagnx` invocation only, set `disable-model-invocation: true` in this skill's frontmatter.

Generate or edit images using the `imagnx` CLI. The CLI dispatches to OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana). See [reference.md](reference.md) for the full flag list, supported models, and exit codes.

## Step 1 — Pre-flight: install detection

Before doing anything else, run:

```bash
command -v imagnx >/dev/null 2>&1 && imagnx --version || echo "MISSING"
```

If the output is `MISSING`:
1. Tell the user: "imagnx is not installed. Installing now via `npm install -g github.com/henriquerferrer/imagnx`."
2. Run: `npm install -g github.com/henriquerferrer/imagnx`
3. Verify: `imagnx --version`. If still missing, print: "Manual install: clone https://github.com/henriquerferrer/imagnx and run `npm install -g .`" and stop.

## Step 2 — Parse the request

Extract from the user's message:
- **prompt** (required): the user's textual description, quoted as a single string.
- **refs** (optional): file paths the user mentioned (e.g. "this image", "photo.png"). Use absolute paths.
- **mask** (optional): a path mentioned alongside "mask".
- **model** (optional): if the user named a model (`gpt-image-1.5`, `nano-banana`, etc.).
- **compare** (boolean): user said "compare", "all models", "both", "side by side".
- **open**: user said "show me", "let me see", "open it".

## Step 3 — Run the CLI

Always pass `--json` so output is parseable.

**Generation:**
```bash
imagnx "<prompt>" --json [--compare] [-m <model>] [--open]
```

**Edit:**
```bash
imagnx edit <ref1> [<ref2> ...] "<prompt>" --json [--mask <m>] [-m <model>] [--open]
```

Capture stdout. Parse with `jq` if needed.

## Step 4 — Present output

From `{ "results": [...], "errors": [...] }`:
- Print each result as `✓ <model>: <path>` to the user.
- If errors are present, print `✗ <model>: <message>` for each.

## Step 5 — Recover from errors

| Exit | Action |
|---|---|
| 2 (`MissingApiKey`) | Tell the user which env var to set: `export OPENAI_API_KEY=...` or `export GEMINI_API_KEY=...`. |
| 3 (`UnsupportedFeature`) | Re-run with a model that supports the feature (the message names valid models). |
| 4 (`InvalidArgs`) | Surface the validation error verbatim; ask the user to correct flags or arguments. |
| 5 (`RateLimited`) | Tell the user to wait 30–60 seconds and retry the same command. |
| 6 (`ProviderError`) | Surface the provider's message. Do not retry without user input. |

## Examples

**User:** "generate an image of a cat astronaut on the moon"
```bash
imagnx "a cat astronaut on the moon" --json
```

**User:** "make me an image showing a red car, and show it to me"
```bash
imagnx "a red car" --json --open
```

**User:** "compare a sunset across all the image models"
```bash
imagnx "a sunset over mountains" --compare --json
```

**User:** "edit /tmp/photo.png to make the sky purple"
```bash
imagnx edit /tmp/photo.png "make the sky purple" --json
```

**User:** "edit /tmp/photo.png with mask /tmp/sky.png — change the sky to stars"
```bash
imagnx edit /tmp/photo.png --mask /tmp/sky.png "stars in the sky" --json
```
