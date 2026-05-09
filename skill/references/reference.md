# imagnx reference

> Invocation: always use `npx --yes imagnx@latest <args>` (no install needed). The unprefixed `imagnx <args>` form used in this reference is shorthand for readability; both forms accept the same flags.

## Commands

- `imagnx "<prompt>" [flags]`: generation shorthand.
- `imagnx generate "<prompt>" [flags]`: explicit form.
- `imagnx edit <refs...> "<prompt>" [flags]`: edits with reference images.
- `imagnx icon "<prompt>" [flags]`: app-icon-style generation with multi-layer prompt enhancement and `--style` presets.
- `imagnx models`: list models per provider with capabilities.
- `imagnx init`: write a starter `~/.imagnx/config.toml`.
- `imagnx login [--openai <key>] [--gemini <key>]`: save provider keys to `~/.imagnx/credentials.toml` (mode 600). Interactive (hidden prompt) when no flags; flags skip prompts and are agent-friendly.
- `imagnx config`: print resolved config and key status.

## Flags

| Flag | Type | Description |
|---|---|---|
| `-m, --model <id[,id]>` | string | Model id (or alias). Comma-separated list fans out across multiple models. Defaults to config or `gpt-image-1.5`. |
| `-s, --size <size>` | string | Model-aware. `auto` works everywhere. gpt-image-1.5: `1024x1024`, `1536x1024`, `1024x1536`. gpt-image-2 adds `2048x2048`, `2048x1152`, `3840x2160`, `2160x3840`. gemini-3-pro-image-preview adds `1024x1024`. gemini-2.5-flash-image: `auto` only. |
| `-q, --quality <q>` | string | Model-aware (see Quality by model below). gpt-image-*: `low`/`medium`/`high`/`auto`. gemini-2.5-flash-image: `auto` only. gemini-3-pro-image-preview: `1k`/`2k`/`4k`. |
| `--n <num>` | int | Images per model. Default 1. |
| `--mask <path>` | path | (edit only) PNG alpha mask. OpenAI models only. Requires exactly one ref image. |
| `-o, --output <path>` | path | File or directory override. |
| `--open` | bool | Open results in default viewer. |
| `--json` | bool | Stable JSON output: `{"results":[...],"errors":[...]}`. |
| `--dry-run` | bool | Validate, don't call APIs. |
| `--style <name>` | string | Style preset (`minimalism`, `pixel`, etc.) or free-form hint. Icon-only presets rejected on `generate`/`edit` (exit 4). |
| `--openai-api-key <key>` | string | One-shot OpenAI key (overrides `IMAGNX_OPENAI_API_KEY` and `credentials.toml`; not persisted). |
| `--gemini-api-key <key>` | string | One-shot Gemini key (overrides `IMAGNX_GEMINI_API_KEY` / `IMAGNX_GOOGLE_API_KEY` and `credentials.toml`; not persisted). |
| `--debug` | bool | Verbose logs. |

## Supported models

- **openai:** `gpt-image-1.5` (edit ✓, mask ✓), `gpt-image-2` (edit ✓, mask ✓)
- **google:** `gemini-2.5-flash-image` (edit ✓, mask ✗); alias: `nano-banana`
- **google:** `gemini-3-pro-image-preview` (edit ✓, mask ✗); alias: `nano-banana-pro`. Quality tiers: `1k` (default) / `2k` / `4k`.

## `imagnx icon` flags

| Flag | Short | Default | Description |
|---|---|---|---|
| `<prompt>` |  | required | What the icon represents (positional) |
| `--style <name>` |  |  | Preset name or free-form hint |
| `--size <size>` |  | `1024x1024` | Image size override (model-aware; see Flags table for valid sizes per model) |
| `--prompt-only` |  | `false` | Print enhanced prompt; no API call (works without keys) |
| `--raw-prompt` | `-r` | `false` | Skip enhancement; send prompt verbatim |
| `--use-icon-words` | `-i` | `false` | Include "icon"/"logo" wording (default: off to reduce padding) |
| `--model <id>` | `-m` | `gpt-image-1.5` | Model ID |
| `--quality <q>` | `-q` |  | Model-aware: `auto/high/medium/low` (OpenAI) or `1k/2k/4k` (gemini-3-pro). Aliases: `hd`→`high`, `standard`→`medium` |
| `--n <num>` |  | `1` | Number of images |
| `--output <path>` | `-o` |  | Output file or directory override |
| `--open` |  | `false` | Open results in default viewer |
| `--json` |  | `false` | Emit structured JSON |

## Styles

| Preset | Applies to |
|---|---|
| `minimalism`, `flat`, `pixel`, `kawaii`, `neon`, `holographic`, `material` | generate / icon / edit |
| `ios-classic`, `android-material`, `glassy`, `clay`, `woven`, `geometric`, `gradient`, `game`, `cute` | icon only |

## Quality by model

| Model | Valid `--quality` |
|---|---|
| `gpt-image-1.5`, `gpt-image-2` | `auto`, `high`, `medium`, `low` (aliases: `hd`→`high`, `standard`→`medium`) |
| `gemini-2.5-flash-image` | `auto` |
| `gemini-3-pro-image-preview` | `1k` (default), `2k`, `4k` |

## Exit codes

`0` ok · `1` unknown · `2` missing API key · `3` unsupported feature · `4` invalid args · `5` rate limited · `6` provider error · `7` partial failure
