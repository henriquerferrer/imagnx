import { defineCommand } from "citty";
import {
  loadConfigFile,
  loadCredentialsFile,
  resolveConfig,
  resolveCredentials,
} from "../config.js";
import { warnIfCredentialsInsecure, withExitCode } from "../pipeline.js";

export const configCmd = defineCommand({
  meta: {
    name: "config",
    description: "Print resolved config + provider key status",
  },
  run() {
    return withExitCode(() => {
      const env = process.env;
      const cfg = resolveConfig({ file: loadConfigFile(env), env, flags: {} });
      const credsFile = loadCredentialsFile(env);
      if (credsFile) warnIfCredentialsInsecure(credsFile);
      const creds = resolveCredentials(credsFile);
      process.stdout.write(JSON.stringify(cfg, null, 2) + "\n");
      const openaiOk = Boolean(env.IMAGNX_OPENAI_API_KEY ?? creds.openaiApiKey);
      const geminiOk = Boolean(
        env.IMAGNX_GEMINI_API_KEY ??
          env.IMAGNX_GOOGLE_API_KEY ??
          creds.geminiApiKey,
      );
      process.stderr.write(`openai key: ${openaiOk ? "✓" : "✗"}\n`);
      process.stderr.write(`gemini key: ${geminiOk ? "✓" : "✗"}\n`);
      if (credsFile) {
        process.stderr.write(`credentials file: ${credsFile.path}\n`);
      }
    });
  },
});
