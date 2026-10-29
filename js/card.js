/**
 * Result edit studio: an original, locally rendered 9:16 story. It never
 * changes the student's score and does not need a server or music download.
 * Bundled fonts, the QR code and the optional synth beat stay on this device.
 */

import { clamp, easeOut, truncate } from "./util.js?v=19";
import { startEditBeat } from "./edit-audio.js?v=19";
import { qrcode } from "../vendor/qr/qrcode.js?v=19";

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT = '"Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif';
const frameCache = new WeakMap();
export const EDIT_DURATION = 8000;
export const PROJECT_LINK = "https://zero-vast.vercel.app/";

// Generated once, locally. The four-module quiet zone is drawn around it.
const projectQR = qrcode(0, "M");
projectQR.addData(PROJECT_LINK);
projectQR.make();

export const EDIT_STYLES = Object.freeze({
  nezaad: { label: "Nezaad", description: "Sharp & monochrome", bg: "#080808", glow: "#303030", accent: "#ffffff", second: "#aaaaaa", ink: "#fafafa", muted: "#aaaaaa" },
  voltage: { label: "Voltage", description: "Electric & bold", bg: "#080a09", glow: "#344619", accent: "#d9ff55", second: "#c6a9ff", ink: "#f7f8f3", muted: "#a6aaa0" },
  pop: { label: "Pop", description: "Playful & bright", bg: "#100914", glow: "#4a1e45", accent: "#ff91c2", second: "#8be6ee", ink: "#fff8fc", muted: "#c4aebb" },
  mono: { label: "Mono", description: "Clean & classic", bg: "#080808", glow: "#343434", accent: "#ffffff", second: "#bdbdbd", ink: "#fafafa", muted: "#aaaaaa" },
});

/** Quiz percentages use a 0–100 scale, not the default 0–1 clamp. */
export function scorePercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(clamp(number, 0, 100)) : 0;
}

