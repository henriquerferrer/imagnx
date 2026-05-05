import { defineCommand } from "citty";
import { listModels, modelCapabilities } from "../registry.js";
import { withExitCode } from "../pipeline.js";

export const modelsCmd = defineCommand({
  meta: {
    name: "models",
    description: "List available models grouped by provider, with capabilities",
  },
  args: {
    json: {
      type: "boolean" as const,
      default: false,
      description: "Output as JSON",
    },
  },
  run({ args }) {
    return withExitCode(() => {
      const grouped = listModels();
      if (args.json) {
        const out: Record<string, Array<Record<string, unknown>>> = {};
        for (const [pid, models] of Object.entries(grouped)) {
          out[pid] = models.map((m) => {
            const cap = modelCapabilities(m);
            return {
              modelId: m,
              supportsEdit: cap.supportsEdit,
              supportsMask: cap.supportsMask,
              validSizes: cap.validSizes,
            };
          });
        }
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
        return;
      }
      for (const [pid, models] of Object.entries(grouped)) {
        process.stdout.write(`${pid}:\n`);
        for (const m of models) {
          const cap = modelCapabilities(m);
          process.stdout.write(
            `  ${m}  edit=${cap.supportsEdit} mask=${cap.supportsMask} sizes=[${cap.validSizes.join(",")}]\n`,
          );
        }
      }
    });
  },
});
