# API and runtime review — 2.46.3 / v86

Reviewed 27 October 2026. Scope: browser provider adapters, hosted key router,
WebLLM main-thread/worker protocol, vendored runtime catalogue, deployment stack,
and existing offline/security/layout gates. This is not proof that every external
model, API key, browser GPU or provider account works.

## Reproduced defects fixed

- **Local cancellation hang:** pending promises were marked settled before their
  rejection ran. Cancellation now rejects before sending the worker interrupt,
  including an immediate worker acknowledgement. Worker replacement also rejects
  pending operations; a crashed worker is discarded so the next load can retry.
- **WebGPU command races:** model loading, generation, unload and cache deletion
  are serialized in the actual worker. Interrupt commands remain independent;
  cancellation of a queued command cannot interrupt a different active command.
  Generation keeps its selected model ID instead of reading mutable global state.
- **Misleading cache deletion:** failed WebLLM cache operations now report an
  error instead of always claiming successful deletion.
- **API cancellation and privacy:** a cancelled model task propagates cancellation
  rather than starting a fallback provider. Offline mode is enforced inside the
  router even if saved task routes still point at the cloud.
- **False success:** HTML login/proxy error pages with HTTP 200 are no longer
  accepted as model answers by either browser adapters or the server router.
- **Retry deadline mismatch:** the server previously allowed 45 seconds for each
  key while the browser gave the entire operation 35 seconds. Server attempts now
  share one 25-second request budget; a timeout stops further attempts. The
  budget can leave later providers untried when an earlier one stalls, rather
  than sending orphaned calls after the browser gives up.
- Node minimum raised to 22 and Render pinned to the CI-tested Node 22 LTS major,
  replacing the allowance for end-of-life Node 18.

## Verification performed

- Full `npm run check`: **764 tests pass**, including real-handler account/API
  checks, secret-pattern scan and offline cache simulation.
- All six selectable local model IDs exist in the **actual shipped WebLLM
  catalogue**, including the two shader-f32 compatibility builds.
- Chromium imports the real bundled WebLLM worker under the served CSP and gets
  a cache-status response (`tools/check-local-runtime.mjs`). No model weights or
  GPU inference are involved in that check.
- Chromium Start/navigation/Presentation/language layouts pass at 390, 768, 1024
  and 1366px; hosted default and Nezaad routing checks use mocked AI responses.
- Real local-server public-link check: public Node.js GitHub README downloaded
  successfully and indexed into 22 passages. This is README reading, not crawling
  an entire repository. The sandbox server needed the system CA bundle through
  `NODE_EXTRA_CA_CERTS`; certificate verification was not disabled.
- Deployed health endpoint reports 2.46.2 on main, with OpenRouter and Bytez
  configured and two server keys. This is configuration evidence only, not a
  successful inference or confirmation that either key has quota.

## Remaining verification limits

No deployed-key inference was run. No operator keys are present in this checkout;
no keys were requested, logged, embedded or copied into browser code. This
sandbox cannot prove a first-download or actual WebGPU generation on the user's
phone/tablet. GPU adapter limits, model-host redirects, cache eviction, provider
model retirement, quotas and live Supabase policies still need deployment/device
checks. Bytez usage may cost credits. Successful aggregate health is not an
inference test.

The stack remains plain browser modules, vendored PDF.js/WebLLM, a Node HTTP
server, optional Supabase accounts/social storage and a service worker. No new
framework, CDN runtime dependency, OCR/image recognizer or Mirage integration
was introduced by this audit.
