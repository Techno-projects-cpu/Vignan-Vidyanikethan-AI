/**
 * Shareable "funk edit" performance video: a 1080×1920 animated canvas.
 *
 * The card keeps the honest score, per-question bars, streak, XP and revise
 * list, but the motion is deliberately louder: neon cuts, beat pulses, glitch
 * type, confetti and a squad invite for students to flex their marks online.
 * MP4 is preferred; WebM and a PNG poster remain fallbacks.
 */

import { clamp, easeOut, formatDate, truncate } from "./util.js";

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const P = {
  dark: "#050714",
  dark2: "#0a0f24",
  text: "#f6faff",
  muted: "rgba(214,230,255,0.62)",
  cyan: "#3fe9ff",
  blue: "#4d8dff",
  pink: "#ff4fa3",
  violet: "#9b6bff",
  lime: "#c9ff4d",
  amber: "#ffd45e",
  red: "#ff5f78",
  green: "#4be2a5",
};

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function hsla(h, s, l, a = 1) {
  return `hsla(${Math.round(h)}, ${s}%, ${l}%, ${a})`;
}

function text(ctx, value, x, y, { size = 36, weight = 500, color = P.text, align = "left", alpha = 1, glow = 0, glowColor = null } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if (glow) {
    ctx.shadowColor = glowColor || color;
    ctx.shadowBlur = glow;
  }
  ctx.fillText(String(value), x, y);
  ctx.restore();
}

function glitchText(ctx, value, x, y, options = {}) {
  const { glitch = false, seed = 0, ...rest } = options;
  const offset = glitch ? 7 + Math.sin(seed * 3.1) * 5 : 0;
  if (offset) {
    text(ctx, value, x - offset, y, { ...rest, color: P.pink, alpha: 0.78, glow: 0 });
    text(ctx, value, x + offset, y, { ...rest, color: P.cyan, alpha: 0.78, glow: 0 });
  }
  text(ctx, value, x, y, rest);
}

