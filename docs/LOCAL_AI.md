# Real local AI in Vignan Vidyanikethan AI

Vignan Vidyanikethan AI is an **orchestrator**, not a newly trained model. It retrieves page-labelled passages from your own textbooks and asks an existing AI to write from that evidence. For a completely keyless, private path it now bundles a real open-weight language model runtime: [WebLLM](https://github.com/mlc-ai/web-llm) 0.2.85 (Apache-2.0), vendored in `vendor/webllm/`.

No model weights are committed to Git. On first use the browser downloads one prebuilt MLC model from its official MLC / Hugging Face URLs and caches it locally. After that, the model runs on the device with WebGPU and Vignan's own rules. Textbook data never leaves the browser in this mode.

## What "local" means here

- **Runtime:** `vendor/webllm/web-llm.js` + `js/local-ai-worker.js`. Inference happens inside a Web Worker so the UI stays responsive.
- **Rules:** `js/local-ai.js` prepends `VIGNAN_LOCAL_RULES` (an extension of `SYSTEM_PROMPT` in `js/context.js`) to every request. The model must cite `[n]`, refuse to invent facts, treat passages as data, and return JSON for quiz / flashcard / grading / verification tasks.
- **No training:** the open-weight model is used as-is. Vignan changes the prompt, retrieval and verification pipeline — not the weights.
- **Grounding:** `js/retrieval.js` selects page-preserving passages; `formatContext()` labels them `[1]`, `[2]`, … before they reach the local model.
- **Fallback:** if WebGPU, the worker, or the model is unavailable, `callRoutedModel()` falls back to the deterministic extractive engine in `js/answer.js`. Ollama and LM Studio remain separate keyless providers.

## Choose a model

Open **Settings → Real local model** and pick one. The app recommends a smaller model on phones and low-memory devices.

| Model | Publisher | Approx. download | Approx. VRAM | Best for |
| --- | --- | --- | --- | --- |
| SmolLM2 135M | Hugging Face | ~78 MB | ~360 MB | Low-memory phones; fastest, most basic |
| SmolLM2 360M | Hugging Face | ~204 MB | ~376 MB | Default balance for phones/tablets |
| SmolLM2 360M q4f32 | Hugging Face | ~280 MB | ~580 MB | Compatibility build when shader-f16 is missing |
| Meta Llama 3.2 1B | Meta | ~695 MB | ~879 MB | Better instruction following on laptops/desktops |
| Meta Llama 3.2 1B q4f32 | Meta | ~900 MB | ~1.1 GB | Compatibility build for older GPUs |
| Qwen2.5 0.5B | Alibaba Qwen | ~390 MB | ~945 MB | Compact multilingual alternative |

Meta describes Llama 3.2 1B/3B as lightweight, 128K-context text models for on-device summarisation, instruction following and rewriting ([Meta](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/)). The browser builds are quantised MLC versions, so their effective context is smaller than the base model's 128K. Always check the model's own licence before redistribution; this repo downloads weights at runtime rather than bundling them.

## First run

1. Run `npm start` and open `http://localhost:4173/` (or the deployed HTTPS URL). WebGPU generally requires a secure context: HTTPS or localhost.
2. Open **Settings → Real local model**.
3. Choose a model. Press **Download & enable**.
4. Watch the progress bar. The first download can take a few minutes depending on the model and connection.
5. Once ready, all five AI tasks are routed to the local model: answers, quiz writing, flashcard writing, short-answer grading and citation verification. The fallback remains the offline cited-excerpt engine.

Press **Use cached model** on later visits to load an already-downloaded model into memory. **Test local AI** runs a tiny prompt. **Clear cached model** removes the weights from this browser only.

## Browser support and fallbacks

- **WebGPU required:** current Chrome / Edge (113+), Safari 18+, or Firefox with WebGPU enabled. The settings panel detects `navigator.gpu` and Web Workers.
- **shader-f16:** the smaller `q4f16_1` builds need this GPU feature. If loading fails with a feature/device error, the app automatically retries the corresponding `q4f32_1` build.
- **No WebGPU on a laptop?** Install [Ollama](https://ollama.com/library/llama3.2) and run:

  ```bash
  ollama pull llama3.2:1b
  ollama serve
  ```

  Then choose **Ollama (on-device, offline)** in Settings. It uses `http://localhost:11434` and needs no API key. LM Studio works similarly through its OpenAI-compatible local server.

- **No GPU at all?** The offline extractive engine still answers with page citations, writes quizzes and flashcards, grades objective questions, tracks progress, and creates the result video. It is deterministic rather than generative, but it works on any device with the PWA cached.

## Privacy and cost

- Local mode sends **nothing** to a server. Retrieved passages and prompts stay in the browser worker.
- No API key, subscription, or account is required for local AI.
- The first model download uses the provider's CDN; later use works offline once the app shell and model are cached.
- The PWA service worker caches the 6 MB WebLLM runtime, not the hundreds-of-MB weights. WebLLM manages the weight cache itself.
- Free-tier cloud providers are optional. Never paste a key into Git, a public repo, or a shared student browser; generate your own key and keep it in Render / Supabase environment variables.

## Developer notes

- `js/local-ai.js` exposes `loadLocalModel`, `generateWithLocalAI`, `testLocalAI`, `refreshLocalAIStatus`, `clearLocalModelCache`, and a testable worker factory injection via `setLocalAIWorkerFactory`.
- `js/local-ai-worker.js` owns the `MLCEngine` and speaks a small `load` / `generate` / `status` / `clear` / `unload` / `abort` protocol.
- `js/providers.js` registers `webllm` as a private, keyless provider. `js/model-router.js` calls `generateWithLocalAI()` instead of making an HTTP request for that provider.
- `js/settings.js` stores `localAIModel` and keeps `providers.webllm.model` in sync.
- `tests/local-ai.test.mjs` uses a fake worker, so the router and rules are covered without downloading a model or requiring a GPU.
