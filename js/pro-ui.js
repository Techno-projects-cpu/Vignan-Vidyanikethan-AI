/**
 * The Pro Mode activation sequence: a short, skippable HUD boot.
 *
 * Kept out of app.js so it can be driven directly in a DOM harness, and built
 * so it always finishes: every timer is bounded, a click or a keypress skips
 * it, and reduced-motion users get a single cross-fade instead of the sweep.
 */

const LINE_INTERVAL = 190;
const MAX_DURATION = 3400;

function reducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

/**
 * @param {object} options
 * @param {string[]} options.lines boot lines, shown one at a time
 * @param {string} options.title headline shown at the end
 * @param {number} options.duration total time budget in ms
 * @returns {Promise<boolean>} true when the sequence played, false if the overlay was missing
 */
export function playProActivation({ lines = [], title = "PRO MODE", duration = MAX_DURATION } = {}) {
  const overlay = globalThis.document?.getElementById("pro-overlay");
  const console_ = globalThis.document?.getElementById("pro-console");
  const label = globalThis.document?.getElementById("pro-title");
  const skip = globalThis.document?.getElementById("pro-skip");
  if (!overlay || !console_ || !label) return Promise.resolve(false);

  const fast = reducedMotion();
  const step = fast ? Math.min(90, duration / Math.max(1, lines.length)) : Math.min(LINE_INTERVAL, duration / Math.max(1, lines.length + 2));

  overlay.hidden = false;
  overlay.classList.remove("pro-closing");
  overlay.classList.add("pro-active");
  document.body.classList.add("pro-booting");
  console_.replaceChildren();
  label.textContent = title;
  label.classList.remove("pro-title-live");
  overlay.setAttribute("aria-hidden", "false");

  let finished = false;
  let timer = null;
  const timers = [];
  let resolve;
  const done = new Promise((settle) => { resolve = settle; });

  const cleanup = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    clearTimeout(timer);
    overlay.classList.remove("pro-active");
    overlay.classList.add("pro-closing");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pro-booting");
    globalThis.setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("pro-closing");
    }, 420);
    document.removeEventListener("keydown", onKey, true);
    skip?.removeEventListener("click", cleanup);
    overlay.removeEventListener("click", cleanup);
    resolve(true);
  };

  const onKey = (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") cleanup();
  };

  document.addEventListener("keydown", onKey, true);
  skip?.addEventListener("click", cleanup);
  overlay.addEventListener("click", cleanup);

  lines.forEach((line, index) => {
    timers.push(
      globalThis.setTimeout(() => {
        if (finished) return;
        const row = document.createElement("div");
        row.className = "pro-line";
        row.textContent = line;
        console_.appendChild(row);
        // Keep the console to a readable height on small phones.
        while (console_.childElementCount > 9) console_.firstElementChild?.remove();
        if (index === lines.length - 1) label.classList.add("pro-title-live");
      }, Math.round(step * (index + 1))),
    );
  });

  timer = globalThis.setTimeout(cleanup, Math.max(duration, step * (lines.length + 1)));
  return done;
}

/** Toggle the chrome that marks Pro Mode: body class and the topbar chip. */
export function setProChrome(on) {
  const body = globalThis.document?.body;
  const chip = globalThis.document?.getElementById("pro-chip");
  body?.classList.toggle("pro-mode", Boolean(on));
  if (chip) {
    chip.hidden = !on;
    chip.setAttribute("aria-pressed", on ? "true" : "false");
  }
}