function numberText(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function text(ctx, value, x, y, { size = 32, weight = 600, color = "#fff", align = "left", alpha = 1, maxWidth } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if (maxWidth) ctx.fillText(String(value), x, y, maxWidth);
  else ctx.fillText(String(value), x, y);
  ctx.restore();
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function star(ctx, x, y, radius, color, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 4;
    const r = i % 2 ? radius * 0.28 : radius;
    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function badge(ctx, x, y, width, label, palette, { fill = false } = {}) {
  roundRect(ctx, x, y, width, 62, 31);
  ctx.fillStyle = fill ? palette.accent : "rgba(255,255,255,0.045)";
  ctx.fill();
  ctx.strokeStyle = fill ? palette.accent : "rgba(255,255,255,0.23)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, x + width / 2, y + 40, { size: 20, weight: 800, color: fill ? palette.bg : palette.ink, align: "center", maxWidth: width - 28 });
}

function backdrop(ctx, palette, time, reducedMotion) {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(540, 720, 30, 540, 720, 900);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, palette.bg);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;

  // Restrained texture rather than rapid flashes: safe and inexpensive on phones.
  ctx.save();
  ctx.globalAlpha = 0.08;
  const shift = reducedMotion ? 0 : time * 110;
  for (let x = -500; x < WIDTH + 900; x += 140) {
    line(ctx, x + shift, 0, x + shift - 650, HEIGHT, palette.ink, 2);
  }
  for (let i = 0; i < 32; i += 1) {
    const x = 35 + ((i * 233) % 1010);
    const y = 120 + ((i * 397) % 1670);
    ctx.fillStyle = i % 3 === 0 ? palette.accent : palette.ink;
    ctx.fillRect(x, y, i % 4 === 0 ? 5 : 3, i % 4 === 0 ? 5 : 3);
  }
  ctx.restore();
}

function topLine(ctx, palette, page) {
  star(ctx, 91, 167, 16, palette.accent, Math.PI / 4);
  text(ctx, "VIGNAN AI", 126, 177, { size: 27, weight: 850, color: palette.ink });
  text(ctx, "INSPIRE / MANAK", 990, 177, { size: 19, weight: 750, color: palette.muted, align: "right" });
  line(ctx, 78, 208, 1002, 208, "rgba(255,255,255,0.2)", 2);
  text(ctx, page, 1001, 250, { size: 18, weight: 700, color: palette.muted, align: "right" });
}

function introScene(ctx, palette, time) {
  const entrance = easeOut(clamp(time / 0.12));
  ctx.save();
  ctx.translate(0, (1 - entrance) * 95);
  badge(ctx, 80, 295, 292, "A LITTLE CELEBRATION", palette);
  text(ctx, "YOU", 72, 620, { size: 232, weight: 900, color: palette.ink, maxWidth: 900 });
  text(ctx, "DID", 72, 858, { size: 232, weight: 900, color: palette.ink, maxWidth: 900 });
  text(ctx, "THAT.", 72, 1096, { size: 232, weight: 900, color: palette.accent, maxWidth: 930 });
  line(ctx, 80, 1160, 995, 1160, "rgba(255,255,255,0.24)", 2);
  text(ctx, "ONE QUIZ. ONE MORE STEP FORWARD.", 82, 1244, { size: 27, weight: 750, color: palette.ink, maxWidth: 820 });
  text(ctx, "Your result is coming up", 82, 1300, { size: 31, weight: 500, color: palette.muted });
  star(ctx, 880, 1320, 72, palette.second, time * 1.2);
  badge(ctx, 80, 1580, 315, "MADE BY YOU", palette, { fill: true });
  text(ctx, "KEEP LEARNING. KEEP GROWING.", 82, 1745, { size: 22, weight: 750, color: palette.muted });
  ctx.restore();
}

function orbit(ctx, palette, percent, time, { cx = 540, cy = 838, radius = 272, reducedMotion = false } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 37, 0, Math.PI * 2);
  ctx.setLineDash([5, 18]);
  ctx.lineDashOffset = reducedMotion ? 0 : -time * 110;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 24;
  ctx.stroke();
  if (percent > 0) {
    const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    gradient.addColorStop(0, palette.accent);
    gradient.addColorStop(1, palette.second);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * percent / 100);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 24;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
  star(ctx, cx - radius - 70, cy - 88, 25, palette.second, reducedMotion ? 0 : time * 2);
  star(ctx, cx + radius + 65, cy + 130, 33, palette.accent, reducedMotion ? 0 : -time * 2);
}

function revealScene(ctx, palette, result, time) {
  const percent = scorePercent(result.percent);
  const counted = Math.round(percent * easeOut(clamp((time - 0.18) / 0.24)));
  badge(ctx, 80, 300, 284, "THE RESULT IS IN", palette, { fill: true });
  text(ctx, "LOOK AT", 80, 470, { size: 113, weight: 900, color: palette.ink });
  text(ctx, "YOU GO.", 80, 586, { size: 113, weight: 900, color: palette.accent });
  orbit(ctx, palette, counted, time, { cy: 960, radius: 275 });
  text(ctx, `${counted}%`, 540, 1014, { size: counted === 100 ? 176 : 205, weight: 900, color: palette.ink, align: "center", maxWidth: 495 });
  text(ctx, "YOUR QUIZ SCORE", 540, 1083, { size: 24, weight: 800, color: palette.accent, align: "center" });
  text(ctx, `${numberText(result.score)} / ${numberText(result.total)} POINTS`, 540, 1340, { size: 37, weight: 850, color: palette.ink, align: "center" });
  text(ctx, truncate(result.topic || "Chapter quiz", 50), 540, 1410, { size: 29, weight: 600, color: palette.muted, align: "center", maxWidth: 830 });
  badge(ctx, 338, 1560, 404, "PROGRESS LOOKS GOOD ON YOU", palette);
  text(ctx, "VIGNAN VIDYANIKETHAN AI", 540, 1745, { size: 22, weight: 750, color: palette.muted, align: "center" });
}

function stat(ctx, x, y, label, value, palette) {
  roundRect(ctx, x, y, 288, 134, 24);
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, x + 22, y + 39, { size: 18, weight: 800, color: palette.muted, maxWidth: 245 });
  text(ctx, value, x + 22, y + 100, { size: 45, weight: 850, color: palette.ink, maxWidth: 245 });
}

