// Optional rendered-layout gate. Install puppeteer-core and @sparticuz/chromium
// outside the repository, then set PUPPETEER_MODULE and CHROMIUM_MODULE to their
// entry-point file URLs. CHAT_URL defaults to the local development server.
import assert from "node:assert/strict";
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || "puppeteer-core");
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || "@sparticuz/chromium");
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: "shell" });
try {
  // Judge instructions have three grid items (number, title, explanation).
  // Assert actual placement so prose cannot silently land in the number track.
  const judge = await browser.newPage();
  for (const width of [390, 768, 1024, 1366]) {
    await judge.setViewport({ width, height: 900 });
    await judge.goto(new URL("judge.html", process.env.CHAT_URL || "http://localhost:4173/").href, { waitUntil: "networkidle0" });
    const rows = await judge.$$eval(".steps li", nodes => nodes.map(node => {
      const title = node.querySelector("b").getBoundingClientRect();
      const prose = node.querySelector("span").getBoundingClientRect();
      return { x: title.x, proseX: prose.x, width: prose.width, top: prose.y, titleBottom: title.bottom };
    }));
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.ok(row.width > 200 && Math.abs(row.x - row.proseX) < 1 && row.top >= row.titleBottom,
        `${width}: Judge citation instructions are not in the prose column`);
    }
    console.log(`Judge steps ${width}px — PASS`);
  }
  await judge.close();
  for (const [width, height] of [[1024, 768], [800, 1280], [768, 1024], [390, 844], [1366, 768]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width <= 1024, hasTouch: width <= 1024 });
    await page.goto(process.env.CHAT_URL || "http://localhost:4173/", { waitUntil: "networkidle0" });
    await page.evaluate(() => document.querySelector("#startup-skip")?.click());
    await page.waitForFunction(() => !document.querySelector("#gate-guest-button")?.disabled);
    await page.click("#gate-guest-button");
    await page.waitForFunction(() => document.body.dataset.view === "start" || document.body.dataset.view === "ask");
    // End the optional tour; do not depend on a returning user's storage.
    await page.evaluate(() => document.querySelector("#first-run-skip")?.click());
    await page.evaluate(() => document.querySelector('.start-tools [data-view="ask"]')?.click());
    await page.waitForFunction(() => document.querySelector("#view-ask")?.getBoundingClientRect().height > 0);
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
