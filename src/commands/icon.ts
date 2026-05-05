import { defineCommand } from "citty";
import { buildFinalIconPrompt } from "../icon-prompt.js";
import { validateStyleForCommand } from "../styles.js";

export interface IconOpts {
  prompt: string;
  style?: string;
  promptOnly?: boolean;
  rawPrompt?: boolean;
  useIconWords?: boolean;
}

// Build (or print) the enhanced prompt. Returns the string for the runner;
// when --prompt-only is set, signals "do not run".
export interface IconBuildResult {
  enhancedPrompt: string;
  printOnly: boolean;
}

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

export const iconCmd = defineCommand({
  meta: {
    name: "icon",
    description: "Generate an app-icon-style image with multi-layer prompt enhancement",
  },
  args: {
    prompt: {
      type: "positional" as const,
      description: "What the icon represents",
      required: true,
    },
    style: {
      type: "string" as const,
      description: "Style preset (run with --help for list) or free-form style hint",
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
      description: "Image quality (model-aware: e.g. high for OpenAI, 2k for gemini-3-pro)",
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
  // The actual run() body lives in cli.ts (Task 7) so it can reuse
  // resolveShared/executeAndOutput without circular imports.
});