function drawProjectQR(ctx, palette) {
  const count = projectQR.getModuleCount();
  const moduleSize = 5;
  const quiet = 4;
  const x = 800;
  const y = 265;
  const size = (count + quiet * 2) * moduleSize;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (projectQR.isDark(row, column)) ctx.fillRect(x + (column + quiet) * moduleSize, y + (row + quiet) * moduleSize, moduleSize, moduleSize);
    }
  }
  text(ctx, "SCAN FOR ZERO VAST", x + size / 2, y + size + 25, { size: 14, weight: 800, color: palette.ink, align: "center", maxWidth: size });
}

function drawBrand(ctx, palette, image) {
  if (image?.complete && image.naturalWidth && "filter" in ctx) {
    try {
      ctx.save();
      ctx.filter = "invert(1)"; // The supplied logo is black on transparent.
      ctx.drawImage(image, 80, 1793, 185, 185 * image.naturalHeight / image.naturalWidth);
      ctx.restore();
      return;
    } catch { ctx.restore(); /* Text fallback below. */ }
  }
  text(ctx, "NEZAAD INDUSTRIES", 80, 1822, { size: 22, weight: 800, color: palette.ink });
}

function finalScene(ctx, palette, result, progress, share, options, time) {
  const percent = scorePercent(result.percent);
  badge(ctx, 80, 260, 260, "QUIZ COMPLETE", palette, { fill: true });
  if (options.includeLink !== false) drawProjectQR(ctx, palette);
  text(ctx, "GOOD", 74, 438, { size: 123, weight: 900, color: palette.ink });
  text(ctx, "STUFF.", 74, 558, { size: 123, weight: 900, color: palette.accent });
  text(ctx, truncate(result.topic || "Chapter quiz", 52), 84, 618, { size: 31, weight: 600, color: palette.muted, maxWidth: 850 });

  orbit(ctx, palette, percent, time, { cy: 887, radius: 225, reducedMotion: options.reducedMotion });
  text(ctx, `${percent}%`, 540, 928, { size: percent === 100 ? 145 : 165, weight: 900, color: palette.ink, align: "center", maxWidth: 375 });
  text(ctx, "YOUR SCORE", 540, 984, { size: 21, weight: 800, color: palette.accent, align: "center" });
  const encouragement = percent >= 90 ? "WHAT A RUN" : percent >= 75 ? "NICE WORK" : percent >= 50 ? "LEVELING UP" : "KEEP GOING";
  badge(ctx, 390, 1097, 300, encouragement, palette);

  stat(ctx, 78, 1195, "POINTS", `${numberText(result.score)} / ${numberText(result.total)}`, palette);
  stat(ctx, 396, 1195, "XP EARNED", `+${numberText(result.xp)}`, palette);
  stat(ctx, 714, 1195, "DAY STREAK", numberText(progress.current), palette);

  const questions = Array.isArray(result.perQuestion) ? result.perQuestion.slice(0, 10) : [];
  text(ctx, "YOUR QUIZ RUN", 80, 1407, { size: 21, weight: 800, color: palette.ink });
  text(ctx, `${numberText(result.total)} QUESTIONS`, 1000, 1407, { size: 19, weight: 750, color: palette.muted, align: "right" });
  questions.forEach((item, index) => {
    const x = 80 + index * 92;
    roundRect(ctx, x, 1436, 76, 20, 10);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    const value = clamp(Number(item.awarded) || 0, 0, 1);
    if (value > 0) {
      roundRect(ctx, x, 1436, 76 * value, 20, 10);
      ctx.fillStyle = value < 1 ? palette.second : palette.accent;
      ctx.fill();
    }
  });
  if (!questions.length) text(ctx, "EVERY QUIZ IS A STEP FORWARD", 80, 1461, { size: 20, weight: 700, color: palette.muted });

  const next = result.reviseList?.[0];
  roundRect(ctx, 78, 1511, 924, 90, 23);
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.fill();
  text(ctx, next ? "NEXT UP" : "NEXT UP", 102, 1547, { size: 17, weight: 850, color: palette.accent });
  text(ctx, next ? truncate(next.topic || "Review your textbook", 48) : "Keep the momentum going", 102, 1581, { size: 25, weight: 750, color: palette.ink, maxWidth: 850 });

  const name = options.includeName ? truncate(String(share.username || "Student").replace(/^@/, ""), 24) : "";
  const invite = options.includeInvite ? truncate(share.refCode || "", 32) : "";
  line(ctx, 80, 1650, 1000, 1650, "rgba(255,255,255,0.2)", 2);
  text(ctx, name ? `MADE BY @${name}` : "MADE WITH VIGNAN AI", 80, 1708, { size: 22, weight: 800, color: palette.ink, maxWidth: 650 });
  text(ctx, "STUDY • PRACTISE • REPEAT", 80, 1750, { size: 19, weight: 700, color: palette.muted });
  if (invite) text(ctx, `JOIN MY SQUAD: ${invite}`, 1000, 1750, { size: 18, weight: 800, color: palette.accent, align: "right", maxWidth: 440 });
  drawBrand(ctx, palette, options.brandImage);
  text(ctx, "STUDENT PROJECT / INSPIRE MANAK", 1000, 1822, { size: 17, weight: 750, color: palette.muted, align: "right", maxWidth: 570 });
  star(ctx, 963, 1696, 24, palette.accent, Math.PI / 4);
}

