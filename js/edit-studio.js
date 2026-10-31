/** Responsive result-edit studio. Everything is rendered and recorded locally. */

import * as ui from "./ui.js?v=40";
import { downloadBlob, truncate } from "./util.js?v=40";
import { canCreateEditBeat, startEditBeat } from "./edit-audio.js?v=40";
import { EDIT_DURATION, EDIT_STYLES, PROJECT_LINK, createPerformanceVideo, createPoster, drawPerformanceCard, scorePercent } from "./card.js?v=40";

/** Text is only copied/shared after a student explicitly chooses that action. */
export function resultCaption(result = {}, share = {}, { includeLink = true, includeInvite = false } = {}) {
  const topic = truncate(String(result.topic || "a chapter quiz").trim() || "a chapter quiz", 80);
  const invite = includeInvite && share.refCode ? ` Join my squad: ${share.refCode}${share.link ? ` ${share.link}` : ""}` : "";
  return `I scored ${scorePercent(result.percent)}% on ${topic}! #VignanAI #StudyStreak${includeLink ? ` ${PROJECT_LINK}` : ""}${invite}`;
}

function button(label, className = "") {
  const node = ui.element("button", className, label);
  node.type = "button";
  return node;
}

function switchRow(title, description, checked = false) {
  const label = ui.element("label", "studio-switch");
  const copy = ui.element("span", "studio-switch-copy");
  copy.append(ui.element("strong", "", title), ui.element("small", "", description));
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const track = ui.element("span", "studio-switch-track");
  track.setAttribute("aria-hidden", "true");
  label.append(copy, input, track);
  return { label, input, description: copy.lastChild };
}

