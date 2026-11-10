// P0 check (docs/seo-growth-plan.md): confirms the read-only Search Console and Bing access the wizard set up.
// Prints statuses and counts only, never rows. Usage: node --env-file=.env scripts/check-search-access.ts
import { bing, gsc, gscSiteUrl, gscToken } from "../packages/search-access/index.ts";

const site = process.env.GSC_SITE ?? "sc-domain:cachedrop.io";
const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
let failed = 0;
async function check(name: string, fn: () => Promise<string>) {
  try { console.log(`✓ ${name}: ${await fn()}`); } catch (e) { failed++; console.log(`✗ ${name}: ${(e as Error).message}`); }
}

let token = "";
await check("Google token (service account)", async () => { token = await gscToken(); return "ok"; });
if (token) {
  await check(`Search Console property ${site}`, async () => {
    const r = await gsc<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(token, "https://www.googleapis.com/webmasters/v3/sites");
    const e = r.siteEntry?.find(s => s.siteUrl === site);
    if (!e) throw new Error(`not visible to the service account (sees ${r.siteEntry?.length ?? 0} properties); add it under Settings → Users and permissions`);
    return `permission ${e.permissionLevel}`;
  });
  await check("Search Analytics (last 28 days)", async () => {
    const r = await gsc<{ rows?: unknown[] }>(token, `${gscSiteUrl(site)}/searchAnalytics/query`, { startDate: day(30), endDate: day(2), dimensions: ["query"], rowLimit: 25 });
    return `${r.rows?.length ?? 0} query rows (0 is normal for a new property)`;
  });
  await check("URL Inspection (home page)", async () => {
    const r = await gsc<{ inspectionResult?: { indexStatusResult?: { coverageState?: string } } }>(token, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: "https://cachedrop.io/", siteUrl: site });
    return r.inspectionResult?.indexStatusResult?.coverageState ?? "no state";
  });
}
await check("Bing Webmaster (GetUserSites)", async () => {
  const sites = await bing<{ Url: string; IsVerified: boolean }[]>("GetUserSites");
  const s = sites.find(x => x.Url.includes("cachedrop.io"));
  if (!s) throw new Error(`cachedrop.io not in the account (${sites.length} sites)`);
  return s.IsVerified ? "cachedrop.io verified" : "cachedrop.io added but NOT verified";
});
process.exit(failed ? 1 : 0);
