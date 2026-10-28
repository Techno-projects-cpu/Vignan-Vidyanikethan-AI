import test from "node:test";
import assert from "node:assert/strict";
import {
  EDIT_STYLES,
  createPerformanceVideo,
  createPoster,
  drawPerformanceCard,
  preferredVideoMime,
  scorePercent,
  videoExtension,
  videoMimeCandidates,
} from "../js/card.js";
import { canCreateEditBeat, startEditBeat } from "../js/edit-audio.js";

function fakeCanvas() {
  const gradient = { addColorStop() {} };
  const drawnText = [];
  const base = {
    globalAlpha: 1,
    fillText: (value) => drawnText.push(String(value)),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (text) => ({ width: String(text).length * 10 }),
  };
  const context = new Proxy(base, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
  return {
    width: 0,
    height: 0,
    drawnText,
    getContext: () => context,
    toBlob(callback, type) {
      callback(new Blob(["fake-png"], { type }));
    },
  };
}

const result = {
  topic: "Photosynthesis",
  percent: 80,
  score: 4,
  total: 5,
  xp: 44,
  perQuestion: [
    { awarded: 1, status: "correct" },
    { awarded: 0.5, status: "partial" },
    { awarded: 0, status: "wrong" },
    { awarded: 1, status: "correct" },
  ],
  reviseList: [{ topic: "Stomata", answer: "Guard cells" }],
};

test("drawPerformanceCard renders a 1080x1920 story frame", () => {
  const canvas = fakeCanvas();
  drawPerformanceCard(canvas, {
    result,
    progress: { current: 3 },
    profile: "Ananya",
    account: { username: "ananya" },
    share: { refCode: "VIGNAN-ANANYA", username: "ananya" },
    animation: 0,
  });
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1920);
  drawPerformanceCard(canvas, { result, animation: 1 });
  assert.equal(canvas.width, 1080);
});

test("createPoster resolves a PNG blob", async () => {
  const canvas = fakeCanvas();
  const blob = await createPoster(canvas, {
    result,
    progress: { current: 3 },
    profile: "Ananya",
    share: { refCode: "VIGNAN-ANANYA" },
  });
  assert.equal(blob.type, "image/png");
  assert.ok(blob.size > 0);
});

test("video format helpers are honest about browser support", () => {
  assert.equal(videoExtension("video/mp4;codecs=avc1.42E01E"), "mp4");
  assert.equal(videoExtension("video/webm;codecs=vp9"), "webm");
  if (!globalThis.MediaRecorder) {
    assert.deepEqual(videoMimeCandidates(), [""]);
    assert.equal(preferredVideoMime(), "");
  }
});

test("edit scores remain accurate on a 0–100 scale, including zero and perfect scores", () => {
  assert.equal(scorePercent(0), 0);
  assert.equal(scorePercent(40), 40);
  assert.equal(scorePercent(87), 87);
  assert.equal(scorePercent(100), 100);
  assert.equal(scorePercent(150), 100);
  assert.equal(scorePercent(-4), 0);
  assert.equal(scorePercent("not a score"), 0);
  for (const percent of [0, 40, 80, 100]) {
    const canvas = fakeCanvas();
    drawPerformanceCard(canvas, { result: { ...result, percent }, animation: 1 });
    assert.ok(canvas.drawnText.includes(`${percent}%`), `the card shows ${percent}%`);
  }
});

test("the edit has distinct intro, score reveal and final scenes, plus calm motion", () => {
  const intro = fakeCanvas();
  drawPerformanceCard(intro, { result, animation: 0.08 });
  assert.ok(intro.drawnText.includes("YOU"));
  assert.ok(intro.drawnText.includes("THAT."));
  const reveal = fakeCanvas();
  drawPerformanceCard(reveal, { result, animation: 0.5 });
  assert.ok(reveal.drawnText.includes("80%"));
  assert.ok(reveal.drawnText.includes("4 / 5 POINTS"));
  const final = fakeCanvas();
  drawPerformanceCard(final, { result, animation: 1, renderWidth: 720 });
  assert.ok(final.drawnText.includes("GOOD"));
  assert.ok(final.drawnText.includes("80%"));
  assert.equal(final.width, 720);
  assert.equal(final.height, 1280);
  const calm = fakeCanvas();
  drawPerformanceCard(calm, { result, animation: 0, reducedMotion: true });
  assert.ok(calm.drawnText.includes("80%"));
  assert.ok(!calm.drawnText.includes("YOU"));
  assert.deepEqual(Object.keys(EDIT_STYLES), ["voltage", "pop", "mono"]);
});

