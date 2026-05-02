# imagnx

Multi-model image generation CLI. Supports OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana).

## Install

Requires Node.js ≥18.

```bash
npm install -g imagnx
```

## Quick start

```bash
imagnx login                                         # interactive: prompts for keys, writes ~/.imagnx/credentials.toml
imagnx "a cat astronaut on the moon"
imagnx "a cat astronaut on the moon" --compare       # fan out across providers
imagnx edit photo.png "give the cat a red helmet"
```

Or skip the login step and use env vars instead:

```bash
export IMAGNX_OPENAI_API_KEY=sk-...
export IMAGNX_GEMINI_API_KEY=...
```

Provider keys come from the `IMAGNX_`-prefixed env vars or `~/.imagnx/credentials.toml` — the conventional `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY` are deliberately ignored so imagnx never spends a key the user set up for a different tool.

## Skill

Install via [`npx skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add https://github.com/henriquerferrer/imagnx/tree/main/skill
```

Or install manually (Claude Code example):

```bash
mkdir -p ~/.claude/skills/imagnx
curl -fsSL https://raw.githubusercontent.com/henriquerferrer/imagnx/main/skill/SKILL.md \
  -o ~/.claude/skills/imagnx/SKILL.md
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

Provider keys: `IMAGNX_OPENAI_API_KEY`, `IMAGNX_GEMINI_API_KEY` (or `IMAGNX_GOOGLE_API_KEY`).

Or run `imagnx login` to be prompted for each key (input is hidden, blank skips a provider, and existing values are kept on re-run). It writes `~/.imagnx/credentials.toml` with mode 600.

For one-shot / scripted use (e.g. Claude Code), pass keys as flags — the prompt is skipped:

```bash
imagnx login --openai sk-... --gemini g-...
imagnx login --gemini g-...     # only update one provider
```

Caveat: keys passed as flags land in shell history and `ps` output. Fine for one-off setup; use the interactive form if that matters.

You can also create the file by hand (TOML, plus `.yml` / `.yaml` — same lookup order as `config`):

```toml
openai_api_key = "sk-..."
gemini_api_key = "..."   # or google_api_key
```

If you write the file manually, run `chmod 600 ~/.imagnx/credentials.toml` — imagnx warns on startup if the file is group/world-readable.

Env vars win over the credentials file when both are set, so you can override per-shell without editing the file. Keep `credentials.*` out of any dotfiles repo you sync; `config.*` is safe to commit.

Resolution order:
- **non-secret config** (model, output dir, etc.): hard-coded defaults → config file → env vars → CLI flags
- **provider keys**: env vars → credentials file (env wins so a one-shot `IMAGNX_OPENAI_API_KEY=… imagnx …` overrides the saved key)

## Development

```bash
npm install
npm test                   # vitest
npm run typecheck          # tsc --noEmit
npm run build              # writes dist/ via tsc
npm run smoke              # real API calls; needs keys set
```
