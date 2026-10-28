/** DOM helpers: safe rich text, toasts, modals and confirm dialogs. */

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|_[^_]+_|`[^`]+`|\[\d+\]|\[W\d+\])/g;

function appendInline(parent, text, { sources = [], webSources = [], onSource, onWebSource } = {}) {
  const pieces = String(text).split(INLINE_PATTERN).filter(Boolean);
  for (const piece of pieces) {
    if (/^\*\*[^*]+\*\*$/.test(piece) || /^__[^_]+__$/.test(piece)) {
      parent.appendChild(element("strong", "", piece.slice(2, -2)));
    } else if (/^_[^_]+_$/.test(piece)) {
      parent.appendChild(element("em", "", piece.slice(1, -1)));
    } else if (/^`[^`]+`$/.test(piece)) {
      parent.appendChild(element("code", "", piece.slice(1, -1)));
    } else if (/^\[\d+\]$/.test(piece)) {
      const number = Number(piece.slice(1, -1));
      const button = element("button", "citation", piece);
      button.type = "button";
      const source = sources[number - 1];
      button.title = source
        ? `${source.sourceUrl ? "Web import: " : ""}${source.title}, ${source.sourceUrl && source.sourceKind !== "pdf" ? "section" : "page"} ${source.page}`
        : "Source reference";
      button.addEventListener("click", () => onSource?.(number, sources[number - 1]));
      parent.appendChild(button);
    } else if (/^\[W\d+\]$/.test(piece)) {
      const number = Number(piece.slice(2, -1));
      const source = webSources?.[number - 1];
      const button = element("button", "citation citation-web", piece);
      button.type = "button";
      button.title = source ? `${source.title} (outside your textbooks)` : "Outside source";
      button.addEventListener("click", () => onWebSource?.(number, source));
      parent.appendChild(button);
    } else {
      parent.appendChild(document.createTextNode(piece));
    }
  }
}

/** Render trusted markdown-ish answer text without injecting HTML. */
export function renderRichText(container, text, options = {}) {
  if (!container) return;
  container.replaceChildren();
  const lines = String(text || "").split("\n");
  let list = null;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      list = null;
      container.appendChild(element("div", "rich-gap"));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!list) {
        list = element("ul", "rich-list");
        container.appendChild(list);
      }
      const item = element("li");
      appendInline(item, line.replace(/^[-*]\s+/, ""), options);
      list.appendChild(item);
      continue;
    }
    list = null;
    const paragraph = element("p", "rich-line");
    appendInline(paragraph, line, options);
    container.appendChild(paragraph);
  }
}

let toastTimer = null;
export function showToast(message, type = "info", timeout = 3800) {
  let toast = qs("#toast");
  if (!toast) {
    toast = element("div", "toast");
    toast.id = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), timeout);
}

let activeModal = null;

export function closeModal() {
  if (!activeModal) return;
  const { overlay, onClose, keyHandler, returnFocus, inerted } = activeModal;
  document.removeEventListener("keydown", keyHandler);
  overlay.remove();
  for (const [node, wasInert] of inerted || []) node.inert = wasInert;
  activeModal = null;
  onClose?.();
  if (!activeModal && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

export function openModal({ title = "", content, footer, className = "", onClose, wide = false } = {}) {
  closeModal();
  const returnFocus = document.activeElement;
  // An earlier toast should not cover the actions of a newly opened dialog.
  qs("#toast")?.classList.remove("visible");
  const overlay = element("div", "modal-overlay");
  const dialog = element("div", `modal-dialog ${wide ? "modal-wide" : ""} ${className}`.trim());
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", title || "Dialog");

  const header = element("div", "modal-header");
  header.appendChild(element("h2", "", title));
  const closeButton = element("button", "icon-button", "✕");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close dialog");
  closeButton.addEventListener("click", closeModal);
  header.appendChild(closeButton);
  dialog.appendChild(header);

  const body = element("div", "modal-body");
  if (typeof content === "string") body.textContent = content;
  else if (content) body.appendChild(content);
  dialog.appendChild(body);

  if (footer) {
    const footerNode = element("div", "modal-footer");
    if (typeof footer === "string") footerNode.textContent = footer;
    else footerNode.appendChild(footer);
    dialog.appendChild(footerNode);
  }

  overlay.appendChild(dialog);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  // Keep the obscured workspace out of the tab order and accessibility tree.
  // Preserve pre-existing inert states (for example a closing command menu).
  const inerted = [...document.body.children]
    .filter((node) => node !== overlay && node.id !== "toast" && node.tagName !== "SCRIPT")
    .map((node) => { const wasInert = node.inert; node.inert = true; return [node, wasInert]; });
  const keyHandler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = qsa('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])', dialog)
      .filter((node) => node.getClientRects().length > 0 && !node.closest("[hidden], [inert]"));
    if (!focusable.length) { event.preventDefault(); closeButton.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", keyHandler);
  activeModal = { overlay, onClose, keyHandler, returnFocus, inerted };
  requestAnimationFrame(() => {
    if (activeModal?.overlay !== overlay) return;
    overlay.classList.add("visible");
    closeButton.focus({ preventScroll: true });
  });
  return { element: dialog, body, close: closeModal };
}

export function confirmDialog({ title = "Are you sure?", message = "", confirmLabel = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    const footer = element("div", "modal-actions");
    const cancel = element("button", "button ghost", "Cancel");
    const confirm = element("button", `button ${danger ? "danger" : "primary"}`, confirmLabel);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      closeModal();
    };
    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    footer.append(cancel, confirm);
    const content = element("p", "muted", message);
    openModal({ title, content, footer, onClose: () => finish(false) });
  });
}

export function emptyState(icon = "✦", title = "Nothing here yet", text = "") {
  const wrapper = element("div", "empty-state");
  wrapper.appendChild(element("div", "empty-icon", icon));
  wrapper.appendChild(element("h3", "", title));
  if (text) wrapper.appendChild(element("p", "", text));
  return wrapper;
}

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label || "Working…";
  } else {
    button.disabled = false;
    if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}

export function option(value, label, selected = false) {
  const node = element("option", "", label);
  node.value = value;
  node.selected = selected;
  return node;
}
