# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-03

### Added

- `imagnx icon "<prompt>"` subcommand with multi-layer prompt enhancement (ported from [SnapAI](https://github.com/betomoedano/snapai), MIT).
- `--style <name>` on `imagnx`, `imagnx icon`, and `imagnx edit`. 16 presets total: 7 universal (`minimalism`, `flat`, `pixel`, `kawaii`, `neon`, `holographic`, `material`) and 9 icon-only (`glassy`, `woven`, `geometric`, `gradient`, `ios-classic`, `android-material`, `clay`, `game`, `cute`). Subcommand-scoped allowlists; mismatches exit 4 with a clear message.
- `--prompt-only`, `--raw-prompt` (`-r`), `--use-icon-words` (`-i`) flags on `imagnx icon`.
- `gemini-3-pro-image-preview` model (alias `nano-banana-pro`) with quality tiers `1k`/`2k`/`4k` and multi-image support.
- Quality aliases: `hd` → `high`, `standard` → `medium`.

### Changed

- Quality validation is now model-aware. Each model declares its valid `qualityValues`; mismatches exit with code 4 and a clear message naming the valid values.

## [0.1.7] - 2026-05-02

### Fixed

- OpenAI provider no longer sends `response_format=b64_json` to the
  `/v1/images/generations` and `/v1/images/edits` endpoints. OpenAI
  removed the parameter from the gpt-image family (`gpt-image-1.5`,
  `gpt-image-2`); requests including it now fail with HTTP 400
  `Unknown parameter: 'response_format'.`, which broke every generate
  and edit call against those models. The response shape is unchanged
  (gpt-image-* always returns base64 in `data[].b64_json`), so the
  existing parser keeps working with the parameter dropped.

## [0.1.6] - 2026-05-02

### Changed

- `skill/SKILL.md` rewritten for Anthropic Skills best practices:
  trigger-forward `description` (verb list plus a `SKIP:` clause)
  to maximize correct triggering; dropped the always-run pre-flight
  install gate (no official Anthropic skill uses one) in favor of an
  inline recovery note when `imagnx` is not on PATH; dropped the
  side-effect notice banner (warnings live action-adjacent in
  reference skills); dropped the non-standard `compatibility` and
  `when_to_use` frontmatter (description is the canonical place for
  trigger info per `skill-creator`).
- README and `skill/reference.md`: stripped em dashes; tightened the
  "ignored unprefixed env vars" copy and removed the shell-history
  caveat from the `imagnx login --openai` section.

## [0.1.5] - 2026-05-02

### Added

- `~/.imagnx/credentials.toml` (or `.yml` / `.yaml`) for storing
  provider API keys outside env vars. Lookup mirrors the existing
  config-file pattern: `credentials.toml` → `credentials.yml` →
  `credentials.yaml`. Fields: `openai_api_key`, `gemini_api_key` (or
  `google_api_key` as an alias). Env vars still win over the file so
  `IMAGNX_OPENAI_API_KEY=… imagnx …` overrides per-shell.
- `imagnx login` subcommand. Interactive form prompts for each key
  with hidden stdin input; blank skips a provider, existing values
  are preserved on re-run. Non-interactive form: `imagnx login
  --openai <key> [--gemini <key>]` skips the prompts (agent-friendly;
  keys land in shell history). The file is written with mode 600.
- Startup warning when the credentials file is group/world-readable,
  pointing at `chmod 600`.
- `scripts/sync-skill-version.mjs` plus a `version` npm-lifecycle
  hook that keeps `skill/SKILL.md`'s `metadata.version` in lock-step
  with `package.json#version` on every `npm version <bump>`.

### Changed

- `imagnx config` now reports `openai key: ✓/✗` and `gemini key:
  ✓/✗` based on env-or-file presence, and prints the credentials
  file path when one is loaded.
- README + skill docs: quick-start leads with `imagnx login`; the
  resolution order is split into two ladders (config: defaults →
  file → env → flags / provider keys: env → file); the
  `MissingApiKey` recovery in `skill/SKILL.md` recommends `imagnx
  login --openai <key>` as the primary remediation.

## [0.1.4] - 2026-05-02

### Changed

- **Breaking:** provider API keys are now read only from the
  `IMAGNX_`-prefixed env vars: `IMAGNX_OPENAI_API_KEY`,
  `IMAGNX_GEMINI_API_KEY`, `IMAGNX_GOOGLE_API_KEY`. The conventional
  `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY` are no longer
  read. Rationale: those names typically belong to the user's general
  OpenAI/Google tooling, and silently spending them through imagnx is
  the kind of implicit-consent surprise we don't want. Existing users
  must `export IMAGNX_OPENAI_API_KEY=$OPENAI_API_KEY` (or similar) once.
- `imagnx config` status output prints the `IMAGNX_*` provider-key
  names. `MissingApiKey` errors now name the `IMAGNX_*` form.
- README skill section dropped the "(Claude Code)" qualifier; the
  `npx skills` install path applies to any skills-aware client.
- README install section dropped the "from source" `npm install -g
  github.com/...` line; manual skill install collapsed to a single
  `curl` for `SKILL.md`.

## [0.1.3] - 2026-05-02

### Added

- YAML config support. Drop a `~/.imagnx/config.yml` (or `.yaml`) using
  the same key names as the TOML form.
- `parseYamlConfig` exported alongside `parseTomlConfig`.

### Changed

- Config file location moved from `~/.config/imagnx/config.toml` (XDG)
  to `~/.imagnx/config.toml`. Lookup order is now
  `config.toml` → `config.yml` → `config.yaml` under `~/.imagnx/`.
  `imagnx init` writes to the new location.
- Env var prefix renamed `IMAGN_*` → `IMAGNX_*`. Affected:
  `IMAGNX_DEFAULT_MODEL`, `IMAGNX_OUTPUT_DIR`, `IMAGNX_DEFAULT_SIZE`,
  `IMAGNX_DEFAULT_QUALITY`, `IMAGNX_OPEN_AFTER`, `IMAGNX_DEBUG`,
  `IMAGNX_REQUEST_TIMEOUT_MS`. Old `IMAGN_*` names are no longer
  honored.
- `resolveConfig` now takes `file: LoadedConfig | undefined` instead
  of `tomlText: string | undefined` so the format can be propagated
  from `loadConfigFile`.
- GitHub repository renamed `henriquerferrer/imagn` →
  `henriquerferrer/imagnx`. `package.json#repository.url` and the
  install URLs in README + skill/SKILL.md updated. GitHub auto-redirects
  the old URL so existing clones still work.

### Removed

- XDG (`$XDG_CONFIG_HOME`) config path lookup.
- Backward compatibility for the legacy `IMAGN_*` env var prefix.

## [0.1.1] - 2026-05-02

### Fixed

- `--help` title now shows `imagnx` instead of the legacy `imagn`. The
  source rename (`meta.name` in `defineCommand`) shipped after the 0.1.0
  artifact was built; this republish brings the help text in line with
  the package and binary names.

## [0.1.0] - 2026-05-02

Initial public release.

### Added

- Multi-model image generation CLI with subcommands `generate`, `edit`,
  `models`, `init`, `config`, plus a bare-prompt shorthand
  (`imagnx "<prompt>"`).
- Providers: OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google
  (`gemini-2.5-flash-image`, alias `nano-banana`).
- `gpt-image-2` size matrix: `1024x1024`, `1536x1024`, `1024x1536`,
  `2048x2048`, `2048x1152`, `3840x2160`, `2160x3840`, `auto`.
- CLI-side validation of `--size` and `--quality` against the known preset
  set; invalid values throw `InvalidArgs` (exit code 4) before any HTTP call.
- `runGenerate` / `runEdit` shared a single resolution + output path via
  `resolveShared` and `executeAndOutput`.
- `validateLocalImage` helper deduplicating the existence/type/size checks
  for ref images and masks.
- `reportAndExit` shared error-logging helper used by both the per-command
  `withExitCode` wrapper and the entry-point catch.
- Documented exit codes (`0` ok, `1` unknown, `2` `MissingApiKey`,
  `3` `UnsupportedFeature`, `4` `InvalidArgs`, `5` `RateLimited`,
  `6` `ProviderError`, `7` `PartialFailure`).
- Claude Code skill (`skill/SKILL.md` + `skill/reference.md`) with install
  detection, error-recovery table, and natural-language trigger guidance.
- `LICENSE` (MIT), `repository`, `author`, `license` fields in `package.json`.
- GitHub Actions CI: typecheck + tests across Node 18/20/22 on push and PR.
- npm publish setup: `bin` points to `./dist/cli.js`; `prepare` script runs
  `tsc -p tsconfig.build.json` so git installs produce a runnable
  per-module ESM build. `engines.node >=18`.

### Changed

- Toolchain migrated from Bun to Node:
  - Test runner: `bun:test` → `vitest`.
  - TypeScript runner for dev/scripts: `bun run` → `tsx`.
  - Build: `bun build --target=node` → `tsc -p tsconfig.build.json`
    (per-module ESM, deps resolved at install time).
  - Module resolution: `bundler` → `NodeNext`; all relative imports
    carry explicit `.js` extensions per ESM-on-Node rules.
  - `Bun.spawn` replaced with `child_process.spawn` (detached, unref'd)
    in `output.openInViewer`.
  - `import.meta.dir` (Bun-only) replaced with
    `fileURLToPath(new URL(".", import.meta.url))` in integration tests.
  - Shebang switched to `#!/usr/bin/env node`.
  - `package.json` `with { type: "json" }` import replaced with
    `createRequire` for portable Node ≥18 support.
- README skill install instructions use the real `npx skills` package
  manager (`vercel-labs/skills`) with the correct subdirectory URL form,
  plus manual `curl`/`cp` fallbacks.

### Fixed

- Bare-prompt shorthand routing when string flags precede the prompt
  (`imagnx -m gpt-image-2 "..."`). The argv preprocessor previously
  injected `generate` between the flag-value pair and the prompt, which
  citty's parent-command parser mis-routed as `Unknown command
  gpt-image-2`. The patcher now injects `generate` at position 0 whenever
  no explicit subcommand is present, so citty routes through the
  subcommand parser. Extracted into `src/argv.ts` with unit coverage.
- Exit codes now match the documented contract (2–7 from `ImgenError`).
  citty's `runMain` was unconditionally calling `process.exit(1)` on every
  thrown error, masking the exit-code mapping. Each subcommand body is now
  wrapped in `withExitCode` so the right code is set before citty's catch
  fires. Side effect: errors no longer print twice.
- `init` command's catch handler narrows `unknown` properly instead of
  using `: any`.
- Provider error-message construction no longer needs `as string` casts;
  the ternary now produces a `string` directly.

### Removed

- `costEstimateUsd` field from `ImageResult` and `SavedResult`; was never
  populated by any provider. Will return when implemented end-to-end.
- Unused `openai-edit-mask.json` integration fixture.
- Unused `debug` field on `SharedGenerateOpts` (the catch handler reads
  `process.argv` directly; the field was dead).
- Runtime dependency on Bun. Bun is no longer required for development
  either; `npm` covers everything.
