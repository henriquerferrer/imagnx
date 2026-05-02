# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

- `costEstimateUsd` field from `ImageResult` and `SavedResult` — was never
  populated by any provider. Will return when implemented end-to-end.
- Unused `openai-edit-mask.json` integration fixture.
- Unused `debug` field on `SharedGenerateOpts` (the catch handler reads
  `process.argv` directly; the field was dead).
- Runtime dependency on Bun. Bun is no longer required for development
  either; `npm` covers everything.
