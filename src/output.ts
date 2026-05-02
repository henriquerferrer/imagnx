import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { InvalidArgs } from "./errors.js";

export function slugify(prompt: string): string {
  const cleaned = prompt
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .replace(/[^a-zA-Z0-9 ]+/g, " ") // ASCII only
    .toLowerCase()
    .trim();
  if (!cleaned) return "image";
  const words = cleaned.split(/\s+/).slice(0, 6);
  let slug = words.join("-");
  if (slug.length > 40) slug = slug.slice(0, 40).replace(/-+$/, "");
  return slug || "image";
}

export interface OutputContext {
  outputDir: string;
  now: Date;
  prompt: string;
  modelId: string;
  extension: "png" | "jpg" | "webp";
  fanOut: boolean;
  explicitOutput?: string;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function dateFolder(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function timeStamp(d: Date): string {
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function defaultName(ctx: OutputContext): string {
  return `${timeStamp(ctx.now)}-${slugify(ctx.prompt)}-${ctx.modelId}.${ctx.extension}`;
}

export function resolveOutputPath(ctx: OutputContext): string {
  if (ctx.explicitOutput) {
    const isLikelyDir =
      ctx.explicitOutput.endsWith("/") || !/\.[a-z0-9]+$/i.test(ctx.explicitOutput);
    if (isLikelyDir) {
      return join(ctx.explicitOutput, defaultName(ctx));
    }
    if (ctx.fanOut) {
      throw new InvalidArgs(
        `--output cannot be a single file when fanning out across multiple models. Pass a directory instead.`,
      );
    }
    return ctx.explicitOutput;
  }
  return join(ctx.outputDir, dateFolder(ctx.now), defaultName(ctx));
}

export async function writeImageBytes(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, path);
  } catch (err) {
    try { await unlink(tmp); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

export async function openInViewer(path: string): Promise<void> {
  const cmd =
    process.platform === "darwin"
      ? ["open", path]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", path]
        : ["xdg-open", path];
  // Fire-and-forget: detach so the parent process can exit independently of
  // the viewer window.
  const [bin, ...args] = cmd;
  const child = spawn(bin!, args, { stdio: "ignore", detached: true });
  child.unref();
}