function wrapText(ctx, value, x, y, maxWidth, lineHeight, maxLines = 3, options = {}) {
  const words = String(value || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    ctx.font = `${options.weight || 500} ${options.size || 36}px ${FONT}`;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.slice(0, maxLines).forEach((entry, index) => text(ctx, entry, x, y + index * lineHeight, options));
}

function background(ctx, anim) {
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, P.dark);
  base.addColorStop(0.55, P.dark2);
  base.addColorStop(1, "#04030b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  const shift = (anim * 520) % 130;
  for (let i = -16; i < 28; i += 1) {
    const x = i * 130 + shift;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + HEIGHT, HEIGHT);
    ctx.strokeStyle =
      i % 2 === 0 ? hsla(190 + anim * 90, 100, 62, 0.055) : hsla(310 - anim * 70, 100, 66, 0.05);
    ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
    ctx.stroke();
  }
  ctx.restore();

  const orbs = [
    { x: 140 + Math.sin(anim * 6) * 90, y: 300, r: 580, h: 190 + anim * 70, a: 0.28 },
    { x: 960 + Math.cos(anim * 5) * 80, y: 700, r: 620, h: 310 - anim * 50, a: 0.22 },
    { x: 540 + Math.sin(anim * 4 + 2) * 120, y: 1500, r: 700, h: 80 + anim * 60, a: 0.2 },
  ];
  for (const orb of orbs) {
    const glow = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
    glow.addColorStop(0, hsla(orb.h, 100, 60, orb.a));
    glow.addColorStop(1, hsla(orb.h, 100, 60, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let gx = 70; gx < WIDTH; gx += 95) {
    for (let gy = 90; gy < HEIGHT; gy += 95) {
      const pulse = 1 + Math.sin(anim * 12 + gx * 0.03 + gy * 0.02) * 0.35;
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = P.cyan;
      ctx.fill();
    }
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 260, WIDTH / 2, HEIGHT / 2, 1280);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function particles(ctx, anim) {
  const colors = [P.cyan, P.pink, P.violet, P.lime, P.amber, P.blue];
  ctx.save();
  for (let i = 0; i < 78; i += 1) {
    const seed = i * 12.9898;
    const x = (Math.sin(seed) * 0.5 + 0.5) * WIDTH;
    const speed = 0.35 + (i % 9) * 0.07;
    const y = ((Math.sin(seed * 1.7) * 0.5 + 0.5) * HEIGHT + anim * 2100 * speed) % (HEIGHT + 240) - 120;
    const size = 5 + (i % 7) * 2.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(anim * 7 + i * 0.7);
    ctx.globalAlpha = 0.28 + (i % 5) * 0.1;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-size / 2, -size / 2, size, size * 0.55);
    ctx.restore();
  }
  ctx.restore();
}

function header(ctx, anim, { profile = "Student", share = {}, result = {}, glitch = false }) {
  roundedRect(ctx, 66, 72, 430, 66, 33);
  ctx.fillStyle = "rgba(63,233,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(63,233,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(104, 105, 10, 0, Math.PI * 2);
  ctx.fillStyle = P.cyan;
  ctx.fill();
  text(ctx, "VIGNAN VIDYANIKETHAN AI", 130, 117, { size: 20, weight: 800, color: "#bdefff", glow: 12, glowColor: P.cyan });

  roundedRect(ctx, 820, 72, 194, 66, 33);
  ctx.fillStyle = "rgba(255,79,163,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,79,163,0.6)";
  ctx.stroke();
  glitchText(ctx, "EDIT MODE", 917, 117, {
    size: 23,
    weight: 800,
    color: "#ffd6ec",
    align: "center",
    glow: 14,
    glowColor: P.pink,
    glitch,
    seed: anim * 9,
  });

  glitchText(ctx, "MARKS UNLOCKED", 66, 250, {
    size: 82,
    weight: 850,
    color: P.text,
    glow: 22,
    glowColor: P.violet,
    glitch,
    seed: anim * 13,
  });
  text(ctx, "TEXTBOOK-GROUNDED · AI-ASSISTED · STUDENT-MADE", 70, 298, {
    size: 21,
    weight: 750,
    color: P.cyan,
  });

  wrapText(ctx, result.topic ? `Quiz: ${result.topic}` : "Chapter quiz", 70, 372, 930, 58, 2, {
    size: 52,
    weight: 800,
    color: P.text,
  });
  const handle = share.username || profile || "Student";
  text(ctx, `@${String(handle).replace(/^@/, "")} · Vignan Vidyanikethan E.M. School`, 70, 490, {
    size: 24,
    weight: 600,
    color: P.muted,
  });
  text(ctx, formatDate(new Date()), 1010, 490, { size: 22, weight: 650, color: P.muted, align: "right" });
}

function scoreSection(ctx, result, anim, { glitch = false } = {}) {
  const cx = WIDTH / 2;
  const cy = 800;
  const radius = 248;
  const percent = clamp(Number(result.percent) || 0);
  const shown = Math.round(percent * anim);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(anim * Math.PI * 2);
  ctx.beginPath();
  ctx.arc(0, 0, radius + 46, 0, Math.PI * 2);
  ctx.setLineDash([16, 24]);
  ctx.lineDashOffset = -anim * 260;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  const end = -Math.PI / 2 + Math.PI * 2 * (percent / 100) * anim;
  const arc = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  arc.addColorStop(0, P.cyan);
  arc.addColorStop(0.5, P.violet);
  arc.addColorStop(1, P.pink);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, end);
  ctx.strokeStyle = arc;
  ctx.stroke();

  glitchText(ctx, `${shown}%`, cx, cy + 46, {
    size: 168,
    weight: 850,
    color: P.text,
    align: "center",
    glow: 34,
    glowColor: P.cyan,
    glitch,
    seed: anim * 17,
  });
  text(ctx, "SCORE", cx, cy + 104, { size: 29, weight: 800, color: P.cyan, align: "center" });

  const grade = percent >= 90 ? "GOAT MODE 🐐" : percent >= 75 ? "BANGER 🔥" : percent >= 50 ? "SOLID RUN ⚡" : "GRIND MODE 💪";
  glitchText(ctx, grade, cx, cy + 172, {
    size: 38,
    weight: 850,
    color: percent >= 75 ? P.lime : P.amber,
    align: "center",
    glow: 18,
    glowColor: percent >= 75 ? P.lime : P.amber,
    glitch,
    seed: anim * 21,
  });

  const score = Number(result.score || 0);
  const fraction = `${score.toFixed(Number.isInteger(score) ? 0 : 1)} / ${result.total || 0}`;
  text(ctx, fraction, cx, cy + 250, { size: 38, weight: 800, align: "center" });
  text(ctx, "correct answers · every answer has a page citation", cx, cy + 288, {
    size: 21,
    weight: 600,
    color: P.muted,
    align: "center",
  });
}

function statChip(ctx, x, y, label, value, color, anim) {
  const pulse = 1 + Math.sin(anim * 12 + x) * 0.012;
  ctx.save();
  ctx.translate(x + 150, y + 62);
  ctx.scale(pulse, pulse);
  ctx.translate(-(x + 150), -(y + 62));
  roundedRect(ctx, x, y, 300, 124, 28);
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.78;
  ctx.stroke();
  ctx.restore();
  text(ctx, value, x + 28, y + 62, { size: 46, weight: 850, color, glow: 14, glowColor: color });
  text(ctx, label, x + 29, y + 97, { size: 21, weight: 700, color: P.muted });
}

function questionBars(ctx, result, anim) {
  text(ctx, "QUESTION-BY-QUESTION RUN", 70, 1248, { size: 23, weight: 800, color: P.cyan });
  const items = (result.perQuestion || []).slice(0, 8);
  const barWidth = 940;
  items.forEach((item, index) => {
    const y = 1290 + index * 52;
    roundedRect(ctx, 70, y, barWidth, 26, 13);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    const value = clamp(Number(item.awarded) || 0) * anim;
    const color = item.status === "correct" ? P.green : item.status === "partial" ? P.amber : P.red;
    const fill = ctx.createLinearGradient(70, y, 70 + barWidth, y);
    fill.addColorStop(0, color);
    fill.addColorStop(1, index % 2 ? P.violet : P.cyan);
    roundedRect(ctx, 70, y, Math.max(18, barWidth * value), 26, 13);
    ctx.fillStyle = fill;
    ctx.fill();
    text(ctx, `Q${index + 1}`, 1020, y + 21, { size: 19, weight: 750, color: P.muted, align: "right" });
  });
  if (!items.length) text(ctx, "Finish a quiz to fill this run.", 70, 1318, { size: 26, color: P.muted });
}

function footer(ctx, result, share, anim, { glitch = false } = {}) {
  const revise = result.reviseList?.[0];
  roundedRect(ctx, 70, 1580, 940, 80, 24);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = revise ? "rgba(255,212,94,0.45)" : "rgba(75,226,165,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(
    ctx,
    revise ? `REVISE NEXT: ${truncate(revise.topic || revise.answer || "Check the cited page", 50)}` : "ALL TOPICS REVISED — CLEAN RUN!",
    98,
    1630,
    { size: 24, weight: 800, color: revise ? P.amber : P.green },
  );

  glitchText(ctx, "FLEX YOUR MARKS", 70, 1736, {
    size: 58,
    weight: 850,
    color: P.text,
    glow: 24,
    glowColor: P.pink,
    glitch,
    seed: anim * 25,
  });

  const squad = share.refCode ? `JOIN MY SQUAD → ${share.refCode}` : "JOIN THE VIGNAN SQUAD → VIDYANIKETHAN AI";
  roundedRect(ctx, 70, 1766, 940, 64, 20);
  ctx.fillStyle = "rgba(63,233,255,0.1)";
  ctx.fill();
  ctx.strokeStyle = "rgba(63,233,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, truncate(squad, 60), 98, 1809, { size: 25, weight: 800, color: P.cyan });

  text(ctx, "#VignanVidyanikethanAI  #StudyStreak  #INSPIREMANAK  #LearnFromYourBooks", 70, 1872, {
    size: 20,
    weight: 700,
    color: P.muted,
  });
  text(ctx, "MADE BY STUDENTS · NO SUBSCRIPTION · OFFLINE FIRST", 1010, 1872, {
    size: 18,
    weight: 700,
    color: P.muted,
    align: "right",
  });
}

