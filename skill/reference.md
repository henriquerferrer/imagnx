# imagn reference

## Commands

- `imagn "<prompt>" [flags]` — generation shorthand.
- `imagn generate "<prompt>" [flags]` — explicit form.
- `imagn edit <refs...> "<prompt>" [flags]` — edits with reference images.
- `imagn models` — list models per provider with capabilities.
- `imagn init` — write a starter `~/.config/imagn/config.toml`.
- `imagn config` — print resolved config and key status.

## Flags

| Flag | Type | Description |
|---|---|---|
| `-m, --model <id[,id]>` | string | Model id or comma list. Defaults to config or `gpt-image-1.5`. |
| `--compare` | bool | Run across all configured providers. Overrides `-m`. |
| `-s, --size <size>` | string | `1024x1024`, `1536x1024`, `1024x1536`, `auto`. |
| `-q, --quality <q>` | string | `low`, `medium`, `high`, `auto`. |
| `-n <num>` | int | Images per model. Default 1. |
| `--mask <path>` | path | (edit only) PNG alpha mask. Requires exactly one ref image. |
| `-o, --output <path>` | path | File or directory override. |
| `--open` | bool | Open results in default viewer. |
| `--json` | bool | Stable JSON output: `{"results":[...],"errors":[...]}`. |
| `--dry-run` | bool | Validate, don't call APIs. |
| `--debug` | bool | Verbose logs. |

## Supported models

- **openai:** `gpt-image-1.5` (edit ✓, mask ✓)
- **google:** `gemini-2.5-flash-image` (edit ✓, mask ✗)

## Exit codes

`0` ok · `1` unknown · `2` missing API key · `3` unsupported feature · `4` invalid args · `5` rate limited · `6` provider error · `7` partial failure
