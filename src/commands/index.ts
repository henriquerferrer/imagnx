// Single source of truth for the registered subcommand set. Both the citty
// wiring in cli.ts and the bare-prompt argv-patcher in argv.ts read from
// here, so adding a subcommand is a one-line change.
import { generateCmd } from "./generate.js";
import { editCmd } from "./edit.js";
import { iconCmd } from "./icon.js";
import { modelsCmd } from "./models.js";
import { initCmd } from "./init.js";
import { loginCmd } from "./login.js";
import { configCmd } from "./config.js";

export const subCommands = {
  generate: generateCmd,
  edit: editCmd,
  icon: iconCmd,
  models: modelsCmd,
  init: initCmd,
  login: loginCmd,
  config: configCmd,
};

export const SUBCOMMAND_NAMES: ReadonlyArray<string> = Object.keys(subCommands);

// Shape of a single citty arg definition we care about for STRING_FLAGS.
type ArgDef = { type?: string; alias?: string };

// Walk every subcommand's args definition and collect the long/short forms of
// every value-consuming (string) flag. argv.ts uses this to decide which
// flags consume the next positional, so it doesn't mis-route a flag value as
// a subcommand name in the bare-prompt path.
function collectStringFlags(): Set<string> {
  const flags = new Set<string>();
  for (const cmd of Object.values(subCommands)) {
    const args = (cmd as { args?: Record<string, ArgDef> }).args ?? {};
    for (const [name, def] of Object.entries(args)) {
      if (def.type !== "string") continue;
      flags.add(`--${name}`);
      if (def.alias) flags.add(`-${def.alias}`);
    }
  }
  return flags;
}

export const STRING_FLAGS = collectStringFlags();
