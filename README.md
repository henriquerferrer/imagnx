# imagnx

Multi-model image generation CLI. Supports OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana).

## Install

Requires Node.js ≥18.

```bash
npm install -g imagnx          # once published
# or, from source:
npm install -g github.com/henriquerferrer/imagnx   # builds dist/ via prepare hook
```

## Quick start

```bash
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
imagnx "a cat astronaut on the moon"
imagnx "a cat astronaut on the moon" --compare       # fan out across providers
imagnx edit photo.png "give the cat a red helmet"
```

## Skill (Claude Code)

Install via [`npx skills`](https://github.com/vercel-labs/skills) (the community skill package manager):

```bash
npx skills add https://github.com/henriquerferrer/imagnx/tree/main/skill
```

Or install manually by copying `skill/` into your skills directory:

```bash
# user-level (all projects)
mkdir -p ~/.claude/skills/imagnx
curl -fsSL https://raw.githubusercontent.com/henriquerferrer/imagnx/main/skill/SKILL.md     -o ~/.claude/skills/imagnx/SKILL.md
curl -fsSL https://raw.githubusercontent.com/henriquerferrer/imagnx/main/skill/reference.md -o ~/.claude/skills/imagnx/reference.md

# project-level
mkdir -p .claude/skills/imagnx && cp -r path/to/imagnx/skill/* .claude/skills/imagnx/
```

The skill auto-detects when the CLI is missing and installs it on first use.

## Models

| Provider | Model | Edit | Mask | Sizes |
|---|---|---|---|---|
| OpenAI | `gpt-image-1.5` | ✓ | ✓ | up to 1536×1024 |
| OpenAI | `gpt-image-2` | ✓ | ✓ | up to 3840×2160 |
| Google | `gemini-2.5-flash-image` | ✓ | ✗ | auto |

`nano-banana` is an alias for `gemini-2.5-flash-image`. See [`skill/reference.md`](skill/reference.md) for the full flag list and exit codes.

## Configuration

Run `imagnx init` to create `~/.imagnx/config.toml`. Defaults:

```toml
default_model    = "gpt-image-1.5"
output_dir       = "~/Pictures/imagnx"
default_size     = "auto"
default_quality  = "high"
open_after       = false
```

YAML works too — drop a `~/.imagnx/config.yml` (or `.yaml`) instead:

```yaml
default_model: gpt-image-1.5
output_dir: ~/Pictures/imagnx
default_size: auto
default_quality: high
open_after: false
```

Lookup order: `config.toml` → `config.yml` → `config.yaml` (first match wins).

Env var overrides (all `IMAGNX_*`): `IMAGNX_DEFAULT_MODEL`, `IMAGNX_OUTPUT_DIR`, `IMAGNX_DEFAULT_SIZE`, `IMAGNX_DEFAULT_QUALITY`, `IMAGNX_OPEN_AFTER`, `IMAGNX_DEBUG`.

Resolution order: hard-coded defaults → config file → env vars → CLI flags.

## Development

```bash
npm install
npm test                   # vitest
npm run typecheck          # tsc --noEmit
npm run build              # writes dist/ via tsc
npm run smoke              # real API calls; needs keys set
```