test("student nickname and invite code only appear after explicit opt-in", () => {
  const share = { username: "ananya", refCode: "VIGNAN-ANANYA" };
  const privateFrame = fakeCanvas();
  drawPerformanceCard(privateFrame, { result, share, animation: 1 });
  assert.ok(!privateFrame.drawnText.some((item) => /ananya/i.test(item)));
  const publicFrame = fakeCanvas();
  drawPerformanceCard(publicFrame, { result, share, includeName: true, includeInvite: true, animation: 1 });
  assert.ok(publicFrame.drawnText.includes("MADE BY @ananya"));
  assert.ok(publicFrame.drawnText.includes("JOIN MY SQUAD: VIGNAN-ANANYA"));
});

test("format selection prefers compatible MP4, otherwise VP8/Opus WebM", () => {
  const original = globalThis.MediaRecorder;
  try {
    globalThis.MediaRecorder = class {
      static isTypeSupported(type) { return ["video/mp4", "video/webm;codecs=vp8,opus"].includes(type); }
    };
    assert.equal(videoMimeCandidates({ withAudio: true })[0], "video/webm;codecs=vp8,opus");
    globalThis.MediaRecorder = class {
      static isTypeSupported(type) { return ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp8,opus"].includes(type); }
    };
    assert.equal(videoMimeCandidates({ withAudio: true })[0], "video/mp4;codecs=avc1.42E01E,mp4a.40.2");
  } finally { globalThis.MediaRecorder = original; }
});

test("the optional original beat uses local Web Audio and cleans up", async () => {
  const original = globalThis.AudioContext;
  let stopped = 0;
  let closed = 0;
  let oscillators = 0;
  const track = { stop() { stopped += 1; } };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const node = () => ({ gain: { ...param, value: 0 }, frequency: { ...param, value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {} });
  class FakeAudioContext {
    constructor() { this.state = "suspended"; this.sampleRate = 8000; this.currentTime = 0; this.destination = node(); }
    createMediaStreamDestination() { return { stream }; }
    createGain() { return node(); }
    createOscillator() { oscillators += 1; return node(); }
    createBufferSource() { return node(); }
    createBiquadFilter() { return node(); }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { closed += 1; return Promise.resolve(); }
  }
  try {
    globalThis.AudioContext = FakeAudioContext;
    assert.equal(canCreateEditBeat(), true);
    const beat = startEditBeat({ duration: 1200, record: true });
    assert.ok(beat);
    assert.equal(await beat.ready, true);
    assert.equal(beat.stream, stream);
    assert.ok(oscillators > 0);
    beat.stop();
    beat.stop();
    assert.equal(stopped, 1);
    assert.equal(closed, 1);
  } finally { globalThis.AudioContext = original; }
});

test("recording sizes the canvas before capturing and releases its tracks", async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldRaf = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  let stopped = false;
  let requested = 0;
  const videoTrack = { stop() { stopped = true; }, requestFrame() { requested += 1; } };
  const stream = { getTracks: () => [videoTrack], getVideoTracks: () => [videoTrack], getAudioTracks: () => [], addTrack() {} };
  class Recorder {
    static isTypeSupported(type) { return type === "video/mp4;codecs=avc1.640028"; }
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = "inactive"; }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["video"]) }); this.onstop?.(); });
    }
  }
  const canvas = fakeCanvas();
  canvas.captureStream = () => { assert.equal(canvas.width, 720); assert.equal(canvas.height, 1280); return stream; };
  try {
    globalThis.MediaRecorder = Recorder;
    globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 8);
    globalThis.cancelAnimationFrame = clearTimeout;
    let latest = 0;
    const video = await createPerformanceVideo({ canvas, result, music: false, duration: 200, onProgress: (value) => { latest = value; } });
    assert.equal(video.extension, "mp4");
    assert.equal(video.hasAudio, false);
    assert.ok(video.blob.size);
    assert.equal(latest, 1);
    assert.ok(requested > 1);
    assert.equal(stopped, true);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});

