// Mockup build (seo-growth-plan P1-de step 3, Q19): builds the de-DE site drafts into a throwaway copy of
// cachedrop-website for the site's checks and screenshots. Nothing is written to the website repo.
//   1. `git archive` of the base commit into --out (a fresh folder, with its own git history for the site's scripts)
//   2. the code changes: research/marketing/site-drafts/de-DE/patches/code.patch (i18n, hreflang, switch, sitemap)
//   3. the German copy: each copy/<path>.json value inserted after its `fr` value (copy-blocks.ts)
//   4. docs/german-glossary.md
//   --check runs the site's own scripts/check.sh (npm ci, typecheck, unit tests, build, static checks, Playwright).
//   --screens takes screenshots of the German pages at 1440 and 390 px (needs --check's build).
//
//   node runners/marketing/site-mockup.ts --out <empty or old mockup dir> [--check] [--screens]
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findBlocks, insertLang } from "./copy-blocks.ts";
import { BASE_COMMIT, copyPath, SavedCopy, UNITS } from "./site-draft.ts";

const root = new URL("../../", import.meta.url).pathname;
const DRAFTS = join(root, "research/marketing/site-drafts/de-DE");
const MARKER = ".hq-mockup"; // only a folder this script made may be wiped

/** Keys the code patch removes from every language (the footer's switch now names each language itself). */
export const DROPPED_KEYS: Record<string, string[]> = { "src/components/footer.ts": ["switchTo"] };

/** Removes `key: <value>,` lines from an object value. Pure. */
export function dropKeys(value: string, keys: string[]): string {
  return keys.reduce((v, k) => v.replace(new RegExp(`\\n[ \\t]*${k}:[^\\n]*,(?=\\n)`), ""), value);
}

/** Inserts the saved German copy into every drafted file under `dir`. Returns the files changed. */
export function insertCopy(dir: string): string[] {
  const done: string[] = [];
  for (const u of UNITS) {
    const saved = SavedCopy.parse(JSON.parse(readFileSync(join(root, copyPath(u.path)), "utf8")));
    if (saved.base_commit !== BASE_COMMIT) throw new Error(`${u.path}: drafted against ${saved.base_commit}, building ${BASE_COMMIT}`);
    const file = join(dir, u.path), src = readFileSync(file, "utf8");
    const blocks = findBlocks(src, u.path);
    if (blocks.length !== saved.values.length) throw new Error(`${u.path}: ${blocks.length} blocks in the file, ${saved.values.length} drafted`);
    const values = saved.values.map(v => dropKeys(v.de, DROPPED_KEYS[u.path] ?? []));
    writeFileSync(file, insertLang(src, blocks, values));
    done.push(u.path);
  }
  return done;
}

const sh = (cmd: string, args: string[], cwd: string) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

export function build(out: string, site: string) {
  if (existsSync(out)) {
    if (readdirSync(out).length && !existsSync(join(out, MARKER))) throw new Error(`${out} is not empty and not a mockup this script made; refusing to delete it`);
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });
  execFileSync("sh", ["-c", 'git -C "$1" archive "$2" | tar -x -C "$3"', "sh", site, BASE_COMMIT, out], { stdio: "inherit" });
  writeFileSync(join(out, MARKER), `headquarters-app de-DE mockup of cachedrop-website ${BASE_COMMIT}\n`);
  const git = (...a: string[]) => sh("git", ["-c", "user.email=mockup@localhost", "-c", "user.name=mockup", ...a], out);
  git("init", "-q"); git("add", "-A"); git("commit", "-qm", `cachedrop-website ${BASE_COMMIT}`);
  git("apply", "--whitespace=nowarn", join(DRAFTS, "patches/code.patch"));
  const files = insertCopy(out);
  mkdirSync(join(out, "docs"), { recursive: true });
  cpSync(join(DRAFTS, "docs/german-glossary.md"), join(out, "docs/german-glossary.md"));
  git("add", "-A"); git("commit", "-qm", "de-DE mockup: code patch, German copy, glossary");
  return files;
}

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

if (import.meta.main) {
  const out = arg("--out");
  if (!out) throw new Error("usage: site-mockup.ts --out <dir> [--check] [--screens]");
  const site = arg("--site") ?? join(root, "../../cachedrop-website");
  const files = build(out, site);
  console.log(`mockup at ${out}: website ${BASE_COMMIT} + code.patch + German copy in ${files.length} files + glossary`);
  if (process.argv.includes("--check")) {
    const r = spawnSync("scripts/check.sh", [], { cwd: out, stdio: "inherit" });
    // The site's Playwright run leaves Astro's background preview server running; stop it.
    spawnSync(join(out, "node_modules/.bin/astro"), ["preview", "stop"], { cwd: out, stdio: "ignore" });
    console.log(`site checks: ${r.status === 0 ? "pass" : `FAIL (exit ${r.status})`}`);
    if (r.status !== 0) process.exitCode = 1;
  }
  if (process.argv.includes("--screens")) {
    const r = spawnSync(process.execPath, [join(root, "runners/marketing/site-screens.ts"), out], { stdio: "inherit" });
    if (r.status !== 0) process.exitCode = 1;
  }
}