// Cache the textured backdrop and static scenes per canvas. This avoids
// re-rasterising large gradients and text 24 times a second on mobile devices.
function cachedLayers(canvas, { width, height, palette, result, progress, share, options }) {
  const createLayer = () => {
    if (typeof globalThis.OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
    if (globalThis.document?.createElement) {
      const layer = document.createElement("canvas");
      layer.width = width;
      layer.height = height;
      return layer;
    }
    return null;
  };
  const key = JSON.stringify([
    width, options.style, result.percent, result.score, result.total, result.xp, result.topic,
    (result.perQuestion || []).slice(0, 10).map((item) => item.awarded), result.reviseList?.[0]?.topic,
    progress.current, options.includeName, options.includeInvite, options.includeLink !== false, share.username, share.refCode,
    Boolean(options.brandImage?.complete && options.brandImage?.naturalWidth),
    globalThis.document?.fonts?.check?.('700 32px "Space Grotesk"') ?? false,
  ]);
  const previous = frameCache.get(canvas);
  if (previous?.key === key) return previous;
  try {
    function layer(draw) {
      const image = createLayer();
      if (!image) return null;
      const context = image.getContext("2d");
      if (!context) return null;
      context.scale(width / WIDTH, height / HEIGHT);
      draw(context);
      return image;
    }
    const background = layer((context) => backdrop(context, palette, 0, true));
    const intro = layer((context) => { topLine(context, palette, "01 / 03"); introScene(context, palette, 1); });
    const final = layer((context) => {
      topLine(context, palette, "03 / 03");
      finalScene(context, palette, result, progress, share, { ...options, reducedMotion: true }, 1);
    });
    if (!background || !intro || !final) return null;
    const cached = { key, background, intro, final };
    frameCache.set(canvas, cached);
    return cached;
  } catch {
    // Offscreen canvases may be unavailable or memory-constrained. Direct
    // rendering remains fully functional, just a little more expensive.
    return null;
  }
}

/** Draw a frame. animation is linear 0–1; reduced motion displays the final card. */
export function drawPerformanceCard(canvas, options = {}) {
  if (!canvas) throw new Error("A canvas is required to draw the edit video frame.");
  const { result = {}, progress = {}, profile = "Student", account = null, share = {}, animation = 1, renderWidth = WIDTH, reducedMotion = false } = options;
  const palette = EDIT_STYLES[options.style] || EDIT_STYLES.nezaad;
  const width = Math.round(clamp(Number(renderWidth) || WIDTH, 270, WIDTH));
  const height = Math.round(width * HEIGHT / WIDTH);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  const time = reducedMotion ? 1 : clamp(Number.isFinite(Number(animation)) ? Number(animation) : 1);
  const effectiveShare = { ...share, username: share.username || account?.username || profile };
  const layers = cachedLayers(canvas, { width, height, palette, result, progress, share: effectiveShare, options });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(width / WIDTH, height / HEIGHT);
  if (layers) ctx.drawImage(layers.background, 0, 0, WIDTH, HEIGHT);
  else backdrop(ctx, palette, time, reducedMotion);

  if (time < 0.20) {
    ctx.save();
    ctx.globalAlpha *= 1 - clamp((time - 0.14) / 0.06);
    if (layers) {
      ctx.translate(0, (1 - easeOut(clamp(time / 0.12))) * 95);
      ctx.drawImage(layers.intro, 0, 0, WIDTH, HEIGHT);
    } else {
      topLine(ctx, palette, "01 / 03");
      introScene(ctx, palette, time);
    }
    ctx.restore();
  }
  if (time >= 0.14 && time < 0.54) {
    ctx.save();
    ctx.globalAlpha *= clamp((time - 0.14) / 0.06) * (1 - clamp((time - 0.48) / 0.06));
    topLine(ctx, palette, "02 / 03");
    revealScene(ctx, palette, result, time);
    ctx.restore();
  }
  if (time >= 0.48) {
    ctx.save();
    ctx.globalAlpha *= clamp((time - 0.48) / 0.06);
    if (layers) ctx.drawImage(layers.final, 0, 0, WIDTH, HEIGHT);
    else {
      topLine(ctx, palette, "03 / 03");
      finalScene(ctx, palette, result, progress, effectiveShare, options, time);
    }
    ctx.restore();
  }
  if (!reducedMotion) {
    // Gentle beat-synced accents add movement without rapid full-screen flashes.
    ctx.save();
    ctx.globalAlpha = 0.8;
    const pulse = 1 + 0.12 * Math.sin(time * Math.PI * 32);
    star(ctx, 965, 670, 24 * pulse, palette.second, time * 4);
    star(ctx, 133, 1120, 14 * pulse, palette.accent, -time * 3);
    // A subtle timeline makes the three scenes feel like one continuous edit.
    ctx.fillStyle = palette.accent;
    ctx.fillRect(78, 207, 924 * time, 4);
    ctx.restore();
  }
  ctx.restore();
  return canvas;
}

export function videoMimeCandidates({ withAudio = false } = {}) {
  if (!globalThis.MediaRecorder?.isTypeSupported) return [""];
  // Prefer a broadly shareable H.264/AAC MP4. A generic MP4 on some Chrome
  // builds contains VP9/Opus, which many social apps cannot play; prefer the
  // faster VP8 WebM before that ambiguous container if H.264/AAC isn't offered.
  const candidates = withAudio
    ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"]
    : ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.42E01E", "video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm", "video/mp4"];
  return candidates.filter((mime) => globalThis.MediaRecorder.isTypeSupported(mime));
}

export function preferredVideoMime() {
  return videoMimeCandidates()[0] || "";
}

export function videoExtension(mime = "") {
  return /mp4/i.test(mime) ? "mp4" : "webm";
}

function cancelledError(message = "Recording cancelled.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function waitForAudio(beat, signal) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(ready);
    };
    const onAbort = () => finish(false);
    if (signal?.aborted) { finish(false); return; }
    signal?.addEventListener("abort", onAbort, { once: true });
    // A suspended mobile audio context should never leave the studio stuck.
    timer = setTimeout(() => finish(false), 1500);
    Promise.resolve(beat.ready).then((ready) => finish(Boolean(ready)), () => finish(false));
  });
}

