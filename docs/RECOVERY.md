# Automatic recovery — 2.47.0 / v87

## What happens after an AI failure

1. Use the selected route. The server already rotates its configured API keys.
2. With automatic recovery enabled, try Nova/WebLLM **only if a model is already
   loaded and WebGPU/worker capability is available**. Use that loaded model,
   rather than downloading a different model selected in Settings.
3. Try a distinct, explicitly configured fallback, if available. Recovery does
   not discover or send questions to additional cloud providers on its own.
4. Return control to the existing deterministic textbook/search composition
   paths. With saved textbook material the local extractive engine remains
   usable without a provider. If no source answers, the app should say so, not
   invent an answer or pretend that AI succeeded.

Explicit Bolt selection and Offline mode remain device-only. Offline mode takes
priority over model routes. A cancelled request is never retried. Automatic
recovery can be disabled in Settings → Study & AI; any explicitly configured
fallback still applies when automatic recovery is disabled.

Automatic recovery never starts a model download. To prepare local generation,
open Settings → Study & AI → Real local model and intentionally load a model on
that device while online. Merely having some files cached is not proof that a
model is usable. Phones without WebGPU use the deterministic final fallback.

## Error detection and limits

- Two failed calls pause that route for 60 seconds in this tab; successful calls
  clear its failure count. The route identity changes with endpoint/model/key
  configuration. No saved model selection is rewritten.
- Auto-recovery skips network routes when the browser explicitly reports offline.
  Reconnecting clears route pauses, but never resends a question. The retry button
  also only clears this tab's pauses: the user must submit the next request.
- Recovery shares a 45-second routing budget; automatic local inference gets at
  most 15 seconds of the remaining budget. Explicit WebLLM selection retains the
  intentional first-download flow. Failure to finish does not mean the GPU or
  network was forcibly terminated immediately; underlying interruption is best
  effort, and pending operations are cancelled through their existing signal.
- Per-tab diagnostics retain up to eight allowlisted category/provider pairs and
  a runtime-error count. No prompts, pages, files, keys, raw errors or endpoint
  URLs are retained in that record, sent to analytics or persisted to storage.
  Runtime errors are observed, not suppressed. No automatic reload can discard
  a form or start a reload loop. The panel offers a human-readable status.
- The browser layer catches operational failures, not every wrong AI answer.
  Citation checks and source review remain necessary.

## Cached-app resilience

Previously cached navigation is used for a hosting 5xx or network failure. API
requests are not cached or replayed. Essential scripts/styles and the entry page
must exist in a new worker cache before it activates; if installation is partial,
the previous worker stays installed. Cache writes failing (for example, quota)
should not turn a successful network response into a failed navigation.

This is not a 24/7 hosting guarantee. A first-time visitor without a cached app
still needs the host. Accounts, social features and web search need their servers.
Browser storage can be evicted, and a device may lack WebGPU or usable RAM. Cached
textbook lookup works only with material actually available on that device.

## Checks

- `npm run check`: 772 passing tests, secret scan and offline simulation pass;
  460 precache URLs / 565 installed offline files.
- Actual router tests: cloud failure → ready WebLLM with no new load, unchanged
  saved route, cooldown/manual reset, disabled recovery, unavailable local model,
  cancellation, Offline mode and configuration-sensitive identities.
- Worker simulation tests: hosting 503 → cached navigation, API exclusion and
  incomplete installation rejected before activation.
- `tools/check-recovery.mjs`: Chromium exercises mocked 503 → mocked ready Nova,
  repeated failure cooldown, visible Settings controls, reset and opt-out; no
  Settings overflow at 390/768/1366px. These are mocked inference responses.
- Existing Chromium gates: Start/Presentation/languages at four widths; empty and
  long Chat at five phone/tablet/desktop sizes. No claim of live-key quota testing
  or actual GPU inference on a user device.
