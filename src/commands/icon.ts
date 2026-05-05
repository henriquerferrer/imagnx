import { defineCommand } from "citty";
import { buildFinalIconPrompt } from "../prompt/icon-prompt.js";
import { validateStyleForCommand } from "../prompt/styles.js";
import { validateRequest } from "../registry.js";
import {
  executeAndOutput,
  resolveShared,
  withExitCode,
  type SharedGenerateOpts,
} from "../pipeline.js";
import type { RunRequest } from "../runner.js";
import { parseN } from "./_shared.js";

export interface IconOpts {
  prompt: string;
  style?: string;
  promptOnly?: boolean;
  rawPrompt?: boolean;
  useIconWords?: boolean;
}

export interface IconBuildResult {
  enhancedPrompt: string;
  printOnly: boolean;
}

// Build (or print) the enhanced prompt. Returns the string for the runner;
// when --prompt-only is set, signals "do not run".
export function buildIconRequest(opts: IconOpts): IconBuildResult {
  if (opts.style !== undefined) {
    // Throws InvalidArgs (exit 4) on bad/mismatched style.
    validateStyleForCommand(opts.style, "icon");
  }
  const enhancedPrompt = buildFinalIconPrompt({
    prompt: opts.prompt,
    rawPrompt: opts.rawPrompt,
    style: opts.style,
    useIconWords: opts.useIconWords,
  });
  return { enhancedPrompt, printOnly: opts.promptOnly === true };
}

async function runIcon(opts: IconOpts & SharedGenerateOpts): Promise<void> {
  const built = buildIconRequest({
    prompt: opts.prompt,
    style: opts.style,
    promptOnly: opts.promptOnly,
    rawPrompt: opts.rawPrompt,
    useIconWords: opts.useIconWords,
  });

  if (built.printOnly) {
    process.stdout.write(built.enhancedPrompt + "\n");
    return;
  }

  // Default size for icon mode is 1024x1024 (override possible via --size).
  const sizedOpts: SharedGenerateOpts = { ...opts, size: opts.size ?? "1024x1024" };
  const { cfg, modelIds, size, quality, n, providers } = resolveShared(
    sizedOpts,
    process.env,
  );

  for (const modelId of modelIds) {
    validateRequest(modelId, { kind: "generate", size, quality });
  }

  if (opts.dryRun) {
    process.stderr.write(
      `[dry-run] kind=icon models=${modelIds.join(",")} prompt=${built.enhancedPrompt.slice(0, 80)}...\n`,
    );
    return;
  }

  const req: RunRequest = {
    kind: "generate",
    modelIds,
    input: { prompt: built.enhancedPrompt, size, quality, n },
  };
  await executeAndOutput(req, cfg, providers, {
    ...opts,
    prompt: built.enhancedPrompt,
  });
}

export const iconCmd = defineCommand({
  meta: {
    name: "icon",
    description:
      "Generate an app-icon-style image with multi-layer prompt enhancement",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "What the icon represents",
      required: true,
    },
    style: {
      type: "string" as const,
      description:
        "Style preset (run with --help for list) or free-form style hint",
    },
    "prompt-only": {
      type: "boolean" as const,
      description: "Print the enhanced prompt and exit (no API call)",
      default: false,
    },
    "raw-prompt": {
      type: "boolean" as const,
      alias: "r",
      description: "Skip enhancement and send the prompt verbatim",
      default: false,
    },
    "use-icon-words": {
      type: "boolean" as const,
      alias: "i",
      description: "Include 'icon'/'logo' wording in enhancement (default: off)",
      default: false,
    },
    model: {
      type: "string" as const,
      alias: "m",
      description: "Model ID (defaults to gpt-image-1.5)",
    },
    quality: {
      type: "string" as const,
      alias: "q",
      description:
        "Image quality (model-aware: e.g. high for OpenAI, 2k for gemini-3-pro)",
    },
    size: {
      type: "string" as const,
      alias: "s",
      description: "Image size override (default: 1024x1024)",
    },
    n: {
      type: "string" as const,
      description: "Number of images (positive integer)",
    },
    output: {
      type: "string" as const,
      alias: "o",
      description: "Output file or directory override",
    },
    open: {
      type: "boolean" as const,
      description: "Open results in default viewer after writing",
      default: false,
    },
    json: {
      type: "boolean" as const,
      description: "Stable JSON output: {results:[...],errors:[...]}",
      default: false,
    },
  },
  run({ args }) {
    return withExitCode(() =>
      runIcon({
        prompt: String(args.prompt),
        style: args.style as string | undefined,
        promptOnly: args["prompt-only"] === true,
        rawPrompt: args["raw-prompt"] === true,
        useIconWords: args["use-icon-words"] === true,
        model: args.model as string | undefined,
        size: args.size as string | undefined,
        quality: args.quality as string | undefined,
        n: parseN(args.n as string | undefined),
        output: args.output as string | undefined,
        open: args.open === true,
        json: args.json === true,
        dryRun: false,
      }),
    );
  },
});
