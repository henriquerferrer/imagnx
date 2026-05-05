import { defineCommand } from "citty";
import { configDir } from "../config.js";
import { withExitCode } from "../pipeline.js";

const SAMPLE_CONFIG = `# imagnx configuration
default_model    = "gpt-image-1.5"
output_dir       = "~/Pictures/imagnx"
default_size     = "auto"
default_quality  = "high"
open_after       = false
`;

export const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "Write a starter ~/.imagnx/config.toml",
  },
  run() {
    return withExitCode(async () => {
      const dir = configDir(process.env);
      const path = `${dir}/config.toml`;
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
      try {
        await writeFile(path, SAMPLE_CONFIG, { flag: "wx" });
        process.stdout.write(`Wrote ${path}\n`);
      } catch (e: unknown) {
        if (
          e !== null &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code: unknown }).code === "EEXIST"
        ) {
          process.stderr.write(
            `Config already exists at ${path}. Not overwriting.\n`,
          );
        } else {
          throw e;
        }
      }
    });
  },
});
