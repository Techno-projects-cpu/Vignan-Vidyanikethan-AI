/**
 * The public address of the site, read from the site itself.
 *
 * Every absolute URL in this repository — canonical tags, `og:url`, the
 * sitemap, the RSS feed, `robots.txt`, `security.txt` and the structured data
 * — has to name one host. That host is not hard-coded in the tests on purpose:
 * it is read out of `index.html`, which is the one file a reader can open and
 * check by eye. When the deploy moves, `npm run set-origin <new address>`
 * rewrites every file, and the tests then agree with whatever was written.
 *
 * If this module ever throws, `index.html` has lost its absolute canonical
 * link, which is itself the bug.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

/** `https://host` — no trailing slash, no path — taken from `index.html`. */
export function canonicalOrigin(base = root) {
  const html = readFileSync(path.join(base, "index.html"), "utf8");
  const match = html.match(/<link rel="canonical" href="(https:\/\/[^/"]+)\/">/);
  if (!match) {
    throw new Error(
      "index.html has no <link rel=\"canonical\" href=\"https://host/\"> — the site address cannot be read",
    );
  }
  return match[1];
}
