/**
 * Fetch a public URL without exposing the server's local network. User URLs
 * are untrusted: every redirect is re-resolved, every DNS answer must be
 * public, and the actual socket is pinned to a checked address. No caller
 * headers, cookies, credentials or compressed response bodies are forwarded.
 */
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

export const MAX_REMOTE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "VignanVidyanikethanAI/1.9.0 (+https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI/issues)";

export class PublicFetchError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PublicFetchError";
    this.status = status;
  }
}

function ipv4Number(value) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((number, part) => (number * 256 + part), 0) >>> 0;
}

function inV4Range(value, base, bits) {
  const shift = 32 - bits;
  return (value >>> shift) === (ipv4Number(base) >>> shift);
}

const BLOCKED_V4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function ipv6Number(value) {
  let text = value.toLowerCase();
  if (text.includes(".")) {
    const boundary = text.lastIndexOf(":");
    const v4 = ipv4Number(text.slice(boundary + 1));
    if (v4 === null) return null;
    text = `${text.slice(0, boundary + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.reduce((number, group) => (number << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function inV6Range(value, base, bits) {
  const shift = BigInt(128 - bits);
  return (value >> shift) === (ipv6Number(base) >> shift);
}

/** Conservative global-unicast classification; mapped and transition IPs are rejected. */
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const number = ipv4Number(address);
    return number !== null && !BLOCKED_V4.some(([base, bits]) => inV4Range(number, base, bits));
  }
  if (family === 6) {
    const number = ipv6Number(address);
    if (number === null || !inV6Range(number, "2000::", 3)) return false;
    return ![["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]]
      .some(([base, bits]) => inV6Range(number, base, bits));
  }
  return false;
}

/** Only ordinary public web URLs; never include credentials or unusual ports. */
export function validatePublicUrl(input) {
  let url;
  try { url = new URL(String(input || "").trim()); }
  catch { throw new PublicFetchError("Enter a valid public http or https URL."); }
  if (url.href.length > 2048) throw new PublicFetchError("That URL is too long.");
  if (!["http:", "https:"].includes(url.protocol)) throw new PublicFetchError("Only public http and https links are supported.");
  if (url.username || url.password) throw new PublicFetchError("Links with usernames or passwords are not supported.");
  if (url.port) throw new PublicFetchError("Only the standard HTTP and HTTPS ports are supported.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname.length > 253 || /(?:^|\.)(?:localhost|local|internal|lan|home|arpa)$/.test(hostname) || (!isIP(hostname) && !hostname.includes("."))) {
    throw new PublicFetchError("Private, local and internal addresses are not supported.");
  }
  if (isIP(hostname) && !isPublicAddress(hostname)) throw new PublicFetchError("Private, local and reserved addresses are not supported.");
  // Signed/private links can contain credentials. Do not relay or save them.
  for (const key of url.searchParams.keys()) {
    if (/^(?:token|access[_-]?token|api[_-]?key|key|credential|session(?:id)?|jwt|auth(?:orization)?|password|passwd|secret|signature|sig|policy|key-pair-id|awsaccesskeyid|googleaccessid|__cf_chl_tk|x-amz-.+|x-goog-.+)$/i.test(key)) {
      throw new PublicFetchError("Please use a public link without access tokens or signed credentials.");
    }
  }
  url.hash = "";
  return url;
}

async function resolvePublic(url, lookup, signal) {
  if (signal.aborted) throw new PublicFetchError("The website request was cancelled or timed out.", 502);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  if (family) return { address: hostname, family };
  let records;
  try {
    records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true })),
    ]);
  } catch {
    throw new PublicFetchError("Could not resolve that public website.", 502);
  }
  if (!Array.isArray(records) || !records.length || records.some((item) => !isPublicAddress(item.address))) {
    throw new PublicFetchError("That address resolves to a private, local or reserved network.");
  }
  return { address: records[0].address, family: isIP(records[0].address) };
}

function requestOnce(url, address, { signal, maxBytes, requestImpl }) {
  return new Promise((resolve, reject) => {
    const transport = requestImpl || (url.protocol === "https:" ? https.request : http.request);
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(result);
    };
    const pinnedLookup = (_host, options, callback) => {
      if (options?.all) callback(null, [{ address: address.address, family: address.family }]);
      else callback(null, address.address, address.family);
    };
    const request = transport(url, {
      method: "GET",
      agent: false,
      lookup: pinnedLookup,
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, text/plain, application/pdf, application/json, application/xml, text/*;q=0.9, */*;q=0.2",
        "Accept-Encoding": "identity",
      },
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        finish(null, { redirect: response.headers.location || "" });
        return;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        finish(new PublicFetchError(`The website returned HTTP ${status || "error"}.`, 502));
        return;
      }
      const encoding = String(response.headers["content-encoding"] || "identity").trim().toLowerCase();
      if (encoding !== "identity") {
        response.destroy();
        finish(new PublicFetchError("That site sent compressed data. Use a direct, uncompressed file link."));
        return;
      }
      const length = Number(response.headers["content-length"]);
      if (Number.isFinite(length) && length > maxBytes) {
        response.destroy();
        finish(new PublicFetchError(`The remote file is larger than ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
        return;
      }
      let total = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy();
          finish(new PublicFetchError(`The remote file is larger than ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
        } else chunks.push(chunk);
      });
      response.on("end", () => finish(null, {
        bytes: Buffer.concat(chunks),
        contentType: String(response.headers["content-type"] || "").split(";")[0].trim().slice(0, 120),
      }));
      response.on("error", () => finish(new PublicFetchError("The remote download was interrupted.", 502)));
      response.on("aborted", () => finish(new PublicFetchError("The remote download was interrupted.", 502)));
    });
    request.on("error", () => finish(new PublicFetchError(signal.aborted ? "The website took too long to respond." : "Could not reach that public website.", 502)));
    request.end();
  });
}

/** Dependency injection is used only by tests; production uses Node DNS/HTTP. */
export async function fetchPublicResource(input, { lookup = dns.lookup, requestImpl, maxBytes = MAX_REMOTE_BYTES, timeoutMs = FETCH_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url = validatePublicUrl(input);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const address = await resolvePublic(url, lookup, controller.signal);
      if (controller.signal.aborted) throw new PublicFetchError("The website took too long to respond.", 502);
      const result = await requestOnce(url, address, { signal: controller.signal, maxBytes, requestImpl });
      if (!Object.hasOwn(result, "redirect")) return { ...result, finalUrl: url.href };
      if (!result.redirect || redirects === MAX_REDIRECTS) throw new PublicFetchError("Too many redirects or an invalid redirect.", 502);
      let next;
      try { next = new URL(result.redirect, url).href; }
      catch { throw new PublicFetchError("The website returned an invalid redirect.", 502); }
      url = validatePublicUrl(next);
    }
    throw new PublicFetchError("Too many redirects.", 502);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
