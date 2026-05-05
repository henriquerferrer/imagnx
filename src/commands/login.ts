import { defineCommand } from "citty";
import {
  configDir,
  loadCredentialsFile,
  mergeCredentials,
  resolveCredentials,
  serializeCredentialsToml,
} from "../config.js";
import { InvalidArgs } from "../errors.js";
import { withExitCode } from "../pipeline.js";
import { readSecret } from "../secret-input.js";

export const loginCmd = defineCommand({
  meta: {
    name: "login",
    description: "Save provider API keys to ~/.imagnx/credentials.toml",
  },
  args: {
    openai: {
      type: "string" as const,
      description: "OpenAI API key (skips interactive prompt)",
    },
    gemini: {
      type: "string" as const,
      description: "Gemini API key (skips interactive prompt)",
    },
  },
  run({ args }) {
    return withExitCode(async () => {
      const env = process.env;
      const dir = configDir(env);
      const path = `${dir}/credentials.toml`;
      const existing = resolveCredentials(loadCredentialsFile(env));

      const openaiFlag =
        typeof args.openai === "string" ? args.openai.trim() : "";
      const geminiFlag =
        typeof args.gemini === "string" ? args.gemini.trim() : "";
      const fromFlags = openaiFlag !== "" || geminiFlag !== "";

      let openaiInput = openaiFlag;
      let geminiInput = geminiFlag;

      if (!fromFlags) {
        if (!process.stdin.isTTY) {
          process.stderr.write(
            "imagnx login requires an interactive terminal, " +
              "or pass --openai <key> / --gemini <key>.\n",
          );
          throw new InvalidArgs("not a tty");
        }
        process.stdout.write(
          "Enter API keys. Press Enter to skip a provider (or keep its existing value).\n",
        );
        const openaiPrompt = `  OpenAI key${existing.openaiApiKey ? " (keeping existing)" : ""}: `;
        const geminiPrompt = `  Gemini key${existing.geminiApiKey ? " (keeping existing)" : ""}: `;
        openaiInput = (await readSecret(openaiPrompt)).trim();
        geminiInput = (await readSecret(geminiPrompt)).trim();
      }

      const merged = mergeCredentials(
        {
          openaiApiKey: openaiInput || undefined,
          geminiApiKey: geminiInput || undefined,
        },
        existing,
      );
      const text = serializeCredentialsToml(merged);
      if (text === "") {
        process.stderr.write("No keys provided. Nothing written.\n");
        return;
      }

      const { mkdir, writeFile, chmod } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
      await writeFile(path, text, { mode: 0o600 });
      await chmod(path, 0o600);
      process.stdout.write(`Wrote ${path} (chmod 600)\n`);

      const overrides: string[] = [];
      if (merged.openaiApiKey && env.IMAGNX_OPENAI_API_KEY)
        overrides.push("IMAGNX_OPENAI_API_KEY");
      if (
        merged.geminiApiKey &&
        (env.IMAGNX_GEMINI_API_KEY || env.IMAGNX_GOOGLE_API_KEY)
      ) {
        overrides.push(
          env.IMAGNX_GEMINI_API_KEY
            ? "IMAGNX_GEMINI_API_KEY"
            : "IMAGNX_GOOGLE_API_KEY",
        );
      }
      if (overrides.length > 0) {
        process.stderr.write(
          `note: ${overrides.join(", ")} is set in your environment and will override the file. Unset to use the saved value.\n`,
        );
      }
    });
  },
});
