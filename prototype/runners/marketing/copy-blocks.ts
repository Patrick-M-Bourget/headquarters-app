// cachedrop-website keeps each file's strings as `{ en: <value>, fr: <value> }` (Decision 5). This module
// finds those values in a source file, adds a third language after each `fr` value, checks that a new
// value has the English value's shape, and pulls the strings out for review. Pure: no files, no model.

/** End of a quoted string starting at `i` (the quote). Returns the index after the closing quote. */
function endString(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) { if (s[j] === "\\") j++; else if (s[j] === q) return j + 1; }
  return s.length;
}
/** End of a template literal starting at `i` (the backtick), interpolations included. */
function endTemplate(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\") j++;
    else if (s[j] === "`") return j + 1;
    else if (s[j] === "$" && s[j + 1] === "{") j = endOfExpr(s, j + 2);
  }
  return s.length;
}
/** Index of the top-level `,` or unmatched closer that ends the expression starting at `start`. */
export function endOfExpr(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length;) {
    const c = s[i];
    if (c === "'" || c === '"') { i = endString(s, i); continue; }
    if (c === "`") { i = endTemplate(s, i); continue; }
    if (c === "/" && s[i + 1] === "/") { const n = s.indexOf("\n", i); i = n < 0 ? s.length : n; continue; }
    if (c === "/" && s[i + 1] === "*") { const n = s.indexOf("*/", i + 2); i = n < 0 ? s.length : n + 2; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { if (depth === 0) return i; depth--; }
    else if (c === "," && depth === 0) return i;
    i++;
  }
  return s.length;
}

export type Literal = { start: number; end: number; kind: "string" | "template" | "comment" };
/** Every string, template literal and comment in `s`, in order. */
export function literals(s: string): Literal[] {
  const out: Literal[] = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "'" || c === '"') { const e = endString(s, i); out.push({ start: i, end: e, kind: "string" }); i = e; }
    else if (c === "`") { const e = endTemplate(s, i); out.push({ start: i, end: e, kind: "template" }); i = e; }
    else if (c === "/" && s[i + 1] === "/") { const n = s.indexOf("\n", i); const e = n < 0 ? s.length : n; out.push({ start: i, end: e, kind: "comment" }); i = e; }
    else if (c === "/" && s[i + 1] === "*") { const n = s.indexOf("*/", i + 2); const e = n < 0 ? s.length : n + 2; out.push({ start: i, end: e, kind: "comment" }); i = e; }
    else i++;
  }
  return out;
}
/** `s` with every string, template and comment blanked (same length), so a regex sees only code. */
export function mask(s: string): string {
  let out = s;
  for (const l of literals(s)) out = out.slice(0, l.start) + " ".repeat(l.end - l.start) + out.slice(l.end);
  return out;
}

/** The part of a file that holds code: an .astro file's frontmatter, or the whole of a .ts file. */
export function codeRegion(src: string, path: string): [number, number] {
  if (!path.endsWith(".astro")) return [0, src.length];
  const m = src.match(/^---\r?\n/);
  if (!m) return [0, 0];
  const end = src.indexOf("\n---", m[0].length);
  return [m[0].length, end < 0 ? src.length : end];
}

export type Block = { index: number; indent: string; inline: boolean; key: string; en: { start: number; end: number; text: string }; fr: { start: number; end: number; text: string } };

