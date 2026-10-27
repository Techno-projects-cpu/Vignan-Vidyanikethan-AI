import test from "node:test";
import assert from "node:assert/strict";
import {
  createPoster,
  drawPerformanceCard,
  preferredVideoMime,
  videoExtension,
  videoMimeCandidates,
} from "../js/card.js";

function fakeCanvas() {
  const gradient = { addColorStop() {} };
  const base = {
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
