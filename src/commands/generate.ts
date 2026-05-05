import { defineCommand } from "citty";
import { validateRequest } from "../registry.js";
import { validateStyleForCommand, getStyleDirective } from "../prompt/styles.js";
import {
  executeAndOutput,
  resolveShared,
  withExitCode,
  type SharedGenerateOpts,
} from "../pipeline.js";
import type { RunRequest } from "../runner.js";
import { sharedArgs, sharedOptsFromArgs } from "./_shared.js";

export async function runGenerate(opts: SharedGenerateOpts): Promise<void> {
  let effectivePrompt = opts.prompt;
  if (opts.style !== undefined) {
    const id = validateStyleForCommand(opts.style, "generate");
    effectivePrompt = `Style directive: ${getStyleDirective(id)}\n\n${opts.prompt}`;
  }

  const { cfg, modelIds, size, quality, n, providers } = resolveShared(
    opts,
    process.env,
  );

  for (const modelId of modelIds) {
    validateRequest(modelId, { kind: "generate", size, quality });
  }

  if (opts.dryRun) {
    process.stderr.write(
      `[dry-run] kind=generate models=${modelIds.join(",")} prompt=${effectivePrompt}\n`,
    );
    return;
  }

  const req: RunRequest = {
    kind: "generate",
    modelIds,
    input: { prompt: effectivePrompt, size, quality, n },
  };
  await executeAndOutput(req, cfg, providers, { ...opts, prompt: effectivePrompt });
}

export const generateCmd = defineCommand({
  meta: {
    name: "generate",
    description: "Generate an image from a text prompt",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "Text prompt",
      required: true,
    },
    ...sharedArgs,
  },
  run({ args }) {
    return withExitCode(() => runGenerate(sharedOptsFromArgs(args)));
  },
});
