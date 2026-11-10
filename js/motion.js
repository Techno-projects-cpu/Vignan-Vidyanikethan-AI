/**
 * Tiny dependency-free motion layer for the premium shell.
 *
 * Inspired by open-source animation work in AOS, Motion One, Motion
 * Primitives and css-motion (see OPEN_SOURCE_CREDITS.md). No third-party code
 * is copied: this module only uses IntersectionObserver, CSS classes and a
 * reduced-motion check. It degrades to fully visible content.
 */

const REVEALED = "is-revealed";
let observer = null;
let reducedMotion = false;

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function markAll(root) {
  root.querySelectorAll?.("[data-reveal]").forEach((element) => element.classList.add(REVEALED));
}

export function initMotion({ root = globalThis.document } = {}) {
  reducedMotion = prefersReducedMotion();
  if (!root || reducedMotion || typeof globalThis.IntersectionObserver === "undefined") {
    markAll(root);
    return () => {};
  }
  observer?.disconnect();
  observer = new globalThis.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(REVEALED);
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.06, rootMargin: "0px 0px -48px 0px" },
  );
  const elements = [...root.querySelectorAll("[data-reveal]")];
  elements.forEach((element, index) => {
    element.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 45}ms`);
    element.classList.add("will-reveal");
    observer.observe(element);
  });
  revealVisible(root);
  return () => observer?.disconnect();
}

/** Reveal anything already on screen (useful after switching hidden views). */
export function revealVisible(root = globalThis.document) {
  if (!root || reducedMotion || !observer) {
    markAll(root);
    return;
  }
  const height = globalThis.innerHeight || 800;
  root.querySelectorAll?.("[data-reveal]:not(.is-revealed)").forEach((element) => {
    const rect = element.getBoundingClientRect?.();
    if (!rect || (rect.top < height * 0.92 && rect.bottom > -40)) {
      element.classList.add(REVEALED);
      observer?.unobserve(element);
    }
  });
}

/** One subtle attention pulse without colour, used after an AI switch. */
export function pulseElement(element) {
  if (!element || reducedMotion) return;
  element.classList.remove("premium-pulse");
  void element.offsetWidth;
  element.classList.add("premium-pulse");
  globalThis.setTimeout?.(() => element.classList.remove("premium-pulse"), 700);
}
