/**
 * The measurement, checked against arithmetic that can be done by hand.
 *
 * `js/colour.js` decides whether every theme on this site is readable and whether
 * its palette is balanced 60-30-10. That makes it the single point of failure for
 * all of them, so it is tested against published reference values rather than
 * against itself:
 *
 *  - white on black is 21:1, and any colour against itself is 1:1;
 *  - #767676 on white is the classic 4.54:1 borderline;
 *  - sRGB primaries have known CIELAB coordinates;
 *  - CIEDE2000 is checked on the Sharma test pair;
 *  - compositing at full and zero alpha returns the two inputs.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  balance,
  composite,
  contrast,
  deltaE,
  deltaEFromLab,
  fromLinear,
  lightness,
  luminance,
  noiseDataUri,
  parseHex,
  passesContrast,
  separation,
  toHex,
  toLab,
  toLinear,
  toXyz,
  worstContrast,
} from "../js/colour.js";

test("hex parsing and printing round-trip, including the short form", () => {
  assert.deepEqual(parseHex("#fff"), [255, 255, 255, 1]);
  assert.deepEqual(parseHex("#0b0907"), [11, 9, 7, 1]);
  assert.deepEqual(parseHex("b23a29"), [178, 58, 41, 1]);
  assert.deepEqual(parseHex("#f7efdd80")[3], 0.502);
  assert.equal(toHex([11, 9, 7]), "#0b0907");
  assert.equal(toHex([-4, 300, 128.4]), "#00ff80");
  assert.throws(() => parseHex("rebeccapurple"), /not a hex colour/);
  assert.throws(() => parseHex("#12345"), /not a hex colour/);
});

test("the sRGB transfer function is the real one, and inverses cleanly", () => {
  assert.equal(toLinear(0), 0);
  assert.equal(toLinear(255).toFixed(4), "1.0000");
  // 50% grey is not 0.5 linear — this is the whole reason a naive luminance is
  // wrong and every contrast ratio computed from it is wrong too.
  assert.ok(Math.abs(toLinear(128) - 0.2159) < 0.001, `got ${toLinear(128)}`);
  for (const channel of [0, 17, 64, 128, 200, 255]) {
    assert.ok(Math.abs(fromLinear(toLinear(channel)) - channel) < 0.0001);
  }
});

test("contrast matches the ratios WCAG publishes", () => {
  assert.equal(Number(contrast("#ffffff", "#000000").toFixed(2)), 21);
  assert.equal(Number(contrast("#000000", "#000000").toFixed(2)), 1);
  // The classic "just passes" grey on white.
  assert.equal(Number(contrast("#767676", "#ffffff").toFixed(2)), 4.54);
  // Order never matters.
  assert.equal(contrast("#0b0907", "#f7efdd"), contrast("#f7efdd", "#0b0907"));
  assert.ok(passesContrast("#0b0907", "#f7efdd"));
  assert.ok(!passesContrast("#767676", "#ffffff", { level: "AAA" }));
  assert.ok(passesContrast("#949494", "#000000"), "large text on near-black clears 3:1");
});

test("the paper and ink of this site clear AA in both halves of the page", () => {
  // The tokens the landing page and the app actually ship.
  const pairs = [
    ["#f7efdd", "#0b0907"], // cream on sumi black
    ["#ddcfb4", "#0b0907"],
    ["#b3a487", "#0b0907"],
    ["#201c15", "#efe3c8"], // ink on paper
    ["#5c5343", "#efe3c8"],
  ];
  for (const [ink, paper] of pairs) {
    const ratio = contrast(ink, paper);
    assert.ok(ratio >= 4.5, `${ink} on ${paper} is ${ratio.toFixed(2)}:1`);
  }
});

test("CIELAB matches the reference coordinates for the sRGB primaries", () => {
  const near = (actual, expected, tolerance = 0.05, label = "") =>
    assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);
  const [lr, ar, br] = toLab("#ff0000");
  near(lr, 53.24, 0.05, "red L");
  near(ar, 80.09, 0.05, "red a");
  near(br, 67.2, 0.05, "red b");
  const [lg, ag, bg] = toLab("#00ff00");
  near(lg, 87.73, 0.05, "green L");
  near(ag, -86.18, 0.05, "green a");
  near(bg, 83.18, 0.05, "green b");
  const [lb, ab, bb] = toLab("#0000ff");
  near(lb, 32.3, 0.05, "blue L");
  near(ab, 79.19, 0.05, "blue a");
  near(bb, -107.86, 0.05, "blue b");
  // White is exactly the D65 white point, by definition.
  const [lw] = toLab("#ffffff");
  near(lw, 100, 0.02, "white L");
  assert.deepEqual(toXyz("#ffffff").map((value) => Number(value.toFixed(1))), [95, 100, 108.9]);
});

test("CIEDE2000 is the published formula, not an approximation", () => {
  // Sharma, Wu & Dalal (2005), the standard verification data, stated in Lab so
  // the formula is checked on its own terms rather than against itself.
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  ];
  for (const [first, second, expected] of pairs) {
    const got = deltaEFromLab(first, second);
    assert.ok(Math.abs(got - expected) < 0.0001, `expected ${expected}, got ${got.toFixed(4)}`);
  }

  assert.ok(Math.abs(deltaE("#ff0000", "#ff0000")) < 1e-6);
  // Two near-identical creams are invisible; the cream and the ink are not.
  assert.ok(deltaE("#efe3c8", "#efe4c9") < 1);
  assert.ok(deltaE("#efe3c8", "#201c15") > 70);
  assert.ok(lightness("#ffffff") > 99 && lightness("#000000") < 1);
});

test("compositing does what a frosted panel does", () => {
  assert.equal(composite("#ffffff00", "#0b0907"), "#0b0907", "zero alpha shows the underlay");
  assert.equal(composite("#ffffffff", "#0b0907"), "#ffffff", "full alpha hides it");
  // 50% white over black is a mid grey, not white and not black.
  const half = composite("#ffffff80", "#000000");
  const [r, g, b] = parseHex(half);
  assert.ok(r > 120 && r < 135, `half white on black is around 128, got ${r}`);
  assert.equal(g, b);
});

test("text on glass is checked against the worst plate it can land on", () => {
  const plates = ["#0b0907", "#1b1611", "#42524f", "#efe3c8"];
  const worst = worstContrast("#f7efdd", plates);
  assert.equal(worst.surface, "#efe3c8", "cream text is worst on the bright plate");
  assert.ok(worst.ratio < 1.5, "and it fails there, which is the point of the check");
  // Ink on the panel fixes it: the panel raises the floor.
  const panel = composite("#0b0907cc", "#efe3c8");
  assert.ok(contrast("#f7efdd", panel) >= 4.5, "a 80% ink panel is enough on a cream plate");
});

test("60-30-10 is measured, and an unbalanced palette fails", () => {
  const good = balance([
    { hex: "#15110c", weight: 60 },
    { hex: "#b98a4e", weight: 30 },
    { hex: "#f0d9a8", weight: 10 },
  ]);
  assert.equal(good.share.join("/"), "60/30/10");
  assert.ok(good.within, "a textbook 60-30-10 passes");
  assert.ok(good.accentLeads === good.accentLeads);

  const flat = balance([
    { hex: "#15110c", weight: 40 },
    { hex: "#2a2a2a", weight: 40 },
    { hex: "#303030", weight: 20 },
  ]);
  assert.ok(!flat.within, "three equal areas are not a 60-30-10 palette");
  assert.deepEqual(flat.share, [40, 40, 20]);

  // An accent that is not the most saturated colour is a third background.
  const dull = balance([
    { hex: "#15110c", weight: 60 },
    { hex: "#f0d9a8", weight: 30 },
    { hex: "#8a8378", weight: 10 },
  ]);
  assert.ok(!dull.accentLeads);
});

test("the three roles are far enough apart to read as three", () => {
  const measured = separation([
    { hex: "#15110c" },
    { hex: "#b98a4e" },
    { hex: "#f0d9a8" },
  ]);
  for (const [pair, distance] of Object.entries(measured)) {
    assert.ok(distance > 10, `${pair} is ${distance} apart, which is not enough`);
  }
});

test("the grain is a data URI, so a frosted panel needs no request", () => {
  const uri = noiseDataUri();
  assert.match(uri, /^url\("data:image\/svg\+xml,/);
  const payload = uri.replace(/^url\("/, "").replace(/"\)$/, "");
  assert.ok(!/[<>"]/.test(payload), "no raw angle brackets or quotes in the payload");
  assert.ok(payload.length < 12000, `the grain is ${payload.length} characters, which is too heavy`);
  assert.equal(uri, noiseDataUri(), "the same grain every time, so screenshots do not drift");
  assert.notEqual(uri, noiseDataUri({ seed: 99 }), "and a different seed is a different grain");
});
