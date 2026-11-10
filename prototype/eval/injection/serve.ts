// Serves the injection fixture on 127.0.0.1:8787 (every path returns the same page).
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("./vaultsweep.html", import.meta.url), "utf8");
createServer((_, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(html); }).listen(8787, "127.0.0.1", () => console.log("fixture on http://127.0.0.1:8787/"));
