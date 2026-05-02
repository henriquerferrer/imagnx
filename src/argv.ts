// Why this exists:
// `imagnx "my prompt"` should be a shorthand for `imagnx generate "my prompt"`.
// Citty (>=0.1.6) tries to match the first non-flag positional against
// subcommand names; when it doesn't match, it errors with "Unknown command"
// instead of routing to the parent's `run`. We pre-process argv to inject
// `generate` at position 0 whenever no subcommand is present so citty routes
// correctly.
//
// Why "at position 0" rather than "right before the prompt": citty's parent
// command parser does not reliably treat parent-level string flags (e.g.
// `-m foo`) as value-consuming when subcommands are also defined, so an argv
// like `[-m, foo, generate, prompt]` makes it treat `foo` as the subcommand
// name. Putting `generate` first (`[generate, -m, foo, prompt]`) makes citty
// route to the subcommand, which then parses its own flags correctly.
//
// We still need STRING_FLAGS to detect subcommand-vs-flag-value when the user
// writes `imagnx generate -m foo`: without it we'd inject `generate` again
// before `foo` and break the call.
export const KNOWN_SUBCOMMANDS = new Set([
  "generate",
  "edit",
  "models",
  "init",
  "login",
  "config",
]);

export const STRING_FLAGS = new Set([
  "-m", "--model",
  "-s", "--size",
  "-q", "--quality",
  "--n",
  "-o", "--output",
  "--mask",
]);

export function patchedRawArgs(argv: string[]): string[] {
  let skipNext = false;
  for (const arg of argv) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (arg.startsWith("-")) {
      if (!arg.includes("=") && STRING_FLAGS.has(arg)) {
        skipNext = true;
      }
      continue;
    }
    // First non-flag positional: if it's already a subcommand, leave argv alone.
    if (KNOWN_SUBCOMMANDS.has(arg)) return argv;
    // Otherwise inject `generate` at position 0.
    return ["generate", ...argv];
  }
  return argv;
}
