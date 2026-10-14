// Minimal static server for hosting the built app (e.g. on Railway).
// No dependencies: serves dist/ and falls back to index.html.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const port = Number(process.env.PORT) || 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function fileFor(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^([/\\]|\.\.)+/, "");
  const candidate = join(root, rel);
  try {
    if (candidate.startsWith(root) && statSync(candidate).isFile()) return candidate;
  } catch {
    // fall through to index.html
  }
  return join(root, "index.html");
}

createServer((req, res) => {
  const file = fileFor(req.url ?? "/");
  const type = types[extname(file)] ?? "application/octet-stream";
  const cache = file.includes(`${join("dist", "assets")}`) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`Projection Trainer on http://0.0.0.0:${port}`));
