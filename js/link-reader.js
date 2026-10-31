/** Read public links through the bounded, same-origin server fetcher. */
import { inspectFileBytes, MAX_REMOTE_BYTES } from "./files.js?v=39";
import { extractPdfPages } from "./ingest.js?v=39";
import { safeUrl } from "./util.js?v=39";

export function firstLink(text = "") {
  const match = String(text).match(/https?:\/\/[^\s<>"'`]+/i);
  if (!match) return "";
  // Punctuation following a pasted URL is usually part of the sentence.
  let value = match[0].replace(/[.,!?;:]+$/, "");
  if (value.endsWith(")") && (value.match(/\)/g) || []).length > (value.match(/\(/g) || []).length) value = value.slice(0, -1);
  return safeUrl(value) || "";
}

export function hasLinkCredentials(url) {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return true;
    return [...parsed.searchParams.keys()].some((key) => /^(?:token|access[_-]?token|api[_-]?key|key|credential|session(?:id)?|jwt|auth(?:orization)?|password|passwd|secret|signature|sig|policy|key-pair-id|awsaccesskeyid|googleaccessid|__cf_chl_tk|x-amz-.+|x-goog-.+)$/i.test(key));
  } catch { return false; }
}

function safeFileName(url) {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).pop() || "webpage";
    return decodeURIComponent(path).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 140) || "webpage";
  } catch { return "webpage"; }
}

export async function downloadPublicLink(url, { signal } = {}) {
  if (!safeUrl(url)) throw new Error("Enter a public http or https link.");
  if (hasLinkCredentials(url)) throw new Error("Please use a public link without usernames, passwords or signed credentials.");
  const response = await fetch("api/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  if (!response.ok) {
    let error = "Could not read that public link.";
    try { error = (await response.json()).error || error; } catch { /* use generic message */ }
    throw new Error(error);
  }
  const length = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > MAX_REMOTE_BYTES) throw new Error("The remote file is larger than 12 MB.");
  let finalUrl = url;
  try { finalUrl = decodeURIComponent(response.headers.get("X-Vignan-Source-URL") || "") || url; } catch { /* preserve the requested URL */ }
  if (!safeUrl(finalUrl) || hasLinkCredentials(finalUrl)) throw new Error("The website returned an invalid or private source URL.");
  const type = response.headers.get("X-Vignan-Content-Type") || "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_REMOTE_BYTES) throw new Error("The remote file is larger than 12 MB.");
  const inspected = inspectFileBytes(bytes, { name: safeFileName(finalUrl), mime: type });
  const file = new File([bytes], inspected.name, { type: inspected.kind === "pdf" ? "application/pdf" : "text/plain" });
  return { url: finalUrl, file, inspected };
}

export async function readPublicLink(url, { signal, onProgress } = {}) {
  const result = await downloadPublicLink(url, { signal });
  const { inspected, file } = result;
  const pages = inspected.kind === "pdf"
    ? await extractPdfPages(file, onProgress)
    : [{ page: 1, text: inspected.text, heading: inspected.title || "Online source" }];
  const title = inspected.title || inspected.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || new URL(result.url).hostname;
  return { ...result, title: title.slice(0, 120), pages };
}
