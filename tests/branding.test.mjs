import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const domain = "https://vignanvidyanikethanai.onrender.com";

test("user-supplied AI mark is a self-contained, scalable vector", () => {
  const mark = read("assets/brand/vignan-ai-mark.svg");
  const icon = read("icons/icon.svg");
  assert.match(mark, /<svg\b[^>]*viewBox=/);
  assert.doesNotMatch(mark, /<rect\b/, "the reusable mark has a transparent background");
  assert.ok((mark.match(/<path\b/g) || []).length >= 5);
  assert.match(icon, /<rect\b[^>]*fill="#fafaf8"/, "the favicon has a contrasting background");
  for (const svg of [mark, icon]) assert.doesNotMatch(svg, /<image\b|(?:href|src)=["']https?:/i);
});

test("favicons and installed-app icons exist with the advertised dimensions", () => {
  const html = read("index.html");
  assert.match(html, /rel="icon" href="\.\/icons\/icon\.svg\?v=39"/);
  assert.match(html, /rel="icon" href="\.\/icons\/icon-48\.png\?v=39"/);
  assert.match(html, /rel="apple-touch-icon" href="\.\/icons\/icon-192\.png\?v=39"/);
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const maskableSizes = manifest.icons.filter((icon) => icon.purpose === "maskable").map((icon) => icon.sizes).sort();
  assert.deepEqual(maskableSizes, ["192x192", "512x512"]);
  for (const icon of manifest.icons) {
    assert.match(icon.src, /\?v=39$/);
    const file = icon.src.replace(/^\.\//, "").split("?")[0];
    assert.ok(existsSync(path.join(root, file)), `${file} exists`);
    if (icon.type === "image/png") {
      const bytes = readFileSync(path.join(root, file));
      assert.equal(bytes.toString("ascii", 1, 4), "PNG");
      const [width, height] = icon.sizes.split("x").map(Number);
      assert.equal(bytes.readUInt32BE(16), width, file);
      assert.equal(bytes.readUInt32BE(20), height, file);
    }
  }
  const favicon = readFileSync(path.join(root, "favicon.ico"));
  assert.equal(favicon.readUInt16LE(2), 1);
  assert.ok(favicon.readUInt16LE(4) >= 3, "legacy favicon contains multiple resolutions");
});

test("crawlable canonical URLs, sitemap and social metadata agree", () => {
  const html = read("index.html");
  const robots = read("robots.txt");
  const sitemap = read("sitemap.xml");
  assert.ok(html.includes(`<link rel="canonical" href="${domain}/">`));
  assert.ok(html.includes(`<meta property="og:url" content="${domain}/">`));
  assert.ok(html.includes(`${domain}/icons/icon-512.png?v=39`));
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.ok(robots.includes(`Sitemap: ${domain}/sitemap.xml`));
  for (const page of ["/", "/privacy.html", "/terms.html"]) {
    assert.ok(sitemap.includes(`<loc>${domain}${page}</loc>`));
  }
  for (const page of ["privacy.html", "terms.html"]) {
    assert.ok(read(page).includes(`<link rel="canonical" href="${domain}/${page}">`));
  }
});