export function openEditStudio({ result = {}, progress = {}, profile = "Student", account = null, share = {} } = {}) {
  const reducedBySystem = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  const content = ui.element("div", "edit-studio");
  const layout = ui.element("div", "studio-layout");
  const stage = ui.element("div", "studio-stage");
  const canvasFrame = ui.element("div", "studio-canvas-frame");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Result edit preview: ${scorePercent(result.percent)} percent on ${result.topic || "your quiz"}.`);
  canvasFrame.appendChild(canvas);
  const stageCopy = ui.element("div", "studio-stage-copy");
  stageCopy.append(
    ui.element("span", "studio-kicker", "YOUR SCORE, REMIXED"),
    ui.element("h3", "", "Make it a moment."),
    ui.element("p", "", "A little celebration of how far you've come."),
  );
  const preview = button("▶  Play preview", "studio-preview-button");
  preview.setAttribute("aria-pressed", "false");
  stageCopy.append(preview, ui.element("span", "studio-format", "9:16 STORY  ·  8 SECONDS"));
  stage.append(canvasFrame, stageCopy);

  const controls = ui.element("div", "studio-controls");
  const heading = ui.element("div", "studio-controls-heading");
  heading.append(ui.element("span", "studio-kicker", "THE CREATIVE BIT"), ui.element("h3", "", "Make it yours."));
  controls.appendChild(heading);

  const styles = ui.element("fieldset", "studio-styles");
  styles.appendChild(ui.element("legend", "", "Choose your vibe"));
  const styleButtons = ui.element("div", "studio-style-buttons");
  const symbols = { nezaad: "↗", voltage: "✳", pop: "✦", mono: "◐" };
  let selectedStyle = "nezaad";
  for (const [id, style] of Object.entries(EDIT_STYLES)) {
    const choice = button("", "studio-style-option");
    choice.dataset.style = id;
    choice.setAttribute("aria-pressed", String(id === selectedStyle));
    choice.setAttribute("aria-label", `${style.label}: ${style.description}`);
    const symbol = ui.element("span", "studio-style-icon", symbols[id]);
    symbol.setAttribute("aria-hidden", "true");
    choice.append(symbol, ui.element("span", "", style.label));
    styleButtons.appendChild(choice);
  }
  styles.appendChild(styleButtons);
  controls.appendChild(styles);

  const audioAvailable = canCreateEditBeat();
  const sound = switchRow("Original funk beat", audioAvailable ? "Made on this device, no music download." : "Sound isn't available in this browser.", !reducedBySystem && audioAvailable);
  sound.input.disabled = !audioAvailable;
  controls.appendChild(sound.label);

  const more = ui.element("details", "studio-more");
  const summary = ui.element("summary");
  summary.append(ui.element("span", "", "More options"), ui.element("span", "studio-more-note", "Quality & privacy  +"));
  more.appendChild(summary);
  const extra = ui.element("div", "studio-extra");
  const qualityLabel = ui.element("label", "studio-quality");
  qualityLabel.appendChild(ui.element("span", "", "Video quality"));
  const quality = document.createElement("select");
  quality.setAttribute("aria-label", "Video quality");
  quality.append(ui.option("540", "540p · fastest on phones"), ui.option("720", "720p · HD", true), ui.option("1080", "1080p · full HD"));
  qualityLabel.appendChild(quality);
  const calm = switchRow("Reduce motion", "Keep the result still and easy to follow.", reducedBySystem);
  const showName = switchRow("Include my nickname", "Your name is hidden unless you choose it.");
  const showInvite = switchRow("Include invite code", share.refCode ? "Add your squad code to the edit." : "Log in to get a squad code.");
  showInvite.input.disabled = !share.refCode;
  const showLink = switchRow("Include Zero Vast QR", "Links to the external Zero Vast site.", true);
  extra.append(qualityLabel, calm.label, showName.label, showInvite.label, showLink.label);
  more.appendChild(extra);
  controls.appendChild(more);

  const status = ui.element("p", "studio-status", "Ready when you are. Your edit stays on this device.");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const progressWrap = ui.element("div", "studio-progress");
  progressWrap.hidden = true;
  progressWrap.setAttribute("role", "progressbar");
  progressWrap.setAttribute("aria-label", "Creating edit video");
  progressWrap.setAttribute("aria-valuemin", "0");
  progressWrap.setAttribute("aria-valuemax", "100");
  progressWrap.setAttribute("aria-valuenow", "0");
  const progressFill = ui.element("span");
  progressWrap.appendChild(progressFill);
  controls.append(status, progressWrap);

  const actions = ui.element("div", "studio-actions");
  const create = button("Create my video  ↗", "button primary studio-create");
  const videoAvailable = Boolean(globalThis.MediaRecorder && canvas.captureStream);
  if (!videoAvailable) {
    create.disabled = true;
    create.textContent = "Video unavailable in this browser";
    status.textContent = "This browser can't record video. You can still save a PNG poster.";
  }
  const shareButton = button("Share video", "button ghost studio-share");
  shareButton.disabled = true;
  const poster = button("Save PNG poster", "button ghost studio-poster");
  const copyCaption = button("Copy share caption", "button ghost studio-copy");
  const captionBox = ui.element("textarea", "studio-caption");
  captionBox.readOnly = true;
  captionBox.rows = 3;
  captionBox.hidden = true;
  captionBox.setAttribute("aria-label", "Caption to copy");
  actions.append(create, shareButton, poster, copyCaption);
  controls.append(actions, captionBox, ui.element("p", "studio-privacy", "Your score and chapter appear in the edit and caption. Nickname and invite are optional. Share only if you want to."));
  layout.append(stage, controls);
  content.appendChild(layout);

  let lastVideo = null;
  let lastOptions = null;
  let previewFrame = 0;
  let previewBeat = null;
  let previewPlaying = false;
  let recording = false;
  let controller = null;
  let closed = false;
  let disabledBeforeRecording = [];
  let brandImage = null;
  const logo = new Image();
  logo.addEventListener("load", () => {
    brandImage = logo;
    if (!closed && !recording && !previewPlaying) drawPreview();
  });
  logo.src = new URL("../assets/brand/nezaad-mark.png", import.meta.url).href;

  function options() {
    return {
      result, progress, profile, account, share,
      style: selectedStyle,
      reducedMotion: calm.input.checked,
      includeName: showName.input.checked,
      includeInvite: showInvite.input.checked && Boolean(share.refCode),
      includeLink: showLink.input.checked,
      brandImage,
      renderWidth: Number(quality.value),
      music: sound.input.checked && audioAvailable,
    };
  }
  function drawPreview(animation = 1) {
    drawPerformanceCard(canvas, { ...options(), renderWidth: 540, animation });
  }
  function stopPreview({ redraw = true } = {}) {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    previewBeat?.stop();
    previewBeat = null;
    previewPlaying = false;
    preview.textContent = "▶  Play preview";
    preview.setAttribute("aria-pressed", "false");
    if (redraw && !closed) drawPreview();
  }
  function invalidate() {
    if (recording) return;
    stopPreview();
    lastVideo = null;
    lastOptions = null;
    create.textContent = videoAvailable ? "Create my video  ↗" : "Video unavailable in this browser";
    create.disabled = !videoAvailable;
    shareButton.disabled = true;
    progressWrap.hidden = true;
    status.textContent = videoAvailable
      ? "Ready when you are. Your edit stays on this device."
      : "This browser can't record video. You can still save a PNG poster.";
  }
  function setRecording(busy) {
    recording = busy;
    content.setAttribute("aria-busy", String(busy));
    if (busy) {
      disabledBeforeRecording = [...content.querySelectorAll("button, input, select, textarea")].map((node) => [node, node.disabled]);
      disabledBeforeRecording.forEach(([node]) => { node.disabled = true; });
      more.classList.add("is-disabled");
      more.setAttribute("aria-disabled", "true");
    } else {
      disabledBeforeRecording.forEach(([node, wasDisabled]) => { node.disabled = wasDisabled; });
      disabledBeforeRecording = [];
      more.classList.remove("is-disabled");
      more.removeAttribute("aria-disabled");
      shareButton.disabled = !lastVideo;
    }
  }
  more.addEventListener("click", (event) => { if (recording && event.target.closest("summary")) event.preventDefault(); });

  styleButtons.addEventListener("click", (event) => {
    const choice = event.target.closest("button[data-style]");
    if (!choice || recording || !EDIT_STYLES[choice.dataset.style]) return;
    selectedStyle = choice.dataset.style;
    [...styleButtons.children].forEach((node) => node.setAttribute("aria-pressed", String(node === choice)));
    invalidate();
  });
  for (const input of [sound.input, calm.input, showName.input, showInvite.input, showLink.input, quality]) input.addEventListener("change", invalidate);

  preview.addEventListener("click", () => {
    if (previewPlaying) {
      stopPreview();
      status.textContent = "Preview stopped.";
      return;
    }
    previewPlaying = true;
    preview.textContent = "■  Stop preview";
    preview.setAttribute("aria-pressed", "true");
    status.textContent = "Playing your preview.";
    if (sound.input.checked) {
      previewBeat = startEditBeat({ duration: EDIT_DURATION });
      if (!previewBeat) status.textContent = "Playing silently; the beat isn't available here.";
      else {
        const currentBeat = previewBeat;
        currentBeat.ready.then((ready) => {
          if (!ready && previewBeat === currentBeat) status.textContent = "Playing silently; the beat couldn't start.";
        }).catch(() => { if (previewBeat === currentBeat) status.textContent = "Playing silently; the beat couldn't start."; });
      }
    }
    const started = performance.now();
    let lastDraw = 0;
    const frame = (now) => {
      if (!previewPlaying || closed) return;
      const value = Math.min(1, (now - started) / EDIT_DURATION);
      if (now - lastDraw >= 40 || value === 1) {
        drawPreview(value);
        lastDraw = now;
      }
      if (value < 1) previewFrame = requestAnimationFrame(frame);
      else { stopPreview(); status.textContent = "Preview finished. Ready to create your video."; }
    };
    previewFrame = requestAnimationFrame(frame);
  });

  create.addEventListener("click", () => {
    if (recording) return;
    if (lastVideo) {
      downloadBlob(lastVideo.blob, lastVideo.filename);
      ui.showToast(`${lastVideo.extension.toUpperCase()} video saved.`, "success");
      return;
    }
    stopPreview();
    const settings = options();
    controller = new AbortController();
    setRecording(true);
    create.textContent = "Creating your edit…";
    progressWrap.hidden = false;
    progressFill.style.width = "0%";
    progressWrap.setAttribute("aria-valuenow", "0");
    status.textContent = "Creating on your device. Keep this tab open for about 8 seconds.";
    // Do not await before this call: mobile browsers require the tap to unlock
    // the optional audio context. The visible canvas also lets students see
    // the edit as it is being recorded.
    createPerformanceVideo({
      canvas, ...settings, signal: controller.signal,
      onProgress: (value) => {
        const percent = Math.round(value * 100);
        progressFill.style.width = `${percent}%`;
        progressWrap.setAttribute("aria-valuenow", String(percent));
      },
      onRetry: ({ silent } = {}) => {
        status.textContent = silent ? "Sound isn't supported here; trying a silent video. Keep this tab open." : "Trying another video format. Keep this tab open.";
      },
    }).then((video) => {
      if (closed) return;
      lastVideo = video;
      lastOptions = settings;
      create.textContent = `Download ${video.extension.toUpperCase()}  ↓`;
      status.textContent = settings.music && !video.hasAudio
        ? "Your video is ready without sound; this browser couldn't record the beat."
        : `Your ${video.extension.toUpperCase()} edit is ready${video.hasAudio ? " with the original beat" : " (silent)"}. Download or share it below.`;
      drawPreview();
    }).catch((error) => {
      if (closed) return;
      create.textContent = "Create my video  ↗";
      const reason = error.message || "Couldn't create a video.";
      status.textContent = error.name === "AbortError" ? reason : `${reason} Try 540p in More options or save the PNG poster.`;
      drawPreview();
      if (error.name !== "AbortError") ui.showToast(status.textContent, "error");
    }).finally(() => {
      controller = null;
      if (!closed) setRecording(false);
    });
  });

  poster.addEventListener("click", async () => {
    if (recording) return;
    stopPreview();
    poster.disabled = true;
    try {
      const blob = await createPoster(canvas, options());
      if (closed) return;
      downloadBlob(blob, `vignan-ai-edit-${new Date().toISOString().slice(0, 10)}.png`);
      status.textContent = "Your PNG poster is ready.";
      ui.showToast("PNG poster saved.", "success");
    } catch (error) {
      if (!closed) ui.showToast(error.message || "Couldn't create the poster.", "error");
    } finally {
      poster.disabled = false;
      if (!closed) drawPreview();
    }
  });

  copyCaption.addEventListener("click", async () => {
    if (recording) return;
    const caption = resultCaption(result, share, options());
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(caption);
      if (closed) return;
      captionBox.hidden = true;
      status.textContent = "Caption copied. It includes your score and chapter.";
      ui.showToast("Caption copied.", "success");
    } catch {
      if (closed) return;
      // A readonly field lets students copy manually when clipboard access is blocked.
      captionBox.value = caption;
      captionBox.hidden = false;
      captionBox.focus();
      captionBox.select();
      status.textContent = "Copy the selected caption manually; it includes your score and chapter.";
    }
  });

  shareButton.addEventListener("click", async () => {
    if (!lastVideo || recording) return;
    try {
      const file = new File([lastVideo.blob], lastVideo.filename, { type: lastVideo.mime.split(";")[0] });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        // Sharing is invoked directly in this tap, not after an 8-second render.
        await navigator.share({
          files: [file],
          title: "My Vignan AI edit",
          text: resultCaption(result, share, lastOptions || {}),
        });
      } else {
        downloadBlob(lastVideo.blob, lastVideo.filename);
        ui.showToast("This browser can't share video directly, so it was downloaded instead.", "info");
      }
    } catch (error) {
      if (error.name !== "AbortError") ui.showToast("Couldn't open sharing. You can download the video instead.", "error");
    }
  });

  drawPreview();
  return ui.openModal({
    title: "Your edit studio",
    content,
    className: "edit-studio-dialog",
    wide: true,
    onClose: () => {
      closed = true;
      stopPreview({ redraw: false });
      controller?.abort();
    },
  });
}