/** Each `en:` value with the `fr:` value that follows it, in file order. */
export function findBlocks(src: string, path: string): Block[] {
  const [a, b] = codeRegion(src, path);
  const code = mask(src.slice(a, b));
  const hits: { lang: string; start: number; end: number; indent: string; inline: boolean; key: string }[] = [];
  for (const m of code.matchAll(/(?<![\w.$])(en|fr):/g)) {
    let start = a + m.index! + m[0].length;
    while (/\s/.test(src[start])) start++; // the masked copy is blank here, so skip on the source
    const end = endOfExpr(src, start);
    const lineStart = src.lastIndexOf("\n", a + m.index!) + 1;
    const lead = src.slice(lineStart, a + m.index!), indent = lead.match(/^\s*/)![0], inline = lead.trim() !== "";
    // The parent key: the nearest `name: {` or `const name =` before the block.
    const before = code.slice(0, m.index!);
    const key = [...before.matchAll(/(\w+)\s*(?::|=)\s*\{[^{}]*$/g)].pop()?.[1] ?? "";
    hits.push({ lang: m[1], start, end, indent, inline, key });
  }
  const out: Block[] = [];
  for (let i = 0; i < hits.length; i++) {
    const e = hits[i], f = hits[i + 1];
    if (e.lang !== "en") continue;
    if (!f || f.lang !== "fr") throw new Error(`${path}: an en value at ${e.start} has no fr value after it`);
    out.push({ index: out.length, indent: f.indent, inline: f.inline, key: e.key,
      en: { start: e.start, end: e.end, text: src.slice(e.start, e.end).trimEnd() }, fr: { start: f.start, end: f.end, text: src.slice(f.start, f.end).trimEnd() } });
    i++;
  }
  return out;
}

/** Inserts `de: <value>` after each block's `fr` value. `values[i]` belongs to block i. */
export function insertLang(src: string, blocks: Block[], values: string[], lang = "de"): string {
  if (values.length !== blocks.length) throw new Error(`${values.length} values for ${blocks.length} blocks`);
  let out = src;
  for (const b of [...blocks].sort((x, y) => y.fr.start - x.fr.start)) {
    const at = b.fr.start + b.fr.text.length;
    out = out.slice(0, at) + `,${b.inline ? " " : `\n${b.indent}`}${lang}: ${values[b.index].trim()}` + out.slice(at);
  }
  return out;
}

/** Interpolations of the template literals in `expr`, with the language names normalized. */
function interpolations(expr: string): string[] {
  const out: string[] = [];
  for (const l of literals(expr)) if (l.kind === "template") {
    const t = expr.slice(l.start, l.end);
    for (let j = 1; j < t.length - 1; j++) {
      if (t[j] === "\\") { j++; continue; }
      if (t[j] === "$" && t[j + 1] === "{") { const e = endOfExpr(t, j + 2); out.push(norm(stringsAsS(t.slice(j + 2, e)))); j = e; }
    }
  }
  return out.sort();
}
/** Code with each string and template literal replaced by S and comments dropped. */
const stringsAsS = (code: string) => {
  let out = "", last = 0;
  for (const l of literals(code)) { out += code.slice(last, l.start) + (l.kind === "comment" ? "" : "S"); last = l.end; }
  return out + code.slice(last);
};
const norm = (code: string) => code.replace(/\s+/g, "").replace(/(?<![\w$])(en|fr|de)(?![\w$])/g, "L");

/** The value's shape: code with every string as S and comments dropped, languages normalized, plus its interpolations. */
export function skeleton(expr: string): string {
  return `${norm(stringsAsS(expr)).replace(/,(?=[}\]])/g, "")} | ${interpolations(expr).join(" ; ")}`;
}

/** Why `de` doesn't have `en`'s shape, or null when it does. */
export function shapeProblem(en: string, de: string): string | null {
  const a = skeleton(en), b = skeleton(de);
  if (a === b) return null;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return `shape differs from the English value near "${b.slice(Math.max(0, i - 30), i + 30)}" (English: "${a.slice(Math.max(0, i - 30), i + 30)}")`;
}

export type CopyString = { key: string; text: string };
const unescape = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, "$1");
/** The visible text of every string in `expr`: tags removed, escapes decoded. `known` fills interpolations
 *  by their normalized code (e.g. "L(price.regular)"); any other interpolation becomes empty. */
export function strings(expr: string, known: Record<string, string> = {}): CopyString[] {
  const out: CopyString[] = [];
  const code = mask(expr);
  for (const l of literals(expr)) {
    if (l.kind === "comment") continue;
    let t = expr.slice(l.start + 1, l.end - 1);
    if (l.kind === "template") t = t.replace(/\$\{([^}]*)\}/g, (_, x) => known[norm(x)] ?? "");
    t = unescape(t).replace(/<[^>]+>/g, "").trim();
    if (!t || /^(?:[/#][\w/.#?=&-]*|https?:\/\/\S+)$/.test(t)) continue; // paths, fragments, URLs
    const key = code.slice(0, l.start).match(/(\w+)\s*:\s*(?:\[\s*)?$/)?.[1] ?? "";
    out.push({ key, text: t });
  }
  return out;
}

/** Copy as markdown for the claims reviewer: headline-like keys become "# " lines, button-like keys "[x](button)". */
export function asMarkdown(ss: CopyString[]): string {
  return ss.map(({ key, text }) =>
    /^(h1|h2|headline|title|\w*Title|eyebrow|\w*Eyebrow|crumb)$/.test(key) ? `# ${text}`
      : /^(cta|download|buy|get|button|submit)$/i.test(key) ? `[${text}](button)` : text).join("\n");
}