function recordOnce({ canvas, frameOptions, duration, onProgress, signal, beat, excludedMimes = new Set() }) {
  return new Promise((resolve, reject) => {
    let stream;
    let videoTrack;
    let manualFrames = false;
    try {
      // Set the output dimensions before capture; resizing an active canvas
      // track can produce missing frames or an incomplete video on mobile.
      drawPerformanceCard(canvas, { ...frameOptions, animation: 0 });
      try { stream = canvas.captureStream?.(0); } catch { stream = null; }
      videoTrack = stream?.getVideoTracks?.()[0];
      manualFrames = typeof videoTrack?.requestFrame === "function";
      if (!manualFrames) {
        stream?.getTracks().forEach((track) => track.stop());
        stream = canvas.captureStream?.(24);
        videoTrack = stream?.getVideoTracks?.()[0];
      }
    } catch { /* handled below */ }
    if (!stream || !videoTrack) { reject(new Error("This browser cannot record a canvas. Download the PNG poster instead.")); return; }
    const audioTrack = beat?.stream?.getAudioTracks?.()[0];
    if (audioTrack) {
      try { stream.addTrack(audioTrack); } catch { /* record silently if adding audio is unsupported */ }
    }
    const hasAudio = Boolean(audioTrack && stream.getAudioTracks?.().includes(audioTrack));
    let audible = hasAudio;
    const supported = videoMimeCandidates({ withAudio: hasAudio });
    const candidates = (supported.length ? supported : [""]).filter((mime) => !excludedMimes.has(mime));
    let recorder;
    let selectedMime = "";
    let lastError;
    for (const mime of candidates) {
      try {
        const config = { videoBitsPerSecond: frameOptions.renderWidth >= 1080 ? 5_000_000 : 3_000_000 };
        if (mime) config.mimeType = mime;
        recorder = new MediaRecorder(stream, config);
        selectedMime = mime;
        break;
      } catch (error) { lastError = error; }
    }
    if (!recorder) {
      stream.getTracks().forEach((track) => track.stop());
      const error = new Error(lastError?.message || "This browser cannot create a video. Download the PNG poster instead.");
      error.canRetryFormat = true;
      error.noMoreFormats = true;
      reject(error);
      return;
    }

    const chunks = [];
    let settled = false;
    let frameId = 0;
    let finishTimer = 0;
    const cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId);
      clearTimeout(finishTimer);
      signal?.removeEventListener("abort", onAbort);
      globalThis.document?.removeEventListener("visibilitychange", onVisibility);
      stream.getTracks().forEach((track) => track.stop());
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* already stopped */ }
      cleanup();
      reject(error);
    };
    const retryable = (cause) => {
      const error = new Error(cause?.message || "Video recording failed.");
      error.recordingMime = selectedMime;
      error.canRetryFormat = true;
      return error;
    };
    const onAbort = () => fail(cancelledError());
    const onVisibility = () => { if (globalThis.document?.hidden) fail(cancelledError("Keep this tab open while the edit is being recorded.")); };
    signal?.addEventListener("abort", onAbort, { once: true });
    globalThis.document?.addEventListener("visibilitychange", onVisibility);
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = (event) => fail(retryable(event.error));
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const mime = recorder.mimeType || chunks[0]?.type || "video/webm";
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size) { reject(retryable(new Error("The browser produced an empty video."))); return; }
      resolve({ blob, mime, hasAudio: audible });
    };
    if (signal?.aborted) { onAbort(); return; }
    try {
      recorder.start(250);
      if (hasAudio) {
        try { beat?.start(); } catch { audible = false; }
      }
      if (manualFrames) videoTrack.requestFrame();
      const started = performance.now();
      let lastDraw = 0;
      const frame = (now) => {
        if (settled) return;
        try {
          const linear = clamp((now - started) / duration);
          // Cap drawing at 24 fps so recording stays usable on phones.
          if (now - lastDraw >= 1000 / 24 || linear === 1) {
            drawPerformanceCard(canvas, { ...frameOptions, animation: linear });
            if (manualFrames) videoTrack.requestFrame();
            onProgress?.(linear);
            lastDraw = now;
          }
          if (linear < 1) frameId = requestAnimationFrame(frame);
          else finishTimer = setTimeout(() => {
            if (!settled && recorder.state !== "inactive") {
              if (manualFrames) videoTrack.requestFrame();
              recorder.stop();
            }
          }, 400);
        } catch (error) { fail(error); }
      };
      frameId = requestAnimationFrame(frame);
    } catch (error) { fail(retryable(error)); }
  });
}

