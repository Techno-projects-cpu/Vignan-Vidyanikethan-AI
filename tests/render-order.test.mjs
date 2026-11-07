/**
 * Render order.
 *
 * In 2.11.0 the sources panel grew a "why this page" line, and the card was
 * assembled one line above the row it was assembling:
 *
 *     card.append(top, snippet, matchLine, actions);
 *     const actions = ui.element("div", "source-actions");
 *
 * The browser throws "cannot access 'actions' before initialization" for that,
 * every time a source card is drawn. The throw was caught by the ask handler, so
 * the student saw a correct cited answer followed by "I could not complete that
 * answer". Two features looked broken while only one line was wrong.
 *
 * This file fails the build if an element is appended before it is declared.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const JS_FILES = readdirSync(new URL("../js/", import.meta.url))
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, source: readFileSync(new URL(`../js/${name}`, import.meta.url), "utf8") }));

test("no element is appended before it is declared", () => {
  const findings = [];
  for (const { name, source } of JS_FILES) {
    const lines = source.split("\n");
    const functions = [];
    lines.forEach((line, index) => {
      const match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
      if (match) functions.push({ fn: match[1], line: index });
    });
    for (let index = 0; index < functions.length; index += 1) {
      const start = functions[index].line;
      const end = index + 1 < functions.length ? functions[index + 1].line : lines.length;
      const body = lines.slice(start, end);
      // Declarations at the top level of the function (two spaces in, not nested).
      const declared = new Map();
      body.forEach((line, offset) => {
        const match = line.match(/^\s{2,}(?:const|let)\s+([A-Za-z0-9_$]+)\s*=/);
        if (match && !declared.has(match[1])) declared.set(match[1], offset);
      });
      body.forEach((line, offset) => {
        const call = line.match(/\.append\(([^)]*)\)/);
        if (!call) return;
        for (const argument of call[1].split(",").map((part) => part.trim())) {
          if (!/^[A-Za-z0-9_$]+$/.test(argument)) continue;
          const declaredAt = declared.get(argument);
          if (declaredAt !== undefined && declaredAt > offset) {
            findings.push(`${name}:${start + offset + 1} in ${functions[index].fn}() appends "${argument}" before declaring it at line ${start + declaredAt + 1}`);
          }
        }
      });
    }
  }
  assert.deepEqual(findings, [], `appending before declaring:\n  ${findings.join("\n  ")}`);
});

test("the source card assembles its actions row in the right order", () => {
  const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("function sourceCard("), source.indexOf("function renderVerification("));
  assert.ok(body.length > 200, "sourceCard is still there");
  const declaredAt = body.indexOf('const actions = ui.element("div", "source-actions")');
  const appendedAt = body.indexOf("card.append(");
  assert.ok(declaredAt > -1, "the actions row is still named");
  assert.ok(appendedAt > -1, "the card is still assembled in one place");
  assert.ok(declaredAt < appendedAt, "the actions row is created before the card that holds it");
  assert.match(body.slice(appendedAt, appendedAt + 120), /actions/, "the assembled card actually contains the row");
});

test("a card is assembled once, not piece by piece and then again", () => {
  for (const { name, source } of JS_FILES) {
    const body = source.slice(source.indexOf("function sourceCard("), source.indexOf("function renderVerification("));
    if (!body) continue;
    const appends = body.match(/card\.append\(/g) || [];
    assert.ok(appends.length <= 1, `${name}: sourceCard appends to the card ${appends.length} times`);
  }
});
