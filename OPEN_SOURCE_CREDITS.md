# Open-source motion credits

The premium shell uses **original, dependency-free CSS and JavaScript** so the app stays offline-first and costs nothing to run. Its interaction patterns were informed by these open-source projects:

- [AOS — Animate On Scroll](https://github.com/michalsnik/aos) — MIT. IntersectionObserver-based reveal-on-scroll pattern and reduced-motion awareness.
- [Motion One](https://github.com/motiondivision/motionone) — MIT. Small, performant Web Animations API ideas and spring-like easing curves.
- [Motion Primitives](https://github.com/ibelick/motion-primitives) — MIT. Blur/scale menu transitions and restrained interface motion.
- [css-motion](https://github.com/epavanello/css-motion) — MIT. CSS-only, accessible, viewport-triggered animation structure.

Vignan's implementation in `js/motion.js` and `styles-premium.css` does not copy their source or bundle their packages. It implements:

- `IntersectionObserver` reveals with staggered delays,
- opacity/transform/blur transitions with a custom cubic-bezier,
- a menu scale/fade entrance,
- focus-visible outlines,
- complete `prefers-reduced-motion` disabling.

Design direction was also informed by [Arena.ai](https://arena.ai/): a large centered headline, a single primary composer, minimal navigation, and an "Auto"-style AI chooser. Vignan uses nicknames and specialties instead of exposing provider names.

No source code, fonts, images, videos, API keys or paid dependencies from those projects are included in this repository.
