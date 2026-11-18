# Threat model

_Last reviewed: 27 October 2026 · release 2.32.0_

This is the short, honest version of what this project defends against, what it
deliberately does not, and where each protection lives in the code. It exists
because "we take security seriously" is not a claim anyone can check. A header, a
token and a test are.

## 1. What this app is holding

| Asset | Where it lives | Damage if it leaks |
| --- | --- | --- |
| Imported books and notes | The student's browser only | Private study material; low blast radius, high embarrassment |
| Chats and quiz history | Browser, and the account record if signed in | Reveals what a student is struggling with |
| Account record | The configured account backend (Supabase) or a local JSON store | Username, age band, progress, friends, chat |
| Session | One `HttpOnly` cookie | Full account takeover for that session |
| Provider API keys | The student's browser, and the server's environment for school keys | Billing abuse; a leaked school key is the worst case |
| Social content | The social store | Bullying and impersonation, which is the real risk here |

There is no payment data, no ID document, no address and no exact date of birth in
the system, and that is a design choice rather than an accident.

## 2. The threats, in the order they are likely

### 2.1 Someone else's script running on our page (XSS)

The highest-value attack: a script in the page can read the DOM, the chat, the
notes and any key typed into Settings, then post it anywhere.

- **Content-Security-Policy.** `script-src 'self' 'wasm-unsafe-eval'` plus a
  `sha256` hash for each genuine inline script (the base64 digest a browser
  computes over the element's text, so the value cannot be forged into a new
  script). No `unsafe-inline`, no `unsafe-eval`. The hashes
  are computed at boot by `inlineScriptHashes()` in `serve.mjs`, so editing a boot
  script cannot leave a stale allowance behind — `tests/csp.test.mjs` fails if a
  page's inline script is not in the policy, or if a hash is hand-typed.
- **`connect-src` is a list, not `https:`.** Until 2.32.0 it allowed every scheme
  and therefore every host; an XSS could have posted a page's contents anywhere.
  It now names the app's real traffic (model providers, the optional local model
  server, the on-device model files, the Wikipedia/DuckDuckGo fallback, and the
  deployment's own Supabase host).
- **Output handling.** Model output and fetched pages are rendered as text, never
  as HTML; markdown is escaped before it becomes markup. There is no `innerHTML`
  path from network data.
- **`object-src 'none'`, `base-uri 'self'`.** No plugin content, and an injected
  `<base>` cannot repoint every relative URL.

### 2.2 Someone else's site making requests as the student (CSRF)

Every mutation requires a same-origin request, a JSON body and a CSRF token; the
session cookie is `SameSite=Lax`. Cross-site form posts are rejected outright.
This is why the preview can be framed without becoming a clickjacking hole: a
framed page still cannot forge a token.

### 2.3 Framing and clickjacking

`frame-ancestors` is deliberately **not** locked to `'self'`: the live preview on
Arena embeds this page in an iframe, and a school fair demo that cannot be shown
is not secure, it is broken. The risk is bounded instead by the CSRF requirement,
by `X-Frame-Options` being absent on purpose, and by the fact that no destructive
action is a single unconfirmed click. If this ever ships outside a preview
context, set `frame-ancestors 'self' https://<school-host>` and drop the exception.

### 2.4 Credential and key handling

No key is in the repository, the bundle or the HTML. The server reads keys from
its environment; students may type their own key in Settings, where it stays in
their browser and is sent only to the provider they picked. A release-time scanner
knows the shape of a Supabase, Google, OpenAI, GitHub, Slack, Cloudflare and AWS
credential and fails the build if one appears in tracked files. A key that does
reach Git is treated as burned: revoke and replace, never quietly delete.

### 2.5 Brute force, scraping and cost abuse

Sign-in, registration, progress, search, link reading, the social layer and the
proxy all have per-address rate limits, and the proxy does not trust
client-supplied `X-Forwarded-For` except from a verified Cloudflare address.
Supabase settings that are incomplete fail closed: the app drops to guest mode
rather than pretending the backend works.

### 2.6 Denial of service and resource exhaustion

Request bodies are size-capped, the AI proxy has a token ceiling and a timeout,
fetched pages are truncated, uploads are parsed in the browser, and compression
results are cached per file and mtime rather than recomputed per request. A slow
or looping upstream is abandoned rather than held.

### 2.7 Supply chain

There is no CDN and no third-party script on any page. Every font, icon, sound and
painted background is a local file in this repository; the service worker
precaches them by content address (`?v=`), so what a student sees is what was
committed. Dependencies are kept to Node's standard library and the app's own
modules.

## 3. What is out of scope

- A hostile hosting provider, or a compromised browser or operating system.
- A student's shared device where somebody else can read local storage. The answer
  is sign-out and *Delete all local data*, which the legal pages say plainly.
- Physical access, and the school's own network controls.
- Nation-state attackers. This is a free tier and a student's spare hours; the aim
  is to be boring to attack and quick to fix, not to be unbreakable.

## 4. Headers actually sent

`serve.mjs` (`baseSecurityHeaders()`), applied to every response:

- `Content-Security-Policy` — as above, including `upgrade-insecure-requests`.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy` — camera, microphone, geolocation, payment, USB and the
  rest are denied; nothing here needs them.
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
- `Strict-Transport-Security` on TLS only, because HSTS on plain HTTP does nothing
  and on a preview host would pin the wrong origin.

## 5. Reporting

Private first: the project operator, the teacher in charge, or the school office.
Include the page or endpoint, what you expected, what happened, and the smallest
reproduction. Do not test with real personal data, do not touch accounts that are
not yours, and do not run automated scanning against the live site. Machine-
readable contact details are at `/.well-known/security.txt`.

## 6. Keeping this document true

The policy is generated in `serve.mjs` and asserted in `tests/csp.test.mjs`; a
change to either without a change here is caught by the last test in that file,
which reads this page and fails if it stops naming the policy, the framing
decision and the hash mechanism.
