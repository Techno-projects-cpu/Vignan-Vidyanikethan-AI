/** Optional live integration check. Start the app, then run this script.
 * Usage: node tools/check-public-links.mjs [public-repository-url ...]
 * CHAT_URL selects the app origin. No mocks or GitHub credentials are used.
 */
import assert from "node:assert/strict";
import { inspectFileBytes } from "../js/files.js";
import { ingestText } from "../js/ingest.js";
const base = new URL(process.env.CHAT_URL || "http://localhost:4173/");
const urls = process.argv.slice(2);
if (!urls.length) urls.push("https://github.com/nodejs/node");
for (const url of urls) {
  const response = await fetch(new URL("api/fetch", base), {
    method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin },
    body: JSON.stringify({ url }), signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}: ${await response.text()}`);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = inspectFileBytes(bytes, {
    name: decodeURIComponent(response.headers.get("X-Vignan-File-Name") || "public-page.txt"),
    mime: response.headers.get("X-Vignan-Content-Type") || "",
  });
  const sourceUrl = decodeURIComponent(response.headers.get("X-Vignan-Source-URL") || "");
  const index = ingestText(file.text, { title: "Live public-link check", sourceUrl });
  assert.ok(index.chunks.length > 0, "download must contain indexable material");
  console.log(`${url}: HTTP 200, ${bytes.length} bytes, ${index.chunks.length} indexed passages — PASS`);
}
