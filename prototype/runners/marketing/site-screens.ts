// Screenshots of the German mockup pages at 1440 and 390 px (the website's PR rule), full page, light mode.
// Runs the mockup's own `astro preview` and Playwright (both in the mockup's node_modules), after its build.
//   node runners/marketing/site-screens.ts <mockup dir> [--out dir]
// Output (git-ignored): research/marketing/site-drafts/de-DE/screenshots/<page>-<width>.png
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
export const DE_PAGES = ["/", "/pricing/", "/cleanmymac-alternative/", "/clear-mac-developer-caches/", "/clear-adobe-media-cache-mac/",
  "/clear-system-data-mac/", "/uninstall-apps-mac/", "/uninstall-audio-plugins-mac/"];
export const shotName = (path: string, width: number) => `${path === "/" ? "home" : path.replace(/\//g, "")}-${width}.png`;

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "dist"))) throw new Error("usage: site-screens.ts <mockup dir with a build in dist/>");
const i = process.argv.indexOf("--out");
const out = i > 0 ? process.argv[i + 1] : join(root, "research/marketing/site-drafts/de-DE/screenshots");
mkdirSync(out, { recursive: true });

const PORT = 4391;
// A preview left running would answer instead of this build's; refuse rather than screenshot the wrong site.
if (await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)) throw new Error(`port ${PORT} is in use: stop the old preview first`);
const server = spawn(join(dir, "node_modules/.bin/astro"), ["preview", "--port", String(PORT), "--ignore-lock"], { cwd: dir, stdio: ["ignore", "pipe", "inherit"], detached: true });
try {
  await new Promise<void>((ok, fail) => {
    const t = setTimeout(() => fail(new Error("astro preview did not start in 30 s")), 30000);
    server.stdout!.on("data", (b: Buffer) => { if (b.toString().includes(String(PORT))) { clearTimeout(t); ok(); } });
  });
  const { chromium } = createRequire(join(dir, "package.json"))("@playwright/test");
  const browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: "light" });
    for (const p of DE_PAGES) {
      await page.goto(`http://localhost:${PORT}/de${p}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: join(out, shotName(p, width)), fullPage: true });
    }
    await page.close();
  }
  await browser.close();
  console.log(`screenshots: ${DE_PAGES.length * 2} in ${out}`);
} finally {
  try { process.kill(-server.pid!); } catch { /* already exited */ } // the whole group: astro preview runs its server in a child
}