test("closing a recording aborts it and releases the stream", async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldRaf = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  let stopped = false;
  const track = { stop() { stopped = true; }, requestFrame() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [], addTrack() {} };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.state = "inactive"; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; }
  }
  const canvas = fakeCanvas();
  canvas.captureStream = () => stream;
  try {
    globalThis.MediaRecorder = Recorder;
    globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 8);
    globalThis.cancelAnimationFrame = clearTimeout;
    const controller = new AbortController();
    const promise = createPerformanceVideo({ canvas, result, music: false, duration: 1000, signal: controller.signal });
    setTimeout(() => controller.abort(), 25);
    await assert.rejects(promise, { name: "AbortError" });
    assert.equal(stopped, true);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});

test("recording retries another format if the preferred encoder fails at runtime", async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldRaf = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  const tracks = [];
  let retried = 0;
  class Recorder {
    static isTypeSupported(type) { return ["video/mp4;codecs=avc1.640028", "video/webm;codecs=vp8"].includes(type); }
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = "inactive"; }
    start() {
      this.state = "recording";
      if (this.mimeType.startsWith("video/mp4")) queueMicrotask(() => this.onerror?.({ error: new Error("encoder failed") }));
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["video"]) }); this.onstop?.(); });
    }
  }
  const canvas = fakeCanvas();
  canvas.captureStream = () => {
    const track = { stopped: false, stop() { this.stopped = true; }, requestFrame() {} };
    tracks.push(track);
    return { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [], addTrack() {} };
  };
  try {
    globalThis.MediaRecorder = Recorder;
    globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 8);
    globalThis.cancelAnimationFrame = clearTimeout;
    const video = await createPerformanceVideo({ canvas, result, music: false, duration: 200, onRetry: () => { retried += 1; } });
    assert.equal(video.extension, "webm");
    assert.equal(retried, 1);
    assert.equal(tracks.length, 2);
    assert.ok(tracks.every((track) => track.stopped));
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});

test("closing while mobile audio is suspended aborts without hanging", async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldAudio = globalThis.AudioContext;
  let closed = false;
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const node = () => ({ gain: { ...param, value: 0 }, frequency: { ...param, value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {} });
  class SuspendedAudio {
    constructor() { this.state = "suspended"; this.sampleRate = 8000; this.currentTime = 0; }
    createMediaStreamDestination() { const track = { stop() {} }; return { stream: { getAudioTracks: () => [track], getTracks: () => [track] } }; }
    createGain() { return node(); }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { return new Promise(() => {}); }
    close() { closed = true; return Promise.resolve(); }
  }
  const canvas = fakeCanvas();
  canvas.captureStream = () => { throw new Error("Should not capture after cancellation"); };
  try {
    globalThis.MediaRecorder = class {};
    globalThis.AudioContext = SuspendedAudio;
    const controller = new AbortController();
    const recording = createPerformanceVideo({ canvas, result, music: true, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(recording, { name: "AbortError" });
    assert.equal(closed, true);
  } finally { globalThis.MediaRecorder = oldRecorder; globalThis.AudioContext = oldAudio; }
});

test("recording falls back to timed canvas capture if manual capture is unsupported", async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldRaf = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  const track = { stop() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [], addTrack() {} };
  const rates = [];
  const canvas = fakeCanvas();
  canvas.captureStream = (rate) => { rates.push(rate); if (rate === 0) throw new Error("unsupported rate"); return stream; };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = "inactive"; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["video"]) }); this.onstop?.(); }); }
  }
  try {
    globalThis.MediaRecorder = Recorder;
    globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 8);
    globalThis.cancelAnimationFrame = clearTimeout;
    await createPerformanceVideo({ canvas, result, duration: 200, music: false });
    assert.deepEqual(rates, [0, 24]);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});
