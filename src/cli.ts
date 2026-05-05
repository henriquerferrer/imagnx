#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { createRequire } from "node:module";

import { patchedRawArgs } from "./argv.js";
import { reportAndExit, withExitCode } from "./pipeline.js";
import { sharedArgs, sharedOptsFromArgs } from "./commands/_shared.js";
import { runGenerate } from "./commands/generate.js";
import { subCommands, SUBCOMMAND_NAMES } from "./commands/index.js";

const pkg = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const main = defineCommand({
  meta: {
    name: "imagnx",
    version: pkg.version,
    description: "Multi-model image generation CLI",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "Text prompt (shorthand for generate)",
      required: false,
    },
    ...sharedArgs,
  },
  subCommands,
  run({ args, rawArgs }) {
    return withExitCode(() => {
      // Citty calls the parent's run() even after a subcommand matches; bail
      // so we don't double-handle.
      const firstPositional = rawArgs.find((a) => !a.startsWith("-"));
      if (firstPositional && SUBCOMMAND_NAMES.includes(firstPositional)) {
        return;
      }
      if (!args.prompt) {
        // No prompt and no subcommand — citty prints usage on no args.
        return;
      }
      return runGenerate(sharedOptsFromArgs(args));
    });
  },
});

try {
  const rawArgs = patchedRawArgs(process.argv.slice(2));
  await runMain(main, { rawArgs });
} catch (err) {
  reportAndExit(err);
}
