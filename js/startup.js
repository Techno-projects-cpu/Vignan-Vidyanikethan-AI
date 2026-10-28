/** A once-per-tab, explicitly dismissible introduction before the entry gate. */
export const STARTUP_SEEN_KEY = "vignan-ai:startup:v1";

export function setupStartup({ screen, gate, enter, skip, focusTarget, storage = null, schedule = (fn) => requestAnimationFrame(fn) }) {
  let seenInMemory = false;
  let isOpen = false;

  function hasSeen() {
    try { return seenInMemory || storage?.getItem(STARTUP_SEEN_KEY) === "1"; }
    catch { return seenInMemory; }
  }

  function dismiss() {
    if (!isOpen) return;
    isOpen = false;
    seenInMemory = true;
    try { storage?.setItem(STARTUP_SEEN_KEY, "1"); } catch { /* Session storage may be blocked. */ }
    screen.hidden = true;
    gate.inert = false;
    if (!gate.hidden) schedule(() => focusTarget?.()?.focus());
  }

  function show() {
    if (hasSeen()) return false;
    isOpen = true;
    gate.inert = true;
    screen.hidden = false;
    schedule(() => { if (isOpen) enter.focus(); });
    return true;
  }

  enter.addEventListener("click", dismiss);
  skip.addEventListener("click", dismiss);
  screen.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
    if (event.key !== "Tab") return;
    const items = [...screen.querySelectorAll('button:not([disabled]), a[href]')].filter((item) => item.getClientRects().length);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const focused = screen.ownerDocument.activeElement;
    if (event.shiftKey && (focused === first || !screen.contains(focused))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (focused === last || !screen.contains(focused))) {
      event.preventDefault(); first.focus();
    }
  });

  return { show, dismiss, isOpen: () => isOpen };
}
