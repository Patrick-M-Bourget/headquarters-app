// Fetches a page and turns it into readable text, with deterministic evidence checking.
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export type Page = {
  url: string;
  status: number;
  ok: boolean;
  title: string;
  text: string;          // readable text, whitespace-collapsed
  links: string[];       // absolute same-site links
  html: string;
  sha256: string;
  error?: string;
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) hq-prototype-research/0.1";
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export async function fetchPage(url: string, timeoutMs = 20000): Promise<Page> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const html = await res.text();
    const sha256 = createHash("sha256").update(html).digest("hex");
    if (!res.ok) return { url, status: res.status, ok: false, title: "", text: "", links: [], html, sha256, error: `HTTP ${res.status}` };
    const { document } = parseHTML(html);
    const host = new URL(res.url || url).hostname.replace(/^www\./, "");
    const links = [...new Set([...document.querySelectorAll("a[href]")]
      .map(a => { try { return new URL(a.getAttribute("href")!, res.url || url).toString().split("#")[0]; } catch { return ""; } })
      .filter(h => h.startsWith("http") && new URL(h).hostname.replace(/^www\./, "").endsWith(host)))];
    // Keep the full body text too: pricing tables often fall outside Readability's "article".
    const bodyText = collapse(document.body?.textContent ?? "");
    let articleText = "";
    try { articleText = collapse(new Readability(document as any).parse()?.textContent ?? ""); } catch { /* fall back to body */ }
    const text = articleText.length > bodyText.length * 0.6 ? articleText : bodyText;
    return { url: res.url || url, status: res.status, ok: true, title: collapse(document.title ?? ""), text, links, html, sha256 };
  } catch (e) {
    return { url, status: 0, ok: false, title: "", text: "", links: [], html: "", sha256: "", error: (e as Error).message };
  }
}

const PAGE_HINTS = /(pric|buy|store|purchase|plans|features|feature|compare|faq)/i;
export function candidatePages(home: Page, max = 3): string[] {
  const seen = new Set([home.url.replace(/\/$/, "")]);
  return home.links
    .filter(l => PAGE_HINTS.test(new URL(l).pathname) && !/\.(zip|dmg|pkg|pdf|png|jpg|svg)$/i.test(new URL(l).pathname))
    .filter(l => { const k = l.replace(/\/$/, ""); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => score(b) - score(a))
    .slice(0, max);
}
const score = (u: string) => (/(pric|buy|store|purchase|plans)/i.test(u) ? 2 : 0) + (/feature/i.test(u) ? 1 : 0) - u.length / 1000;

const norm = (s: string) => collapse(s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[\u00a0\u202f\u2009]/g, " ")); // no-break, narrow no-break (French « ? ! : ») and thin spaces
/** True when the evidence quote appears verbatim (modulo whitespace, case and curly quotes) in the page text. */
export function evidenceOnPage(evidence: string, pageText: string): boolean {
  const e = norm(evidence).replace(/^\.+|\.+$/g, "").replace(/\s*(\.\.\.|…)\s*/g, "\u0000");
  if (e.length < 4) return false;
  const t = norm(pageText);
  return e.split("\u0000").filter(Boolean).every(part => t.includes(part));
}
