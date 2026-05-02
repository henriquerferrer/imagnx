#!/usr/bin/env node
// Wired as the `version` lifecycle script in package.json so `npm version <bump>`
// updates skill/SKILL.md's metadata.version in the same release commit.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = join(root, "package.json");
const skillPath = join(root, "skill", "SKILL.md");

const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const skill = await readFile(skillPath, "utf8");

const updated = skill.replace(
  /^(\s*version:\s*)"[^"]*"/m,
  `$1"${pkg.version}"`,
);

if (updated === skill) {
  if (skill.match(/^(\s*version:\s*)"[^"]*"/m)) {
    process.stdout.write(`sync-skill-version: already ${pkg.version}\n`);
  } else {
    process.stderr.write(
      `sync-skill-version: no \`version: "..."\` line found in ${skillPath}\n`,
    );
    process.exit(1);
  }
} else {
  await writeFile(skillPath, updated);
  process.stdout.write(`sync-skill-version: skill version → ${pkg.version}\n`);
}