/** Draw one frame. `animation` is 0…1 and controls all motion. */
export function drawPerformanceCard(canvas, options = {}) {
  if (!canvas) throw new Error("A canvas is required to draw the edit video frame.");
  const {
    result = {},
    progress = {},
    profile = "Student",
    account = null,
    share = {},
    animation = 1,
  } = options;
  const anim = easeOut(clamp(animation));
  if (canvas.width !== WIDTH) canvas.width = WIDTH;
  if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const beat = Math.pow(Math.max(0, Math.sin(anim * Math.PI * 9)), 6);
  const zoom = 1 + beat * 0.018;
  const shakeX = Math.sin(anim * 91) > 0.94 ? 6 * (0.4 + beat) : 0;
  const shakeY = Math.cos(anim * 77) > 0.95 ? 4 * (0.4 + beat) : 0;
  const glitch = Math.sin(anim * 83) > 0.9 || beat > 0.88;
  const effectiveShare = { ...share, username: share.username || account?.username || profile };

  ctx.save();
  ctx.translate(WIDTH / 2 + shakeX, HEIGHT / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-WIDTH / 2, -HEIGHT / 2);
  background(ctx, anim);
  particles(ctx, anim);
  header(ctx, anim, { profile, share: effectiveShare, result, glitch });
  scoreSection(ctx, result, anim, { glitch });

  statChip(ctx, 70, 1124, "day streak", `${progress.current || 0} 🔥`, P.cyan, anim);
  statChip(ctx, 400, 1124, "XP earned", `+${result.xp || 0}`, P.lime, anim);
  statChip(ctx, 730, 1124, "accuracy", `${Number(result.percent) || 0}%`, P.pink, anim);

  questionBars(ctx, result, anim);
  footer(ctx, result, effectiveShare, anim, { glitch });
  ctx.restore();
  return canvas;
}

