// Read-only access to Google Search Console (service account, JWT bearer) and Bing Webmaster Tools (API key).
// No dependencies: the JWT is signed with node:crypto. Plan: docs/seo-growth-plan.md (P0, P1).
// Env: GSC_SERVICE_ACCOUNT_FILE (JSON key, kept outside the repo), GSC_SITE (e.g. sc-domain:cachedrop.io),
// BING_WEBMASTER_API_KEY.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type ServiceAccount = { client_email: string; private_key: string };

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** A signed RS256 JWT asking Google for a read-only Search Console token, valid one hour. */
export function serviceAccountJwt(sa: ServiceAccount, now = Math.floor(Date.now() / 1000)): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: GSC_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key);
  return `${head}.${claims}.${b64url(sig)}`;
}

export function loadServiceAccount(path = process.env.GSC_SERVICE_ACCOUNT_FILE): ServiceAccount {
  if (!path) throw new Error("GSC_SERVICE_ACCOUNT_FILE is not set (run with --env-file=.env)");
  const sa = JSON.parse(readFileSync(path, "utf8"));
  if (typeof sa.client_email !== "string" || typeof sa.private_key !== "string") throw new Error(`${path} is not a service account key`);
  return sa;
}

export async function gscToken(sa = loadServiceAccount()): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountJwt(sa) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Google token HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

/** GET or POST a Search Console API URL with a bearer token; throws with the status on failure. */
export async function gsc<T>(token: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Search Console HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

export const gscSiteUrl = (site: string) => `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}`;

/** GET a Bing Webmaster JSON API method (e.g. GetUserSites). Bing wraps results in `d`. */
export async function bing<T>(method: string, params: Record<string, string> = {}, key = process.env.BING_WEBMASTER_API_KEY): Promise<T> {
  if (!key) throw new Error("BING_WEBMASTER_API_KEY is not set (run with --env-file=.env)");
  const q = new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?${q}`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Bing ${method} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).d as T;
}
