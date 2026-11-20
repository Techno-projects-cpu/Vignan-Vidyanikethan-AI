/** Progressive enhancement: the complete story remains readable without JS. */
const sections = [...document.querySelectorAll(".slide")];
const progress = document.querySelector("#present-progress");
const previous = document.querySelector("#present-prev");
const next = document.querySelector("#present-next");
let current = 0;
let painted = -1;
function update() {
  const target = innerHeight * .35;
  let closest = Infinity;
  sections.forEach((section, index) => {
    const distance = Math.abs(section.getBoundingClientRect().top - target);
    if (distance < closest) { closest = distance; current = index; }
  });
  if (painted === current) return;
  painted = current;
  progress.textContent = `${String(current + 1).padStart(2, "0")} / ${String(sections.length).padStart(2, "0")}`;
  previous.disabled = current === 0;
  next.disabled = current === sections.length - 1;
}
function go(index) {
  const section = sections[Math.max(0, Math.min(sections.length - 1, index))];
  section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}
previous.addEventListener("click", () => go(current - 1));
next.addEventListener("click", () => go(current + 1));
document.addEventListener("keydown", event => {
  if (event.target.closest("input, textarea, select, [contenteditable]")) return;
  if (["ArrowRight", "PageDown", "ArrowLeft", "PageUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    go(event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : current + (["ArrowRight", "PageDown"].includes(event.key) ? 1 : -1));
  }
});
let frame = 0;
addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); }, { passive: true });
addEventListener("resize", update);
const fullscreen = document.querySelector("#present-fullscreen");
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    document.querySelector("#present-status").textContent = "Full screen is unavailable here. The presentation still works in this window.";
  }
});
document.addEventListener("fullscreenchange", () => { fullscreen.textContent = document.fullscreenElement ? "Exit full screen ↙" : "Full screen ↗"; });
update();
