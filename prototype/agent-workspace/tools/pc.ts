// Usage: node tools/pc.ts <GET|POST|PATCH> /api/<path> ['<json body>']
// The only way this agent talks to Paperclip. Calls go to PAPERCLIP_API_URL on loopback only.
const [method, path, body] = process.argv.slice(2);
const base = (process.env.PAPERCLIP_API_URL ?? "").replace(/\/$/, "");
const host = base ? new URL(base).hostname : "";
if (!["GET", "POST", "PATCH"].includes(method ?? "") || !path?.startsWith("/api/")) {
  console.error("usage: node tools/pc.ts <GET|POST|PATCH> /api/<path> ['<json>']"); process.exit(2);
}
if (!["127.0.0.1", "localhost", "::1"].includes(host)) { console.error(`refusing non-loopback PAPERCLIP_API_URL: ${base}`); process.exit(2); }
const headers: Record<string, string> = { authorization: `Bearer ${process.env.PAPERCLIP_API_KEY ?? ""}` };
if (body) headers["content-type"] = "application/json";
if (method !== "GET" && process.env.PAPERCLIP_RUN_ID) headers["x-paperclip-run-id"] = process.env.PAPERCLIP_RUN_ID;
const res = await fetch(base + path.replace(/^\/api/, base.endsWith("/api") ? "" : "/api"), { method, headers, body });
const text = await res.text();
console.log(text);
if (!res.ok || (method !== "GET" && text.trim() === "")) { console.error(`HTTP ${res.status}`); process.exit(1); }
