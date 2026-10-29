# Open-source and asset credits

The monochrome interface and animations are original CSS and JavaScript. They run locally without a paid runtime dependency. Interaction ideas were informed by these projects; their code is **not** bundled:

- [AOS — Animate On Scroll](https://github.com/michalsnik/aos), MIT — IntersectionObserver-based reveal patterns.
- [Motion One](https://github.com/motiondivision/motionone), MIT — small, performant animation ideas and easing.
- [Motion Primitives](https://github.com/ibelick/motion-primitives), MIT — restrained interface transitions.
- [css-motion](https://github.com/epavanello/css-motion), MIT — accessible CSS motion and reduced-motion awareness.

- [Eklavya / StudyPilot Voice](https://github.com/visheshpandey/Eklavya) — the idea of a viva examiner that probes an answer and names the misconception, and of a voice-first study loop. That repository publishes **no licence**, so no code, text or prompt was copied; the viva rules in `js/viva.js` and the speech helpers in `js/voice.js` were written for this project. Our marks, bands and probe rules are our own, and every line the examiner says comes from the student's cited page.

The command menu and prompt-first layout were also informed by [Arena.ai](https://arena.ai/); Vignan uses its own implementation and AI nicknames. No Arena source, fonts, images, API keys or paid dependencies are included.

## Bundled assets and code

- [Space Grotesk](https://github.com/floriankarsten/space-grotesk), copyright 2020 The Space Grotesk Project Authors, and [Manrope](https://github.com/sharanda/manrope), copyright 2019 The Manrope Project Authors. Latin variable WOFF2 subsets come from Fontsource 5.3.0; both use the SIL Open Font License 1.1. Full notices are in `assets/fonts/`. Other scripts fall back to device fonts. No remote font service is needed.
- [QR Code Generator for JavaScript](https://github.com/kazuhikoarase/qrcode-generator), version 2.0.4, copyright 2009 Kazuhiko Arase, MIT. `vendor/qr/qrcode.js` renders the optional Zero Vast QR entirely on device; its license is in `vendor/qr/LICENSE.txt`. “QR Code” is a registered trademark of DENSO WAVE INCORPORATED.
- The **Vignan Vidyanikethan AI** logo was supplied by the project owner and redrawn as vectors in `assets/brand/vignan-ai-mark.svg` and `icons/icon.svg`; the PNG and ICO icons are rasterizations of that mark. The **Nezaad Industries** mark was also supplied by the project owner; its transparent version is a crop of the supplied image. These marks are not covered by the application's MIT code license.
- [PDF.js](https://github.com/mozilla/pdf.js) 4.2.67 and its CMaps/fonts are vendored in `vendor/pdfjs/` under Apache-2.0 and their respective included notices.
- [WebLLM](https://github.com/mlc-ai/web-llm) is vendored in `vendor/webllm/` under its included Apache-2.0 license. Optional model weights are downloaded separately and have their own licenses.
