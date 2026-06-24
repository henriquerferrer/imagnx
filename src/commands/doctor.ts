import { defineCommand } from "citty";
import {
  configDir,
  loadConfigFile,
  loadCredentialsFile,
  resolveCredentials,
} from "../config.js";
import { warnIfCredentialsInsecure, withExitCode } from "../pipeline.js";

type Source =
  | { kind: "env"; name: string }
  | { kind: "credentials"; path: string }
  | { kind: "missing" };

interface ProviderStatus {
  provider: "openai" | "google";
  source: Source;
}

// Single source of truth for key resolution, in the same priority order as
// apiKeyFor() in config.ts. Keep these in lockstep — if apiKeyFor learns
// about a new env var, this should too, or `doctor` lies.
function diagnoseProvider(
  provider: "openai" | "google",
  env: Record<string, string | undefined>,
  creds: { openaiApiKey?: string; geminiApiKey?: string },
): ProviderStatus {
  if (provider === "openai") {
    if (env.IMAGNX_OPENAI_API_KEY) {
      return { provider, source: { kind: "env", name: "IMAGNX_OPENAI_API_KEY" } };
    }
    if (creds.openaiApiKey) {
      return { provider, source: { kind: "credentials", path: "credentials.toml" } };
    }
    return { provider, source: { kind: "missing" } };
  }
  if (env.IMAGNX_GEMINI_API_KEY) {
    return { provider, source: { kind: "env", name: "IMAGNX_GEMINI_API_KEY" } };
  }
  if (env.IMAGNX_GOOGLE_API_KEY) {
    return { provider, source: { kind: "env", name: "IMAGNX_GOOGLE_API_KEY" } };
  }
  if (creds.geminiApiKey) {
    return { provider, source: { kind: "credentials", path: "credentials.toml" } };
  }
  return { provider, source: { kind: "missing" } };
}

function describe(s: Source): string {
  if (s.kind === "env") return `env (${s.name})`;
  if (s.kind === "credentials") return `file (${s.path})`;
  return "missing";
}

export interface DoctorReport {
  configDir: string;
  configFile: string | null;
  credentialsFile: string | null;
  credentialsMode: string | null;
  providers: Array<{ provider: string; source: string; status: "ok" | "missing" }>;
}

export function buildDoctorReport(
  env: Record<string, string | undefined>,
): DoctorReport {
  const cfgFile = loadConfigFile(env);
  const credsFile = loadCredentialsFile(env);
  const creds = resolveCredentials(credsFile);
  const statuses: ProviderStatus[] = [
    diagnoseProvider("openai", env, creds),
    diagnoseProvider("google", env, creds),
  ];
  // Replace the placeholder "credentials.toml" with the actual resolved path
  // so the report points at the file the user should edit.
  for (const s of statuses) {
    if (s.source.kind === "credentials" && credsFile) {
      s.source.path = credsFile.path;
    }
  }
  return {
    configDir: configDir(env),
    configFile: cfgFile?.path ?? null,
    credentialsFile: credsFile?.path ?? null,
    credentialsMode: credsFile ? (credsFile.mode & 0o777).toString(8).padStart(3, "0") : null,
    providers: statuses.map((s) => ({
      provider: s.provider,
      source: describe(s.source),
      status: s.source.kind === "missing" ? "missing" : "ok",
    })),
  };
}

export const doctorCmd = defineCommand({
  meta: {
    name: "doctor",
    description:
      "Diagnose the imagnx environment: config + credentials locations and key sources per provider",
  },
  args: {
    json: {
      type: "boolean" as const,
      description: "Emit the report as JSON",
      default: false,
    },
  },
  run({ args }) {
    return withExitCode(() => {
      const env = process.env;
      const credsFile = loadCredentialsFile(env);
      if (credsFile) warnIfCredentialsInsecure(credsFile);
      const report = buildDoctorReport(env);

      if (args.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
        return;
      }

      process.stdout.write(`config dir:       ${report.configDir}\n`);
      process.stdout.write(`config file:      ${report.configFile ?? "(none)"}\n`);
      process.stdout.write(`credentials file: ${report.credentialsFile ?? "(none)"}`);
      if (report.credentialsMode) process.stdout.write(` (mode ${report.credentialsMode})`);
      process.stdout.write("\n");
      process.stdout.write("\nprovider key sources:\n");
      for (const p of report.providers) {
        const mark = p.status === "ok" ? "✓" : "✗";
        process.stdout.write(`  ${mark} ${p.provider}: ${p.source}\n`);
      }
    });
  },
});
