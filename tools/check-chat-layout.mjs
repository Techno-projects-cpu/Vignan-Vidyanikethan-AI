// Optional rendered-layout gate. Install puppeteer-core and @sparticuz/chromium
// outside the repository, then set PUPPETEER_MODULE and CHROMIUM_MODULE to their
// entry-point file URLs. CHAT_URL defaults to the local development server.
import assert from "node:assert/strict";
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || "puppeteer-core");
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || "@sparticuz/chromium");
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: "shell" });
try {
  for (const [width, height] of [[1024, 768], [800, 1280], [768, 1024], [390, 844], [1366, 768]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width <= 1024, hasTouch: width <= 1024 });
    await page.goto(process.env.CHAT_URL || "http://localhost:4173/", { waitUntil: "networkidle0" });
    await page.evaluate(() => document.querySelector("#startup-skip")?.click());
    await page.waitForFunction(() => !document.querySelector("#gate-guest-button")?.disabled);
    await page.click("#gate-guest-button");
    await page.waitForFunction(() => document.querySelector("#view-ask")?.getBoundingClientRect().height > 0);
    // End the optional tour; do not depend on a returning user's storage.
    await page.evaluate(() => document.querySelector("#first-run-skip")?.click());
    for (const long of [false, true]) {
      await page.evaluate((long) => {
        document.querySelector("#view-ask").classList.toggle("has-conversation", long);
        const log = document.querySelector("#chat-log");
        log.replaceChildren();
        if (long) {
          const message = document.createElement("div");
          message.className = "message assistant";
          const body = document.createElement("div");
          body.className = "message-body";
          for (let i = 0; i < 40; i++) {
            const p = document.createElement("p"); p.className = "rich-line";
            p.textContent = "Photosynthesis uses light energy to make food from carbon dioxide and water.";
            body.append(p);
          }
          message.append(body); log.append(message); log.scrollTop = 0;
        }
      }, long);
      await new Promise(resolve => setTimeout(resolve, 600));
      const measure = await page.evaluate(() => {
        const box = s => document.querySelector(s).getBoundingClientRect();
        const composer = box("#ask-form"), log = box("#chat-log");
        const nav = document.querySelector(".mobile-nav");
        const reserved = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
        const answer = document.querySelector(".message.assistant .message-body");
        return {
          bottom: composer.bottom, expected: innerHeight - reserved,
          composerHeight: composer.height, logHeight: log.height,
          answerFont: answer ? parseFloat(getComputedStyle(answer).fontSize) : null,
          answerBackground: answer ? getComputedStyle(answer).backgroundColor : null,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.ok(Math.abs(measure.bottom - measure.expected) <= 2, `${width} dock: ${JSON.stringify(measure)}`);
      assert.ok(measure.composerHeight < 200, `${width} composer consumes the screen`);
      assert.equal(measure.overflow, false, `${width} horizontal overflow`);
      if (long) {
        assert.ok(measure.logHeight > height * .45, `${width} answer viewport too small: ${measure.logHeight}`);
        assert.ok(measure.answerFont >= 16, `${width} answer font too small`);
        assert.notEqual(measure.answerBackground, "rgba(0, 0, 0, 0)");
        await page.$eval("#chat-log", n => { n.scrollTop = n.scrollHeight; });
        assert.ok(await page.$eval("#chat-log", n => n.scrollTop > 0), "long answers must scroll");
        await page.click("#chat-options > summary");
        assert.ok(await page.$eval("#ask-web-fallback", n => n.getBoundingClientRect().height > 0), "web search option inaccessible");
        await page.click("#chat-options > summary");
      }
      console.log(`${width}×${height} ${long ? "long answer" : "empty"}: dock ${Math.round(measure.bottom)}, composer ${Math.round(measure.composerHeight)}, log ${Math.round(measure.logHeight)} — PASS`);
    }
    await page.close();
  }
} finally { await browser.close(); }