export function videoMimeCandidates() {
  if (!globalThis.MediaRecorder?.isTypeSupported) return [""];
  const candidates = [
    "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.filter((mime) => MediaRecorder.isTypeSupported(mime));
}

export function preferredVideoMime() {
  return videoMimeCandidates()[0] || "";
}

export function videoExtension(mime = "") {
  return /mp4/i.test(mime) ? "mp4" : "webm";
}

function recordOnce({ mime, canvas, result, progress, profile, account, share, duration, onProgress }) {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream?.(30);
    if (!stream) {
      reject(new Error("This browser cannot record a canvas."));
      return;
    }
    let recorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 }) : new MediaRecorder(stream);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      reject(error);
      return;
    }
    const chunks = [];
    let settled = false;
    const cleanup = () => stream.getTracks().forEach((track) => track.stop());
    const frameOptions = { result, progress, profile, account, share };
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(event.error || new Error("Video recording failed."));
    };
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const type = recorder.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        reject(new Error("The browser produced an empty video."));
        return;
      }
      resolve({ blob, mime: type });
    };

    drawPerformanceCard(canvas, { ...frameOptions, animation: 0 });
    recorder.start(250);
    const started = performance.now();
    const frame = (now) => {
      if (settled) return;
      const linear = clamp((now - started) / duration);
      drawPerformanceCard(canvas, { ...frameOptions, animation: linear });
      onProgress?.(linear);
      if (linear < 1) requestAnimationFrame(frame);
      else {
        drawPerformanceCard(canvas, { ...frameOptions, animation: 1 });
        setTimeout(() => {
          if (!settled && recorder.state !== "inactive") recorder.stop();
        }, 260);
      }
    };
    requestAnimationFrame(frame);
  });
}

/** Animate and record. Tries MP4 first, then WebM. */
export async function createPerformanceVideo({
  canvas,
  result,
  progress,
  profile,
  account,
  share,
  duration = 7200,
  onProgress = () => {},
} = {}) {
  if (!globalThis.MediaRecorder || !canvas?.captureStream) {
    throw new Error("Video recording is not supported here. Download the PNG poster instead.");
  }
  const candidates = videoMimeCandidates();
  let lastError = null;
  for (const mime of candidates.length ? candidates : [""]) {
    try {
      const recorded = await recordOnce({ mime, canvas, result, progress, profile, account, share, duration, onProgress });
      const extension = videoExtension(recorded.mime);
      return {
        ...recorded,
        extension,
        filename: `vignan-vidyanikethan-edit-${new Date().toISOString().slice(0, 10)}.${extension}`,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Video recording failed.");
}

export function createPoster(canvas, { result, progress, profile, account, share } = {}) {
  drawPerformanceCard(canvas, { result, progress, profile, account, share, animation: 1 });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create PNG card."))),
      "image/png",
      0.95,
    );
  });
}
