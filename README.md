# imagn

Multi-model image generation CLI. Supports OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana).

## Install

```bash
bun install -g github.com/henriquerferrer/imagn
```

## Quick start

```bash
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
imagn "a cat astronaut on the moon"
imagn "a cat astronaut on the moon" --compare       # fan out across providers
imagn edit photo.png "give the cat a red helmet"
```

## Skill (Claude Code)

```bash
npx skills add github.com/henriquerferrer/imagn/skill
```

The skill auto-detects when the CLI is missing and installs it on first use.

## Models

| Provider | Model | Edit | Mask |
|---|---|---|---|
| OpenAI | `gpt-image-1.5` | ✓ | ✓ |
| Google | `gemini-2.5-flash-image` (Nano Banana) | ✓ | ✗ |

## Configuration

Run `imagn init` to create `~/.config/imagn/config.toml`. Defaults:

```toml
default_model    = "gpt-image-1.5"
output_dir       = "~/Pictures/imagn"
default_size     = "auto"
default_quality  = "high"
open_after       = false
```

Resolution order: hard-coded defaults → config file → env vars → CLI flags.

## Development

```bash
bun install
bun test
bun run scripts/smoke.ts   # real API calls; needs keys set
```