/** Record in real time. Sound is optional; unsupported audio falls back to silence. */
export async function createPerformanceVideo({ canvas, result, progress, profile, account, share, style = "nezaad", includeName = false, includeInvite = false, includeLink = true, brandImage = null, reducedMotion = false, renderWidth = 720, music = true, duration = EDIT_DURATION, onProgress = () => {}, onRetry = () => {}, signal } = {}) {
  if (!globalThis.MediaRecorder || !canvas?.captureStream) {
    throw new Error("Video recording is not supported here. Download the PNG poster instead.");
  }
  if (signal?.aborted) throw cancelledError();
  const length = clamp(Number(duration) || EDIT_DURATION, 200, 30000);
  // This is intentionally created before the first await, directly from a tap.
  let beat = music ? startEditBeat({ duration: length, record: true, defer: true }) : null;
  let audioPhase = Boolean(beat);
  let attempts = 0;
  const excludedMimes = new Set();
  try {
    while (true) {
      if (beat && !await waitForAudio(beat, signal)) {
        beat.stop();
        beat = null;
        if (signal?.aborted) throw cancelledError();
        audioPhase = false;
        attempts = 0;
        excludedMimes.clear();
        onRetry({ silent: true });
      }
      if (signal?.aborted) throw cancelledError();
      try {
        const recorded = await recordOnce({
          canvas, duration: length, onProgress, signal, beat, excludedMimes,
          frameOptions: { result, progress, profile, account, share, style, includeName, includeInvite, includeLink, brandImage, reducedMotion, renderWidth },
        });
        const extension = videoExtension(recorded.mime);
        return { ...recorded, extension, filename: `vignan-ai-edit-${new Date().toISOString().slice(0, 10)}.${extension}` };
      } catch (error) {
        if (!error.canRetryFormat || signal?.aborted) throw error;
        excludedMimes.add(error.recordingMime);
        attempts += 1;
        if (error.noMoreFormats || attempts >= 3) {
          if (!audioPhase) throw error;
          // Some browsers can record video but cannot encode any audio track.
          // Retry video-only rather than leaving the student without an edit.
          beat?.stop();
          beat = null;
          audioPhase = false;
          attempts = 0;
          excludedMimes.clear();
          onRetry({ silent: true });
          continue;
        }
        onRetry({ silent: false });
        beat?.stop();
        // A second audio context might be blocked after the original tap.
        beat = audioPhase ? startEditBeat({ duration: length, record: true, defer: true }) : null;
        if (audioPhase && !beat) {
          audioPhase = false;
          attempts = 0;
          excludedMimes.clear();
          onRetry({ silent: true });
        }
      }
    }
  } finally {
    beat?.stop();
  }
}

export function createPoster(canvas, options = {}) {
  drawPerformanceCard(canvas, { ...options, renderWidth: WIDTH, animation: 1 });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create PNG poster."))), "image/png");
  });
}
