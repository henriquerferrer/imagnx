import { defineCommand } from "citty";
import { InvalidArgs } from "../errors.js";
import { validateRequest } from "../registry.js";
import { validateStyleForCommand, getStyleDirective } from "../prompt/styles.js";
import {
  executeAndOutput,
  resolveShared,
  validateLocalImage,
  withExitCode,
  type SharedGenerateOpts,
} from "../pipeline.js";
import type { RunRequest } from "../runner.js";
import { parseN, sharedArgs } from "./_shared.js";

export interface EditOpts extends SharedGenerateOpts {
  refs: string[];
  mask?: string;
}

export async function runEdit(opts: EditOpts): Promise<void> {
  if (opts.refs.length === 0) {
    throw new InvalidArgs("edit requires at least one reference image path");
  }
  if (!opts.prompt) {
    throw new InvalidArgs("edit requires a prompt (last positional argument)");
  }

  let effectivePrompt = opts.prompt;
  if (opts.style !== undefined) {
    const id = validateStyleForCommand(opts.style, "edit");
    effectivePrompt = `Style directive: ${getStyleDirective(id)}\n\n${opts.prompt}`;
  }

  const MAX_REF_BYTES = 25 * 1024 * 1024; // 25 MB

  for (const ref of opts.refs) {
    validateLocalImage(ref, "Reference image", MAX_REF_BYTES);
  }
  if (opts.mask) {
    validateLocalImage(opts.mask, "Mask image", MAX_REF_BYTES);
  }

  const { readFile } = await import("node:fs/promises");
  const refImages: Uint8Array[] = await Promise.all(
    opts.refs.map(async (r) => new Uint8Array(await readFile(r))),
  );
  const mask: Uint8Array | undefined = opts.mask
    ? new Uint8Array(await readFile(opts.mask))
    : undefined;

  const { cfg, modelIds, size, quality, n, providers } = resolveShared(
    opts,
    process.env,
  );

  for (const modelId of modelIds) {
    validateRequest(modelId, {
      kind: "edit",
      refCount: refImages.length,
      size,
      hasMask: !!mask,
      quality,
    });
  }

  if (opts.dryRun) {
    process.stderr.write(
      `[dry-run] kind=edit models=${modelIds.join(",")} refs=${opts.refs.join(",")} prompt=${effectivePrompt}\n`,
    );
    return;
  }

  const req: RunRequest = {
    kind: "edit",
    modelIds,
    input: { prompt: effectivePrompt, size, quality, n, refImages, mask },
  };
  await executeAndOutput(req, cfg, providers, { ...opts, prompt: effectivePrompt });
}

export const editCmd = defineCommand({
  meta: {
    name: "edit",
    description:
      "Edit an image using reference images (last positional is the prompt)",
  },
  args: {
    mask: {
      type: "string" as const,
      description: "Path to an alpha PNG mask (edit only)",
    },
    ...sharedArgs,
  },
  run({ args }) {
    return withExitCode(() => {
      // All positional args: the last one is the prompt, rest are ref paths.
      const positionals: string[] = args._;
      if (positionals.length < 2) {
        throw new InvalidArgs(
          "edit requires at least one reference image and a prompt. Usage: imagnx edit <ref...> <prompt>",
        );
      }
      const prompt = positionals[positionals.length - 1]!;
      const refs = positionals.slice(0, -1);

      return runEdit({
        prompt,
        refs,
        mask: args.mask,
        model: args.model,
        size: args.size,
        quality: args.quality,
        n: parseN(args.n),
        output: args.output,
        open: args.open,
        json: args.json,
        dryRun: args["dry-run"],
        style: args.style,
        openaiApiKey: args["openai-api-key"],
        geminiApiKey: args["gemini-api-key"],
      });
    });
  },
});
