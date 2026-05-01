---
name: imgen
description: Use when the user wants to generate, create, edit, or modify an image — phrases like "generate an image of...", "create a picture of...", "make an image showing...", "edit this photo to...", "change the background of...", "turn this into a...". Also fires on explicit `/imgen` invocation. Skip for metaphorical uses ("paint a picture in your mind") or non-image tasks.
---

# imgen

Generate or edit images using the `imgen` CLI. The CLI dispatches to OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana). See `reference.md` for the full flag list.

## Step 1 — Pre-flight: install detection

Before doing anything else, run:

```bash
command -v imgen >/dev/null 2>&1 && imgen --version || echo "MISSING"
```

If the output is `MISSING`:
1. Tell the user: "imgen is not installed. Installing now via `bun install -g github.com/<user>/imgen`."
2. Run: `bun install -g github.com/<user>/imgen`
3. Verify: `imgen --version`. If still missing, print: "Manual install: clone https://github.com/<user>/imgen and run `bun install -g .`" and stop.

(Replace `<user>` with the actual GitHub user/org during repo setup.)

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
imgen "<prompt>" --json [--compare] [-m <model>] [--open]
```

**Edit:**
```bash
imgen edit <ref1> [<ref2> ...] "<prompt>" --json [--mask <m>] [-m <model>] [--open]
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
| 6 (`ProviderError`) | Surface the provider's message. Do not retry without user input. |

## Examples

**User:** "generate an image of a cat astronaut on the moon"
```bash
imgen "a cat astronaut on the moon" --json
```

**User:** "make me an image showing a red car, and show it to me"
```bash
imgen "a red car" --json --open
```

**User:** "compare a sunset across all the image models"
```bash
imgen "a sunset over mountains" --compare --json
```

**User:** "edit /tmp/photo.png to make the sky purple"
```bash
imgen edit /tmp/photo.png "make the sky purple" --json
```

**User:** "edit /tmp/photo.png with mask /tmp/sky.png — change the sky to stars"
```bash
imgen edit /tmp/photo.png --mask /tmp/sky.png "stars in the sky" --json
```
