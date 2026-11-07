/**
 * The Pro Mode activation sequence: a HUD boot that reads like a machine
 * recognising a person, then locks on.
 *
 * Kept out of app.js so it can be driven directly in a DOM harness. It is built
 * so it always finishes: every timer is bounded, a click or a keypress skips
 * it, and reduced-motion users get the same words with no motion at all.
 *
 * The sequence has four beats:
 *   1. wake      the overlay opens, the reticle spins up
 *   2. recognise boot lines type out one at a time, each one a real readout
 *   3. lock      the title assembles letter by letter, the frame flashes once
 *   4. hold      a beat to read it, then the iris closes
 */

const LINE_INTERVAL = 300;
const MAX_DURATION = 4600;
const TYPE_TICK = 14;

function reducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

/** The short label shown above the console for each boot line. */
export function phaseLabel(line = "") {
  const text = String(line).replace(/^>\s*/, "").trim();
  const head = text.split(/[·:—]/)[0].trim();
  if (!head) return "system";
  const words = head.split(/\s+/).slice(0, 2).join(" ");
  return words.toLowerCase();
}

/**
 * @param {object} options
 * @param {string[]} options.lines boot lines, typed one at a time
 * @param {string} options.title headline assembled at the end
 * @param {number} options.duration total time budget in ms
 * @returns {Promise<boolean>} true when the sequence played, false if the overlay was missing
 */
export function playProActivation({ lines = [], title = "PRO MODE", duration = MAX_DURATION } = {}) {
  const doc = globalThis.document;
  const overlay = doc?.getElementById("pro-overlay");
  const console_ = doc?.getElementById("pro-console");
  const label = doc?.getElementById("pro-title");
  const kicker = doc?.getElementById("pro-kicker");
  const meter = doc?.getElementById("pro-meter");
  const skip = doc?.getElementById("pro-skip");
  if (!overlay || !console_ || !label) return Promise.resolve(false);

  const fast = reducedMotion();
  const total = Math.max(0, lines.length);
  const pace = fast
    ? Math.max(40, Math.min(90, duration / Math.max(1, total + 2)))
    : Math.max(140, Math.min(LINE_INTERVAL, duration / Math.max(1, total + 3)));

  // ---- reset ------------------------------------------------------------
  overlay.hidden = false;
  overlay.classList.remove("pro-closing", "pro-locked");
  overlay.classList.add("pro-active");
  overlay.style.setProperty("--pro-total", String(total || 1));
  doc.body.classList.add("pro-booting");
  console_.replaceChildren();
  if (kicker) kicker.textContent = "standby";
  setProgress(0);

  // The title is assembled from single letters so they can land in sequence.
  label.replaceChildren(
    ...String(title).split("").map((character, index) => {
      const span = doc.createElement("span");
      span.className = "pro-letter";
      span.textContent = character;
      span.style.setProperty("--i", String(index));
      return span;
    }),
  );
  label.classList.remove("pro-title-live");
  overlay.setAttribute("aria-hidden", "false");

  let finished = false;
  let closingTimer = null;
  const timers = [];
  const typers = [];
  let resolve;
  const done = new Promise((settle) => { resolve = settle; });

  function setProgress(percent) {
    const value = `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
    meter?.style.setProperty("--pro-progress", value);
    overlay.setAttribute("data-progress", value);
  }

  const cleanup = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    typers.forEach(clearInterval);
    clearTimeout(closingTimer);
    overlay.classList.remove("pro-active");
    overlay.classList.add("pro-closing");
    overlay.setAttribute("aria-hidden", "true");
    doc.body.classList.remove("pro-booting");
    closingTimer = globalThis.setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("pro-closing", "pro-locked");
    }, fast ? 0 : 460);
    doc.removeEventListener("keydown", onKey, true);
    skip?.removeEventListener("click", cleanup);
    overlay.removeEventListener("click", cleanup);
    resolve(true);
  };

  const onKey = (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") cleanup();
  };

  doc.addEventListener("keydown", onKey, true);
  skip?.addEventListener("click", cleanup);
  overlay.addEventListener("click", cleanup);

  // ---- beat 2 and 3: recognise, then lock -------------------------------
  const lockAt = Math.round(pace * (total + 1));

  lines.forEach((line, index) => {
    const start = Math.round(pace * (index + 1));
    timers.push(
      globalThis.setTimeout(() => {
        if (finished) return;
        const row = doc.createElement("div");
        row.className = "pro-line";
        const body = doc.createElement("span");
        body.className = "pro-line-body";
        row.appendChild(body);
        console_.appendChild(row);
        while (console_.childElementCount > 9) console_.firstElementChild?.remove();
        if (kicker) kicker.textContent = phaseLabel(line);
        setProgress((index / Math.max(1, total)) * 92);

        // The chevron is drawn by CSS, so drop the one the line already starts with.
        const text = String(line).replace(/^>\s*/, "");
        if (fast) {
          body.textContent = text;
          row.classList.add("pro-line-done");
          return;
        }
        // Type in small chunks: fast enough to feel like a machine, slow
        // enough to be readable, and one interval per line so cleanup is a
        // single clear call.
        const chunk = Math.max(1, Math.ceil(text.length / 16));
        let cursor = 0;
        const typer = globalThis.setInterval(() => {
          if (finished) {
            clearInterval(typer);
            return;
          }
          cursor += chunk;
          body.textContent = text.slice(0, cursor);
          if (cursor >= text.length) {
            clearInterval(typer);
            body.textContent = text;
            row.classList.add("pro-line-done");
          }
        }, TYPE_TICK);
        typers.push(typer);
      }, start),
    );
  });

  timers.push(
    globalThis.setTimeout(() => {
      if (finished) return;
      overlay.classList.add("pro-locked");
      label.classList.add("pro-title-live");
      if (kicker) kicker.textContent = "locked on";
      setProgress(100);
    }, fast ? Math.round(pace * (total + 1) * 0.5) : lockAt),
  );

  // ---- beat 4: hold, then close -----------------------------------------
  const budget = Math.max(duration, lockAt + (fast ? 240 : 900));
  closingTimer = globalThis.setTimeout(cleanup, budget);
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
