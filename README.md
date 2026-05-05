# imagnx

Multi-model image generation CLI. Supports OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana, `gemini-3-pro-image-preview` aka Nano Banana Pro). Includes a dedicated icon mode with 16 style presets.

## Install

Requires Node.js ≥18.

```bash
npm install -g imagnx
```

## Quick start

```bash
imagnx login                                         # interactive: prompts for keys, writes ~/.imagnx/credentials.toml
imagnx "a cat astronaut on the moon"
imagnx "a cat astronaut on the moon" -m gpt-image-1.5,nano-banana -q auto   # multi-model fan-out
imagnx edit photo.png "give the cat a red helmet"
```

Or skip the login step and use env vars instead:

```bash
export IMAGNX_OPENAI_API_KEY=sk-...
export IMAGNX_GEMINI_API_KEY=...
```

Provider keys come from the `IMAGNX_`-prefixed env vars or `~/.imagnx/credentials.toml`.

## Icon mode

For app-icon-style outputs, use the dedicated subcommand. It wraps your prompt in multi-layer scaffolding (archetype selection, anti-padding rules, Android safe-area, blur QA) ported from [SnapAI](https://github.com/betomoedano/snapai) (MIT).

```bash
imagnx icon "weather app, sun and cloud"
imagnx icon "fitness tracker" --style minimalism
imagnx icon "calculator" --prompt-only        # preview the enhanced prompt
imagnx icon "notes app" --raw-prompt          # bypass enhancement
imagnx icon "banking app" --use-icon-words    # include "icon"/"logo" wording
imagnx icon "music player" --model nano-banana-pro --quality 2k -n 3
```

Default model is `gpt-image-1.5`; default size is `1024x1024`.

## Styles

`--style <name>` applies a preset directive to the prompt. Some presets are universal; others are icon-only.

| Preset | Applies to |
|---|---|
| `minimalism`, `flat`, `pixel`, `kawaii`, `neon`, `holographic`, `material` | generate / icon / edit |
| `ios-classic`, `android-material`, `glassy`, `clay`, `woven`, `geometric`, `gradient`, `game`, `cute` | icon only |

Selecting an icon-only preset on a non-icon command exits with code 4 and a clear message. You can also pass a free-form `--style "made of moss"` for a soft hint.

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
| OpenAI | `gpt-image-1.5` | ✓ | ✓ | 1024², 1536×1024, 1024×1536 |
| OpenAI | `gpt-image-2` | ✓ | ✓ | (above) + 2048², 2048×1152, 3840×2160, 2160×3840 |
| Google | `gemini-2.5-flash-image` | ✓ | ✗ | auto |
| Google | `gemini-3-pro-image-preview` | ✓ | ✗ | auto, 1024² |

`auto` works on every model. Quality: OpenAI accepts `low`/`medium`/`high`/`auto`; `gemini-2.5-flash-image` accepts `auto` only; `gemini-3-pro-image-preview` accepts `1k` (default) / `2k` / `4k`.

Aliases: `nano-banana` → `gemini-2.5-flash-image`, `nano-banana-pro` → `gemini-3-pro-image-preview`. See [`skill/reference.md`](skill/reference.md) for the full flag list and exit codes.

## Configuration

Run `imagnx init` to create `~/.imagnx/config.toml`. Defaults:

```toml
default_model    = "gpt-image-1.5"
output_dir       = "~/Pictures/imagnx"
default_size     = "auto"
default_quality  = "high"
open_after       = false
```

YAML works too. Drop a `~/.imagnx/config.yml` (or `.yaml`) instead:

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

For one-shot / scripted use (e.g. Claude Code), pass keys as flags so the prompt is skipped:

```bash
imagnx login --openai sk-... --gemini g-...
imagnx login --gemini g-...     # only update one provider
```

You can also create the file by hand (TOML, plus `.yml` / `.yaml`, same lookup order as `config`):

```toml
openai_api_key = "sk-..."
gemini_api_key = "..."   # or google_api_key
```

If you write the file manually, run `chmod 600 ~/.imagnx/credentials.toml`. imagnx warns on startup if the file is group/world-readable.

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
