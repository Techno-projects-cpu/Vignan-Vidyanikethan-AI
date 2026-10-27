# WebLLM (Apache-2.0)

Vendored from `@mlc-ai/web-llm@0.2.85` (https://www.npmjs.com/package/@mlc-ai/web-llm).
The ESM bundle is `web-llm.js`; the source map was omitted to keep the offline shell small.
License: see `LICENSE`.

Model weights are NOT vendored. On first use, WebLLM downloads the selected
open-weight model from its official MLC/Hugging Face URLs and caches it in the
browser. Later runs work offline. Vignan Vidyanikethan AI wraps the model with
its own textbook-grounding rules; it does not train or fine-tune the model.
