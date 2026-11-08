# Vignan Vidyanikethan AI

A textbook-grounded study assistant made by a **student of Vignan Vidyanikethan English Medium High School for the INSPIRE-MANAK science fair** — built as an **orchestrator around existing AI models**, not as a newly trained model. The project features the supplied Nezaad Industries logo and links to [Zero Vast](https://zero-vast.vercel.app/).

This repository now contains only the Vignan Vidyanikethan AI app. The old school-website files were removed so the project can be deployed directly from the repository root.

Your class books are the knowledge base. Vignan Vidyanikethan AI retrieves page-preserving passages locally, then either:

- runs a **real open-weight model on the device** (Meta Llama 3.2 1B, SmolLM2 or Qwen2.5 via bundled WebLLM + WebGPU) with Vignan's own textbook rules — no API key after the first model download,
- sends those short passages to an existing AI provider (Gemini, Groq, Cloudflare, OpenRouter, Mistral, Cohere, OpenAI, Claude, Arena workspace, Ollama, LM Studio, or any OpenAI-compatible endpoint) for a natural explanation, or
- uses its built-in offline extractive engine to quote the passages directly.

Book-based answers, quiz questions and flashcards keep a source citation. When books have no match, Bolt can show clearly labelled outside-source excerpts; it does not invent an answer or present web results as textbooks.

---

## Quick start

Requirements: Node.js 18+ (no npm dependencies to install).

```bash
npm start
```

Open:

- Vignan Vidyanikethan AI: <http://localhost:4173/>

The server binds to `0.0.0.0`, so it also works in the Arena live preview. A plain static server (`python3 -m http.server`) can serve the app too, but the `/api/ai`, `/api/search`, `/api/fetch` and `/api/auth/*` endpoints will not exist — the offline engine and guest progress still work.

A first-time visitor can enter or skip the branded startup screen, then choose **Log in**, **Register**, or **Continue as guest** beneath the account options. The intro is remembered for the current tab when session storage is available. Existing signed-in sessions and a guest choice reopen the workspace; the guest choice is remembered only in the current tab. The guest path remains available when the account server is offline. The library starts with a **starter shelf** of pages written for this project - four subject books covering the chapters JEE, NEET and AP EAPCET practice draws from - so the first question, quiz or mock test works immediately; add your own books in **Library** whenever you like, and they are searched first. The starter pages are our own text, not a publisher's, and they can be deleted in one click; the old auto-installed sample pack stays retired, while student uploads and study history are preserved. For a real AI answer with **no server key**, open **Settings → Real local model**, choose a model, and press **Download & enable** (first download needs internet; later runs are offline). To enable optional cloud AI answers, copy `.env.example` to `.env`, add one or more official free keys from your own accounts (comma/newline separated), and restart the server — enable the server route in **Settings → Advanced settings**; it rotates through the key pool, keeps student keys as a last resort, and retains the offline engine as a fallback. The minimal UI keeps those controls tucked behind **Settings → Advanced settings**.

---

## Zero-budget AI: what is actually free?

Short answer: **there is no legitimate “free unlimited AI API”** that a public website can call forever, and **public / leaked API keys are never used**. Exposed keys can read private data, drain quotas and cause large bills; Google now rejects unrestricted standard keys for Gemini ([Gemini API key docs](https://ai.google.dev/gemini-api/docs/api-key)). Arena.ai — the agent platform used to build this project — is not a drop-in website inference API. Its free-router keys are documented for Claude Code / Claude Desktop; other harnesses such as `curl` or a server-side `fetch` receive `403` restrictions ([Arena docs](https://platform.arena.ai/docs), [Windows/harness note](https://portal.api.preview.arena.ai/docs/windows)). So we do **not** pretend the website runs on a free unlimited Arena key.

Instead, Vignan Vidyanikethan AI offers a **keyless local model** plus a **provider-agnostic free router** using keys you generate yourself:

| Provider | What $0 buys in 2026 | Main catch |
| --- | --- | --- |
| Google Gemini | Free-of-charge Flash / Flash-Lite model rows ([overview](https://www.memetik.ai/guides/gemini-api-free-tier-limits)) | Google no longer publishes fixed free RPM/RPD; limits appear per project in AI Studio and are not guaranteed. |
| Groq | No-card free tier with per-model rate limits, e.g. roughly 30 RPM / 1,000 RPD on GPT-OSS models ([2026 review](https://omidsaffari.com/blog/groq-pricing)) | Model availability changes; organisation-level limits apply. |
| OpenRouter | Free models and `openrouter/free` auto-router ([rate limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know)) | 20 requests/minute and 50/day on an unfunded account; some free models may train on prompts. |
| Cloudflare Workers AI | 10,000 free Neurons/day ([official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)) | Neurons are compute units, not requests; free allocation resets daily. |
| Mistral AI | Free mode, no card; limits shown in your admin panel | Model access can change; check the Limits page. |
| Cohere | Free trial key, ~1,000 calls/month, 20 chat RPM | Evaluation / non-commercial use only. |
| Arena AI | Optional workspace API key | Free-router keys are not for websites; use only if your workspace has API access. |
| **Local WebLLM** | **Real open-weight AI on the device, $0, no key** ([WebLLM](https://github.com/mlc-ai/web-llm)) | First model download needs internet and a WebGPU-capable browser. |
| Offline engine | Truly unlimited, $0, private | Extractive answers rather than fluent generative prose. |

The server supports **multiple keys per provider**: paste several values into one Render secret separated by commas/newlines, or use a plural `*_KEYS` alias. Vignan builds one upstream per key, tries them in order, cools down a quota-limited key for 60 seconds, and only then tries student-owned keys. It skips 429/5xx/empty responses and falls back to the offline extractive engine if everything fails. Add school keys on the server only — never in the browser. See `.env.example`, `render.yaml` and `DEPLOY.md`. The **Settings → Advanced settings → Official free-tier API keys** panel links to each provider's own key-creation page; **no key value is ever committed to this repository**.

When all Render keys are exhausted, students can add their own keys in **Settings → Advanced settings → Your own API keys** (also linked from the account area). Those keys stay in that browser, are sent per request only to this site's `/api/ai` proxy, are never stored in Supabase accounts or the public leaderboard, and are excluded from JSON exports. They can be tested, paused or cleared per provider.

For full offline capability, see [LOCAL_AI.md](./LOCAL_AI.md). The bundled WebLLM runtime runs Meta Llama 3.2 1B / SmolLM2 / Qwen2.5 in a Web Worker with WebGPU, applies Vignan's own grounding rules, and caches the chosen model after one download. It powers answers, explanations, summaries, practice, quizzes, flashcards, short-answer grading and citation verification without a server key.

---

## How this was built

The code here was written with an AI coding agent (Arena Agent Mode) under the student's
direction: the student decided the scope, rejected what did not belong, and the agent wrote
the code and the tests. That is disclosed on the judge page too, because a science-fair
project should not leave a judge to guess. What makes the claims checkable is not who typed
the code: it is `npm run check`, which runs the secret scanner, the tests, the precache
build and an offline simulation with the network switched off, and fails the build when
something is missing. `CHECKLIST.md` lists the checks that still need a human and a phone.

## Where the ideas came from

The free tutors already out there were the best reading material for building this one, and
two different projects use the name **Eklavya**, so both are named here.

**eklavya.io** is the funded one: built by the team behind Apni Pathshala with Malpani
Ventures, free, no ads, no credit card, covering CBSE/NCERT, JEE, NEET and eight state
boards. It is the standard in this space, and this project does not claim to beat it. It
lists Andhra Pradesh and Telangana as "on our list", so learners here are not served yet —
which is the honest local reason a school in Guntur builds its own.

The **open-source repository** at
[visheshpandey/Eklavya](https://github.com/visheshpandey/Eklavya) is a separate weekend
hackathon project that happens to share the name. The idea of a viva that asks you to
explain, then names the misconception, came from reading it; it is credited in
`OPEN_SOURCE_CREDITS.md`, publishes no licence, and none of its code, text or prompts were
copied — the rules in `js/viva.js` are our own.

What is different here is a deliberate constraint: every answer must name a page of the
student's own book and is refused when that page is missing, the whole study loop runs with
the network off, and a rate-limited provider is rotated past rather than turned into an
error. A funded team covers far more ground; this one goes deeper on less.

## What is implemented

| Area | What it does |
| --- | --- |
| Premium minimal interface | A skippable Nezaad-branded intro, sharp-edged monochrome workspace, locally bundled Space Grotesk and Manrope fonts, one composer, a keyboard-accessible command menu (`Ctrl/⌘ + K`) and a simple engine status. Most navigation and advanced controls stay tucked away. |
| Built-in fast AI | **Bolt** is the instant offline textbook engine: no download, no key, page-cited answers from the local book index. Optional local and connected model routes remain in advanced Settings. |
| Grounded answers | Local hybrid retrieval (BM25 + hashed TF-IDF vectors + phrase matching) over page chunks, with `[1]` citations and a clickable page reader. |
| Model router | Route **Answers**, **Quiz writing**, **Flashcard writing**, **Short-answer grading** and **Citation verification** to different existing AI providers. Automatic fallback to the offline engine. |
| Real local AI | Bundled WebLLM + Web Worker runs open-weight Meta Llama 3.2 1B, SmolLM2 or Qwen2.5 on-device with Vignan's grounding rules. Download once, then use every AI task offline. |
| Zero-budget AI runtime | Server-side **free AI router** tries Gemini, Groq, Cloudflare Workers AI, OpenRouter free models, Mistral, Cohere and an optional Arena AI workspace key in order; supports multiple keys per provider, auto-rotates on quota limits, cools down exhausted keys, skips rate-limited providers and keeps school keys off student devices. |
| Student BYOK fallback | After all Render keys are exhausted, students can add one or more of their own keys in account settings. Keys stay browser-local, are used only through the site's own proxy, and never appear in exports, accounts or leaderboards. |
| Official key links | Settings shows safe signup links for eight free/keyless providers and explicitly warns against leaked or shared keys. |
| Viva practice | An examiner asks you to explain a sentence from your own page, out loud or typed. One follow-up question when the answer is thin, then a report card out of ten that names the exact misconception and sends you back to the cited page. Marking is deterministic, so a student can check it by hand. |
| Voice | Read any answer or question aloud, and ask a question or answer it by speaking, using the browser's own speech APIs. Both are optional and neither is bundled data: if a browser has no voices, or listening needs a connection, the app says so and typing still works. |
| Starter shelf | Four books of pages written for this project (Physics, Chemistry, Biology, Mathematics) are installed on the first open, so citations, quizzes, flashcards and exam mocks work before a student adds anything. They are ordinary library pages - searchable, cited and removable - not a reproduction of any published textbook, and a student's own upload is always searched before them. |
| Starting blocks | The Ask screen opens with five full-width blocks instead of a blank box, numbered `01 / 05` and sharing their borders so they read as one object: explain a concept, quiz me on a chapter, my viva is coming up, revise in ten minutes, write a five-mark exam answer. Tapping one **asks it straight away** — each question is already complete, ends by asking for a page, and changes colour as it launches — or opens the tool it names. With an empty library the notes say where the pages will come from; a block can also be shared as a link (`?ask=…`) that fills the box without sending. The old suggestion chips are hidden while the blocks are showing, so only one set of suggestions is ever on screen. |
| Language picker | A screen of 33 large tiles, each led by a character from its own script (31px) with the native name under it and the English name below that. A search box filters by script, English name or code and reports `3 OF 33`; the chosen tile keeps a brand border and a tick. The hidden `<select>` stays for keyboards and screen readers, and Urdu, Arabic and Persian tiles flow right-to-left. |
| Language board | Thirty-three tiles, each led by a character from the language's own script. No two glyphs are the same: where a single letter would collide (English and Español, Urdu and Arabic, Português and Polski, Türkçe and Tiếng Việt) the glyph widens to two or three letters — EN and ES, POR and POL — automatically, and a test fails if a language ever makes them collide again. Search ignores accents, so `francais`, `turkce` and `portugues` all find their language from a phone keyboard, and an empty result names what was typed and offers **Show all 33 languages**. Tapping the language you already use says so instead of doing nothing.
| Judge numbers that cannot go stale | The judge page used to show pasted output: "Release v33, 372 files" was still there in 2.13.0. `tests/judge-numbers.test.mjs` now runs the offline simulator on every build and fails if the count, the cache name or the release on the page differ from the real ones.
| The 2.0 design layer | One stylesheet, loaded last: a fluid type scale in Space Grotesk and Manrope, a 4px space grid, hairlines instead of shadows, zero corner radius, and a numbered section header that is *visible* — the screen's own name used to exist only for screen readers. The sidebar reads as an indexed syllabus (01 Ask … 10 Settings); controls are uppercase mono labels; answers are set at a 68-character measure. `tests/design-system.test.mjs` holds it: every radius is 0, every theme passes WCAG AA on body text, phone targets are 60px, focus is always visible, and motion is optional. |
| A phone that can reach everything | The tab bar carried seven screens and left out Progress, Flashcards and Settings entirely — there was no way to open Settings on a phone except the ⌘K menu. It now carries the five daily screens plus **More**, which opens the one menu that already indexes all ten. |
| Scroll memory | Changing screen reset `#main`, which is not the scroll container, so it did nothing: you arrived at the middle of a page you had never seen. Each screen now remembers its own position and returns to it. |
| Smaller over the wire | The app is one text file after another — about 460 kB before the service worker gets involved. The server now negotiates `br`/`gzip` per request, caches the compressed copy keyed by file, modification time and encoding, and sends `Vary: Accept-Encoding` so no cache hands a brotli body to a client that asked for gzip. Measured on this repository: `app.js` 242,933 → 55,724 bytes, `styles-next.css` 38,118 → 6,658, `index.html` 86,571 → 18,092 — about four fifths of the text a phone would have downloaded. Files under 1 kB and anything already packed (images, fonts, PDFs) are left untouched, and a failure to compress falls back to the original bytes rather than a broken page. |
| Reading position | A 2px hairline at the top of the screen fills as you scroll, painted with a `transform` so scrolling never re-lays-out the page, and hidden entirely on a screen that fits without scrolling. `tests/ux-tools.test.mjs` checks the division, including rubber-band overshoot, because a progress bar that reads 140% is worse than none. |
| Back to top | Appears only after you have scrolled 480px **and** there is still 320px below you, so it never covers the reading you are about to do, never appears at the top of the page, and never sits uselessly at the end. It respects reduced motion, and on a phone it becomes a 44px square that sits above the tab bar. |
| Keyboard shortcuts | `Ctrl/⌘ + K` opens the menu, `/` jumps to the question box, `?` opens a shortcuts sheet, `Esc` closes the sheet then the menu, `Enter` sends and `Shift + Enter` starts a new line. None of them fire while you are typing in a field — that check is one tested function, not a hope — and `Esc` is the only one that still works inside one. The sheet is generated from the same list the code reads, so it can never advertise a key that does nothing. |
| A composer that grows | The question box was two fixed rows, so a long question scrolled inside a box the size of a business card. It now measures what is in it, grows to a ceiling of eight rows (five on a phone), and then scrolls with a solid bottom edge so Send never leaves the screen. Sending resets it, and a prefilled question — a starting block, a shared link, a page from the reader — arrives at the right height. |
| Offline mode, that actually means it | A switch in Settings → App & offline. When it is on there is no web fallback, and no account, friends, chat or leaderboard calls — the answer comes only from the pages on the device, which is what a demo with bad Wi-Fi needs. The switch does not erase the student's web preference: turning it off restores exactly what they had chosen. The chip in the top bar says "Offline mode" while it is on. |
| A release that arrives by itself | The permission banner is gone, by the student's own decision: publishing is the whole gesture. The worker takes over immediately and the page reloads once — except over work in progress. An answer being written, or a question typed but not yet sent, is never thrown away; the reload waits for the box to be empty and then happens without asking. There is no button, no "Later", and no setting that can pin a device to an old release. |
| One chat, and a logo | The app opens as a single conversation — a greeting, four ordinary suggestion chips, a question box — and nothing else. The sidebar, the numbered page header, the hero and the five stacked blocks are folded away behind the logo in the bottom-left corner, which opens a menu with account, chat, history, library, quiz, exams, flashcards, progress, friends, Study Hall, play, settings, install and the theme switch. **Chat** returns to the conversation; **New chat** clears it, and asks first, because only one of those loses anything. Nothing was deleted: the screens are the same screens — and there are now eleven, with code practice among them — one tap from where the student is already looking. |
| A landing page that argues | `/welcome` is a page of its own, not a fifth version of the app: a hero that states the constraint ("It will not answer from nothing"), a four-move illustration of a cited answer, a board of all thirty-three languages in their own scripts, every one of them on screen at once, the eleven screens as square cards that share their borders, and five numbers a judge can re-run. It carries no JavaScript at all, loads no host but this one, and every corner is square. `tests/landing.test.mjs` keeps it honest: each number on it must equal the number on the judge page (which is itself checked against a real run of the offline simulator), each card must name a screen the app really has, every link must resolve, and the palette must stay grey. |
| Writing, for people who have not installed anything | `/blog` is ten pieces a student can act on tonight: checking an AI answer before you trust it, revising a forgotten chapter, studying with only a phone, writing your own questions, a fixed routine for physics numericals, and explaining a project to a judge in sixty seconds, why marks dropped in one chapter, answering a five-mark question, a viva, and a demo that survives a power cut. Original writing, no email box, no cookie, no analytics, no JavaScript beyond the structured data. Every piece carries a canonical URL, a description search engines can read, `BlogPosting` structured data that has to agree with the page, an RSS feed, and an entry in `sitemap.xml`. `tests/blog.test.mjs` keeps them from becoming what most project blogs become: a stub with a keyword in the title (a word floor, a minimum per section, and a reading time recomputed from the finished page), a claim nothing backs (no percentages, no "guaranteed", no invented statistics), a dead link, a reading time that drifts from the real count, or a page that needs the network. |
| A textbook, without Settings | The "+" beside the question box opens one sheet: upload a PDF or text file, paste notes, fetch a website, or start a quiz, flashcards or exam practice. Uploading from chat opens the phone's own file picker directly — the same guarded ingest path as the Library, with the same limits and the same labels. |
| Fetch a website, then ask about it | A public page can be read from the composer and asked about like any other source. The browser never fetches the page itself: the address goes through the Library's server-side importer, which refuses private addresses, scripts and archives, and the result is labelled **outside your textbooks**. The next question is pre-filled as *"Explain this page in simple words, then tell me how it works: …"*, and the page stays in the library as a web source for follow-ups. |
| Install, honestly | **Install the app** in the menu installs the website as an app — full screen, offline, own icon — and says so. It also says plainly that a real `.apk` or `.exe` needs a build machine with Android Studio or Tauri, and links the exact commands in [PACKAGING.md](./PACKAGING.md) instead of offering a download that does not exist. |
| History you can point at | The menu's History lists the student's own questions from this device, newest first, with times; tapping one puts it back in the composer. It is deliberately not dressed up as a list of separate conversations, because the app keeps one running chat. |
| Enter that does not send too early | The composer sent on any unguarded Enter, which in Hindi, Telugu, Japanese, Korean — or with any phone keyboard showing word suggestions — is the key that confirms the word being composed. Pressing it asked a half-finished word as a question. It now checks `isComposing` and the older 229 code, so only a real Enter sends; `Shift + Enter` still starts a new line. |
| A shortcuts sheet you can leave | `?` opened the sheet and moved focus into it, but closing it dropped focus on the page body, so the next Tab started from the top of the document. Focus now returns to whatever had it, and Tab/Shift+Tab stay inside the sheet instead of walking into the page behind it. |
| A crash between the answer and its sources | Since 2.11.0 the source card was assembled one line above the row it was assembling, so every cited answer drew a card that threw `cannot access 'actions' before initialization`. The throw was caught by the ask handler, so a student saw a correct answer followed by "I could not complete that answer". One line, fixed; and because no test had ever asked the app a question end to end, `tests/render-order.test.mjs` now fails the build if any element is appended before it is declared, and a headless run asks three real questions and checks the answer, its citations and the absence of the false failure.
| Answers a visitor would actually ask | The offline engine is scored against thirty-one ordinary questions on every build (`tests/answer-bench.test.mjs`), and each one must be answered from a page carrying the question's own topic. Writing that list found two defects that reading the code had not: "what is photosynthesis and why does it matter" was answered from a chemistry page about *matter*, and "how does a transformer work" from a chapter about *work*. Retrieval now strips pronoun tails, weights topic words by how rare they are in the library, prefers the page that names most of the question, refuses when the topic is nowhere in the library, and matches "digestive" to "digestion" rather than refusing a correct page. The starter shelf grew from 41 to 49 original pages so ordinary questions have somewhere to land.
| Markup that cannot leak | A duplicated block of four screens, with one opening tag that had lost its `<section class="view"` prefix, shipped from 2.8.0 to 2.12.0: the fragment `id="view-friends" data-panel="friends">` was printed on every screen, and six element ids existed twice. Both are gone, and three tests now fail the build if either returns: unique ids in every page, no visible text that reads like markup, one screen per navigation item with balanced tags.
| No code on screen | A student should never read a developer's note. The optional custom search address used to be printed in Settings with the label *Endpoint with {q} placeholder* and a URL full of braces, whether or not it could do anything. It now sits behind "My own search service": hidden until chosen, titled **Search address**, with one plain sentence explaining where the question goes. A test fails the build if any visible label, in any language, contains a code shape again.
| Six styles | Settings → Look & language offers Minimal, Soft, Editorial, Luxury, Terminal and Neo-brutalism. Each is a token set — surface, ink, accent, corner radius, typeface, border weight — mapped onto the variables the app already used, so a style is a dozen lines and cannot break another. The choice is saved per device, applied before the first frame from a validated mirror, and every style is checked for WCAG AA contrast by a test rather than by eye. |
| Answer quality | Three checks stand between a page and a written answer. Retrieval refuses sooner when the words in the question are not on the pages it found, and the refusal names those words and the closest page instead of saying "not found". A grounded answer that only partly covers the question says so in the answer body, not only in a small tag. When a connected model writes the answer, any figure that appears on no cited page is listed before the text, and a long answer with fewer than half its sentences tied to a page is flagged. The offline engine only quotes, so it cannot invent a number — the check exists for the connected model, which can. |
| Reader | Every citation opens the real page with the passage highlighted. The reader keeps its own text size (13–21px, remembered on the device), can show only the pages that hold your quote, and turns pages with the arrow keys. It exists because a citation is read on a phone in daylight and on a projector at the back of a classroom. |
| My notes on a page | Under every page in the reader there is one box: *My note on this page*. One line of your own words, pinned to that page, saved on this device only and never sent to a model. Updating replaces the note instead of piling duplicates up, each note has its own delete, and `Save my notes (.md)` exports the whole book's notes in page order so they can be printed or pasted into a notebook. 300 notes, 280 characters each — a margin, not a diary. |
| Citations that point at nothing | When a connected model writes the answer, every `[n]` it uses is checked against the passages that were actually open. If it cites `[4]` with three pages open, the answer says so above the text, and the meta line reports `2 of 3 pages cited` instead of implying the whole answer came from your books. `[2](url)` is read as a Markdown link, not a citation. |
| A refusal you can act on | Retrieved pages that retrieval did not stand behind are kept, so a refusal can name the closest page — as a sentence and as one button that opens that page in the reader with the passage highlighted. |
| Light/dark, honestly | Minimal and Terminal each ship a real pair — Terminal's is the same typewriter rules on paper instead of glass, measured at 18.5:1 like the dark one. Soft, Editorial, Luxury and Neo-brutalism fix a single palette, so the switch cannot do anything there: it is greyed out with one line of reason in Settings and a tooltip in the header, rather than silently doing nothing. |
| The theme does not flash | The chosen theme is mirrored to this device and painted before the first frame, the same way the style is. Before this, a student who chose dark saw a white flash on every load. The mirror value is checked against `dark`/`light` before it reaches the page. |
| Reading resumes | Opening a book from Library continues where this device stopped reading, and says so (`Continuing from page 7.`). A citation always opens the page it cites — the two never mix. |
| Ask about this page | One button in the reader turns the page in front of you into a complete question (`Explain this from my book: "…"`) and puts it in the composer. Nothing is sent until you tap Send. |
| Why this page | Under every cited passage the sources panel names the words it shares with your question, or says plainly that it shares none — a page can arrive on its neighbours, and that is worth knowing. |
| Reader in your language | Every word in the reader — navigation, search, the note box, the resume line — is translated for English, Telugu and Hindi, and every other language falls back to English rather than to a key name. |
| School default style | A device that has never chosen a style starts in the school's default, set once with `SCHOOL_DEFAULT_STYLE` on the server and reported by `/api/health` (validated server-side, so a typo cannot blank the app). A student's own choice always wins and is kept per device — deliberately not per account, because a shared classroom tablet should not carry one student's taste to the next. |
| Responsive by measurement | Four targets are handled explicitly: phone (360–430px), tablet (768–1024), laptop, and a 1280×720 projector. Ask becomes one column below 1024px, headings scale with `clamp()` instead of jumping, tab bars scroll sideways instead of wrapping, phone targets stay 40px tall, and landscape phones hide the hero so the composer never leaves the screen. |
| Settings tabs | Settings is split into Look & language, Study & AI and Privacy & app. The cards are tagged in the markup, so the tabs only decide what is visible — an untagged card stays on screen in every tab rather than disappearing. Arrow keys, Home and End work. |
| Honest empty slots | A feature that is not built says so. The Library shows a dashed "coming soon" card for SCERT/NCERT books with the reason (publisher permission) and a disabled button, rather than a promise that fails when tapped. |
| Library | Upload PDFs and readable text (for example TXT, Markdown, CSV and JSON), paste notes, or import a public webpage/PDF/text URL. Scripts, executables and archives are rejected. Web imports retain their origin and are labelled separately. |
| Quizzes | MCQ, fill-in-the-blank, short-answer and mixed quizzes; easy/medium/hard; timed or untimed; AI-written or offline-generated; instant grading with per-question review, topic breakdown and a revise list. |
| Exam practice | **JEE Main**, **NEET (UG)**, **AP EAPCET** (Engineering and Agriculture) and **JEE Advanced** as three modes each: a **mock test** in the real paper's shape (question count, subject split, marking and pace per question), a **chapter drill** (untimed, no penalty) and **syllabus coverage** (which chapters your own pages already answer, and what to study next). Marking is the exam's own, including negative totals. No past papers, coaching PDFs or textbook scans are bundled, fetched or indexed: the pattern is public, the questions are written from the student's own pages, and every pack links the official page. |
| Flashcards | Create multiple device-local cited decks, switch between them, review due cards with a Leitner schedule, or practise without altering that schedule. Missed quiz questions can become a revision deck. |
| Code practice | A screen of its own: **Python**, **JavaScript** and **HTML & CSS**, four lessons each, every lesson one idea, one example and one thing to try. Paste any program and every line is explained in plain words — what it does, why the punctuation is there and the mistake beginners make on that line — by rules on the device, so it works with the Wi-Fi off. **What will this print?** marks a prediction exactly, or says plainly that the output depends on input and cannot be predicted. A pasted program in the chat goes to the same reader; “teach me loops in python” opens the lesson instead of a chapter on electricity. |
| Conversation memory | A follow-up question keeps its topic: “why?”, “and the second one”, “इसे आसान करो” and “explain that again” are read against the last real question, and the composer shows **Continuing: …** while you type so you can see what will be carried. A question that names its own subject never inherits an old topic. When a follow-up finds no new page, the answer continues from the pages cited a moment ago rather than starting fresh, and a connected model receives a short written summary of the conversation as well as the last turns. |
| Chat actions | Ask “make a quiz on photosynthesis”, “quiz me on chapter 4”, “make flashcards on that”, or “open my library”. These start directly from chat. “That” uses the most recent cited library answer; it does not quietly convert a web snippet into a textbook. An unfinished quiz needs confirmation before replacement. |
| Model question papers | Select readable past-paper PDFs/text in Library, or ask chat to make a model paper from selected documents. Bolt identifies, deduplicates and balances existing questions with source pages; preview, download as text, or print/save as PDF. It can reuse questions, cannot predict the exam, and does not infer an answer key. Scanned papers need OCR first. |
| Friendly breaks | Bolt gives a few brief, supportive local replies and then redirects to study. Safety-sensitive language takes precedence over search or the break limit. These templates are not an unrestricted generative chatbot or emergency service. |
| Progress | A recommended next step, local streak, XP, accuracy, topic mastery and reviewable recent results, plus an optional live class leaderboard. Full decks and question-by-question reviews remain on the device. |
| Student accounts | Roblox-inspired Log In / Register with username, password, age band and private gender; local scrypt hashes or Supabase Auth, persistent Supabase sessions, under-13 guardian consent, referral codes and squad invites. |
| Funky edit video | An 8-second story with four visual vibes, a branded Nezaad style, score reveal, replayable preview, original on-device synth beat, question bars and revision prompt. An optional on-device QR links to Zero Vast; a caption can be copied separately. Choose 540p, 720p or 1080p; MP4 is preferred, WebM and a 1080×1920 PNG are fallbacks. Nickname and invite code are opt-in. |
| Web fallback | New installs use a no-key, multi-source search when the books fail: the Wikipedia edition for the chosen language, the DuckDuckGo Instant Answer API, and Simple English Wikipedia as a last resort, plus a small built-in reference for the school, the project and evergreen facts. The server reads up to two result pages so answers quote real passages. The composer can turn it off and stored opt-outs are preserved. Everything outside your books is labelled **OUTSIDE YOUR TEXTBOOKS · not independently verified**. |
| Conversation and links | Bolt carries a bounded recent topic into follow-ups, answers creator questions directly, and can quote a supplied public webpage or PDF with `[Wn]` citations. It is an extractive lookup engine, not a generative chatbot. |
| Offline / PWA | Service worker caches the full app shell, WebLLM runtime, local AI worker, PDF.js and CMaps after the first online visit. Installable manifest included. |
| Responsive study workspace | Monochrome, prompt-first design with a compact menu, comfortable touch targets, adaptive quiz layouts and a mobile-friendly edit studio. |
| Privacy | Books, chats, decks and results are stored locally; optional connected AI and web search may send questions and relevant excerpts to external services. Student keys are excluded from exports and account/leaderboard records. [Privacy policy](./privacy.html) and [terms](./terms.html) are available before entry and in the app. |
| Languages | **33 languages.** 13 Indian languages (English, हिन्दी, বাংলা, मराठी, తెలుగు, தமிழ், ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ, ଓଡ଼ିଆ, অসমীয়া, اردو) plus Nepali, العربية, فارسی, Français, Deutsch, Español, Português, Italiano, Nederlands, Polski, Русский, Українська, Türkçe, 中文, 日本語, 한국어, Bahasa Indonesia, Tiếng Việt, ไทย and Kiswahili. Core labels, screen titles, the composer, language-aware search and connected-model instructions all follow the choice; Urdu, Arabic and Persian switch the layout to right-to-left. Untranslated long help text falls back to English. Indic combining marks are preserved in retrieval and grading; older book indexes are rebuilt in memory without deleting the originals. Offline Bolt quotes the source language and does not translate. A connected AI is asked to respond in the selected language, but its translations and citations need checking. |

---

## The simple shell

A student who came here to study should not have to learn a workspace first. The
app opens as a conversation, the way a messaging tool does: messages fill the
window, the question box sits on the bottom edge in the middle, and there is
nothing across the top of the screen at all.

Everything else is in a drawer. Swipe in from the left edge of the screen — or
tap the small logo in the top-left corner — and it slides in with the account,
the history, all eleven screens, the install instructions and the theme switch.
Swipe back, tap the darkened conversation, or press Escape to close it.

That is a deliberate reversal of the 2.0 redesign. The design layer is not gone
— it still styles every one of the eleven screens, the numbered headers still
appear on the advanced screens, and the command menu (`⌘K`) still indexes
everything. What changed is what is *in front* of a new visitor:

| Before | Now |
| --- | --- |
| Sidebar with ten numbered screens | One chat, four suggestion chips, a question box |
| A top bar with brand, view chip, AI chooser and menu | Nothing above the conversation |
| Hero, project line, five stacked goal blocks | The same prompts as four ordinary chips, gone after the first question |
| Library upload found in Settings-adjacent screens | "+" beside the question box |
| Pasting a link and hoping | **Fetch a website** in the same sheet, labelled as outside your textbooks |
| Account, theme and offline chip in a top bar | The same things in the drawer the logo opens |

An empty chat keeps its greeting above the chips; as soon as there is a
conversation the greeting goes and the messages have the whole screen. The chat
is a fixed layer the height of the *visible* window (js/shell.js reads
`visualViewport`), so opening the phone keyboard pushes the box up instead of
covering it.

On a phone the box has the whole bottom edge to itself and the logo is a 40px
square in the top-left corner; the drawer takes 84% of the width. Three tests
hold the arrangement: `tests/simple-shell.test.mjs` fails if the chat stops being
the first thing on screen, if the box stops sitting on the bottom edge, if a
left-edge swipe stops opening the drawer, or if any screen loses its way back
into it.

## Premium minimal shell

The public interface is intentionally sparse: a skippable student-project intro, sharp-edged controls, one large headline, one composer, and a command menu for everything else. Its prompt-first layout was informed by [Arena.ai](https://arena.ai/).

- Press **Ctrl/⌘ + K** or choose **Menu** to open the command palette. It contains every section, PDF upload, quiz/flashcard actions, sources, settings, keys, theme, account, credits and policy links. Use arrow keys to browse, Enter to open and Escape to close.
- After the entry screen, **Add a book** opens the file chooser. In **Library**, students can also drag a file, paste notes, or import a public URL. PDFs are indexed locally and their page numbers are preserved.
- **Bolt** is the built-in super-fast AI: it answers from the local textbook index with citations, requires no model download and works offline. It is the default route.
- The main AI chooser is hidden. Bolt is the default; optional local and connected model routing is available only through the advanced Settings panels. Existing deliberately configured routes are preserved.
- Settings open with a single **Control room** card; the dense model, key, web, privacy and appearance panels stay hidden until **Advanced settings** is chosen.
- The interface palette is black/grey/white in both themes. Fonts are bundled locally, motion respects reduced-motion preferences, and the score studio offers additional colourful styles. See [OPEN_SOURCE_CREDITS.md](./OPEN_SOURCE_CREDITS.md).

## Code practice

A student with a phone and no laptop can still learn to code here. The screen has
three languages, twelve short lessons and two tools:

- **Explain my code.** Paste a program and every line is explained in plain
  words: what the line does, why the colon or the brace is there, and the mistake
  beginners make on that line. It is written in `js/code-mode.js` as rules, not
  generated by a model, so it answers at the same quality with aeroplane mode on
  and costs nothing. A line it does not recognise is marked as unrecognised
  rather than guessed at.
- **What will this print?** A tiny evaluator works out the exact output of
  straight-line programs and marks a prediction line by line. When the output
  depends on a decision, an input or a random number, it says so and refuses to
  invent an answer.

The lessons are **written for this project**, not copied from a textbook, and
they say so on the screen and in every chat answer. Nothing is uploaded, nothing
is sent to a model, and the twelve lessons are cached with the rest of the app.

## Conversation memory

Before this, every question was answered as if it were the first one. Two rules
fix that, both in `js/memory.js`:

| The question | What happens |
| --- | --- |
| "why is it important?" | The last question that had its own topic is carried into the search, and the composer shows **Continuing: What is photosynthesis?** |
| "explain that again", "and the second one", "in simple words", "इसे और आसान करो" | Same rule. The list of follow-up shapes covers English, Hindi, Telugu, Tamil, Bengali and Kannada. |
| "What is 2 + 2?", "List the parts of a flower" | Nothing is carried. A question with its own subject is answered on its own. |
| "hi", "thanks", "ok" | Nothing is carried either — small talk is not a follow-up. |

The carried text is the student's earlier question, quoted, never a summary the
app invented. A follow-up that finds no new page continues from the pages the
last answer cited, and says that it is doing so. A connected model receives a
short **CONVERSATION SO FAR** block as well as the last turns, so a provider
that drops history still knows what the conversation was about.

## The landing page

The app opens as a conversation, on purpose. A page that has to explain the
project in thirty seconds is a different job, so it lives at `/welcome` as its
own document with its own stylesheet — no script tag, no host but this one.

| Part | What it does |
| --- | --- |
| The hero | `ASK YOUR / TEXTBOOK.` with the second line stroked rather than filled, over a hairline grid. Four figures underneath (cost, languages, screens, offline) and two ways in: the app, or the judge page. |
| The specimen | One question, one cited answer, one follow-up with the **Continuing:** chip, one answer that stays on the same page — animated in four moves. It is labelled **ILLUSTRATION** and the caption says it is not a recorded session, because a landing page is where projects start lying. |
| The language board | All thirty-three languages in their own scripts, as a hairline grid you can read at a glance. It used to drift sideways, which hid half of them and moved whether or not you asked; two columns on a phone, one picture on a projector. |
| `01`–`11` | The eleven screens as full-width square cards that stick together and share their borders, whole card clickable, inverting to white on hover — the zero-vast stack. |
| The numbers | Five figures and a link to re-run them. They are copied from `judge.html`, which `tests/judge-numbers.test.mjs` checks against the real offline simulator, so the chain ends in a command rather than in a slide. |
| Four steps | How an answer is actually produced: index on the device, retrieve, cite or decline, check by hand. |

It is reachable from the drawer (**The project → About this project**), from the
fine print on the login screen, from the judge page and from each legal page's
footer, and it links back into the app in fifteen places. Pure CSS motion, with
`prefers-reduced-motion` restoring every hidden element rather than leaving a
reader with an empty hero.

## Writing

Ten pieces live at `/blog`, because a study tool that only appears when someone
types a brand name is not much use to the student who has never heard of it.
Each one is a method, not a product tour:

| # | Piece | What it actually gives you |
| --- | --- | --- |
| 01 | How to check an AI answer before you trust it | Read the citation before the answer; find the sentence; the four ways an answer goes wrong; a five-minute weekly drill. |
| 02 | How to revise a chapter you have already forgotten | A blank page instead of the book, three piles with a pencil, read only the third pile, six minutes two days later. |
| 03 | How to study with only a phone | One stated job per session, aeroplane mode on purpose, one question per paragraph, the answer written by hand, one folder of three things. |
| 04 | Why writing your own questions beats re-reading | Five questions from one paragraph, the stems that do the work, put a number in it, ask the question that would fail you. |
| 05 | A fixed routine for physics numericals | Given with units, asked with units, a bad diagram, the relation before the numbers, symbol rearrangement, a size check, the unit on the answer. |
| 06 | How to explain a school project in sixty seconds | Five sentences in a fixed order, a test the judge can run, the limit said out loud, and what to say when you do not know. |
| 07 | Why your marks dropped in one chapter and not another | Find the exact sentence where understanding stopped; the three reasons a line stops making sense; the forty-minute repair. |
| 08 | How to answer a five-mark question | Five marks is five tickable things, not five sentences. The shape that earns all five, and the one line almost nobody writes. |
| 09 | How to prepare for a viva you were not expecting | Three sentences per topic, rehearsing the fourth "why", and the sentence to say when you do not know. |
| 10 | A demo that survives a power cut | Assume the connection fails; the four-minute test the morning of the fair; a paper version; making the judge drive. |

**What is deliberately not done.** No keyword stuffing, no pages written for a
crawler, no hidden text, no "AI tutor" articles that repeat the product name
forty times, no newsletter wall. The pages are plain files that open with the
network off and are in the offline cache like everything else. If the writing is
not good enough to be found on its own, adding more of it will not help.

**What is done for discovery**, honestly: a canonical URL on every page, a
description under 200 characters, `BlogPosting` structured data whose headline
and description must match the page (a test fails if they drift), an RSS feed, a
sitemap entry, and links in from the landing page, the app's drawer and the
judge page — so the pages are reachable by a person, which is the part a
crawler follows.

## Why the answer is on screen

The Ask screen is a conversation, so the newest answer appears where the student
is already looking. That sounds obvious; it was wrong for several releases. The
old code did one thing:

```js
log.scrollTop = log.scrollHeight;
```

Two defects in one line. It ran **once**, immediately after the messages were
appended, before a long answer had been laid out — so it landed short and the
answer sat below the fold. And when it did work, it landed on the **end** of the
answer, so the first thing a student read was the last paragraph.

Now (`js/chat-scroll.js`, tested in `tests/ask-scroll.test.mjs`):

| Behaviour | How |
| --- | --- |
| The answer's first line lands at the top of the reading area | `scrollForAnswer` puts the newest answer's top where the reading starts, with a 14px gutter, clamped to the real scroll range |
| It still lands right after the browser has finished laying out | the pin runs again after two animation frames, and a `ResizeObserver` re-pins when a font, an image or the typing hint changes the height |
| A reader who scrolled up to re-read is never yanked back | `isFollowing` measures whether they are within 140px of the bottom; if not, the pin is skipped |
| There is always a way back | a **↓ Newest answer** pill appears whenever the newest answer has drifted out of view, and resumes following when tapped |
| Sending a question resumes following | asking is a deliberate act, so the typing hint is pinned to the bottom |
| No layout, no movement | `readChatBox` returns null when the log is not on screen, and the pin does nothing rather than guessing |

The furniture gives way as well: on a phone, once there is a conversation, the
starter chips and the answer-style rows stand down, the log's top padding drops
from 72px to 58px (it exists for the logo, not for air), the greeting shrinks to
a greeting, and the log's own scroll is instant — a smooth animation started
while the answer is still being laid out is a scroll that can be cancelled
short, which is how it went wrong in the first place.

## Study loop

1. Import a PDF or notes you have permission to use in **Library**. Ask a question and open a citation to verify its actual page; the reader can search within the book.
2. In chat, say **“make a quiz on that”**, **“make flashcards on photosynthesis”**, or name a numbered chapter. The tools start immediately; a missing topic is not silently replaced with unrelated questions. “That” needs a recent cited library answer. There are also actions beneath each cited answer.
3. Finish the quiz, review each answer and make a cited flashcard deck from missed questions. The result studio, retry/practice action and past results remain accessible from Progress.
4. Return to **Flashcards** to switch decks and review cards due today. Practice-all does not change the review schedule. **Progress** suggests a useful next step.
5. For a model paper, upload text-selectable past papers in **Library**, open **Make a model question paper**, choose the sources and build. Review the source pages before downloading or printing. The preview lasts for the current tab; downloads are separate files.
6. Choose any of the 33 languages in the **Language** card at the top of **Settings** (Indian languages first, then world languages). Offline Bolt does not translate a book from one language to another; a connected model can be asked to answer in the chosen language, with possible mistakes.

Decks, detailed reviews and results remain in the browser, not in the account; only quiz summary statistics sync. The app warns when browser storage is unavailable or a write fails. JSON export includes saved decks, review schedules, history and book details, but excludes textbook pages, original PDFs and keys; keep originals separately.

## Student accounts, squad invites & leaderboard

After the intro, the entry screen offers **Log in** and **Register**, with **Continue as guest** below them. An existing session is restored automatically; guests can sign in later from the profile button (also visible on phones) or Progress. Guest books, chats, decks and detailed reviews stay in this browser and are not automatically moved to an account:

- **Register** asks for a public nickname, password and age; gender is optional. New passwords must be 10–128 characters and cannot be a short list of common choices. Existing shorter passwords still work for login. Password recovery is not yet available.
- Under-13 students are asked to confirm that they have a parent or guardian's permission. This checkbox is self-reported, not independently verified consent; schools must arrange appropriate consent and privacy safeguards before deploying to children.
- Registration sends the entered age to the server, which stores **only an age band** (`under-13`, `13-15`, `16-18`, `19+`), not the exact age. Gender is kept in the private profile and is omitted from the public leaderboard.
- The local demo backend hashes passwords with Node's built-in `scrypt`; Supabase Auth hashes passwords for Supabase accounts. Sessions use random `HttpOnly`, `SameSite=Lax` cookies, with `Secure` on HTTPS. Signing in again revokes the previous session cookie.
- Each account gets a referral code such as `VIGNAN-ANANYA`. An invite link containing `?ref=VIGNAN-ANANYA&view=progress` opens the register tab and credits the referring student.
- Quiz results sync XP, streak, best score, accuracy and recent topics to the account. The live leaderboard exposes only usernames and study stats — no password hashes, exact ages, genders, IDs or full history. Scores originate in the browser and can be manipulated, so the leaderboard is for practice rather than high-stakes assessment.
- The result **edit studio** can optionally include the student's squad code and nickname; both are hidden by default. When the squad option is enabled, a share caption can include the invite link too.

Account endpoints reflect `Origin` only for the same host/proto or origins listed in `STUDY_AI_ALLOWED_ORIGINS`; they never combine credentialed cookies with a wildcard origin. Account/progress POSTs require a same-origin request, a JSON body and a double-submit CSRF token. A client should first `GET /api/auth/me` with credentials, then send the `vignan_csrf` cookie's value in `X-CSRF-Token` on each account/progress POST. The browser handles this automatically. Login failure throttles are in memory per instance and reset on restart; they are not a replacement for a production distributed rate limiter.

Account API (same origin; legacy `/study-ai/api/...` aliases still work):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Reports `accounts: true` when the store is enabled. |
| `POST` | `/api/auth/register` | Create an account and session. |
| `POST` | `/api/auth/login` | Log in with username and password. |
| `POST` | `/api/auth/logout` | Clear the session. |
| `GET` | `/api/auth/me` | Current user or guest. |
| `GET` | `/api/leaderboard` | Public top-20 by XP and best score. |
| `POST` | `/api/progress` | Sync one quiz result (requires a session). |

Two backends are included:

- **Local JSON (default):** dependency-free file at `server/data/accounts.json`, intended for a school demo, LAN or local prototype. It is ignored by Git and never served as a static file. Sessions are in memory, so a restart logs students out.
- **Supabase (recommended for Render):** set `STUDY_AI_ACCOUNTS_BACKEND=supabase` plus `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable or legacy anon) and `SUPABASE_SERVICE_ROLE_KEY` (secret or legacy service-role). Apply **both** migrations in the Supabase SQL editor first — `supabase/migrations/20261027000000_vignan_ai.sql` (accounts, sessions, leaderboard, progress) and `supabase/migrations/20261028000000_vignan_social.sql` (friends, notifications, chat, games). `npm run sql:social` prints the second one with instructions. Supabase Auth handles password hashing; profiles, progress, referrals and sessions live in Postgres with row-level security, so Render's ephemeral filesystem and cold starts do not erase accounts. Supabase's free tier includes 50,000 monthly active users, a 500 MB database and 500,000 Edge Function invocations ([billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)), but free projects pause after a week of database inactivity.

When Supabase is requested but its URL or keys are missing or obviously invalid, accounts fail closed instead of silently creating non-persistent Render accounts; guest study remains available. `/api/health` reports the configured backend, not a live credential/connection test.

### When Friends, Chat or Play says the server could not complete the request

That message means the request reached the server and the social store could not answer. The usual cause is the second migration: login and the leaderboard use `vignan_ai.sql`, while friends, chat and games need the tables from `vignan_social.sql`. The app now diagnoses it instead of hiding it:

- Friends shows a sentence naming the fix, with a **Try again** button.
- The school project already has this migration applied; it is only needed when you start a new Supabase project.
- The server logs one line at boot and answers `503` with *"Friends, chat and games are not set up on this server yet…"* until the tables exist.
- `GET /api/health?social=1` returns `socialReady`, `socialCheck.missing` and `socialCheck.detail`.

### Avatars

Every student gets a monogram avatar: their initials over one of eight grey patterns, chosen by a hash of their username. It is decoration only — nothing is derived from age, gender or results, and there are no photo uploads, so there is no moderation problem and no extra storage. Students can open **Friends** and tap one of eight swatches to pin a favourite; that choice is saved to their social profile (`avatar_seed`) and classmates see it in the friends list and in Chat. Without a pin, the pattern is derived locally from the name, so even a brand-new row looks right immediately. Seeds are validated server-side against `p0`–`p7`, so a stored value can never inject markup.

### Adding friends

Open **Friends**. The empty tab has an **Add a friend** button, and the Find tab lists classmates you can add with one tap — no username needed. Anyone who has opened Friends, Chat or Play once appears there; only usernames, XP and streak are shown, never age, gender or exact results. Students who have never opened those screens are found by typing two or more letters of their username.

Fix: Supabase dashboard → **SQL Editor** → paste `supabase/migrations/20261028000000_vignan_social.sql` (or run `npm run sql:social` and copy the output) → **Run** → wait ten seconds → reload. With `STUDY_AI_ACCOUNTS_BACKEND=local`, the same check reports whether the JSON file under `server/data/` is writable — a read-only mount produces the same 503. For a larger public deployment, add verified guardian consent, account recovery, moderation, backups and distributed rate limiting. Never put the Supabase secret/service-role key in the browser, chat or Git.

---

## Using other AIs (the intended architecture)

Vignan Vidyanikethan AI does **not** train a model. It provides a task-based router over existing model APIs:

1. Open **Settings → Real local model** for a keyless on-device model, or **Settings → Model router** for hosted / desktop providers.
2. Pick a provider and fill in its endpoint, model name and (if needed) one or more of your own API keys (comma/newline separated — the browser rotates to the next key on quota errors). For WebLLM, choose and download a model instead. For a safer school-wide pool, put the keys in Render instead and leave this field empty.
3. Enable **“Use this provider for answers and quizzes now”**, or set each task's provider in the routing table (answers, quizzes, flashcards, grading, verification).
4. Optionally route **Short-answer grading** and **Citation verification** to a different model — a cheap local model can grade while a stronger model verifies claims.

Supported adapters:

| Provider | Kind | Notes |
| --- | --- | --- |
| Vignan free AI router | `server` | Recommended. Calls this site's `/api/ai`; the Node/Edge proxy tries free providers and keeps keys on the server. |
| Local open model | `webllm` | Bundled WebLLM in a Web Worker. Meta Llama 3.2 1B / SmolLM2 / Qwen2.5; no key, WebGPU required. |
| Ollama | `ollama` | Native `/api/chat`, defaults to `llama3.2:1b`, fully offline. |
| LM Studio | OpenAI-compatible | Local `http://localhost:1234/v1`. |
| OpenAI | OpenAI-compatible | Example model `gpt-4o-mini`. |
| OpenRouter | OpenAI-compatible | Defaults to `openrouter/free`; one key, many free/paid providers. |
| Groq | OpenAI-compatible | Defaults to `openai/gpt-oss-20b`; fast free-tier open-weight models. |
| Google Gemini | OpenAI-compatible | Defaults to `gemini-3.5-flash-lite` via Google's OpenAI-compatible endpoint. |
| Cloudflare Workers AI | OpenAI-compatible | Uses the account-scoped `/ai/v1` endpoint; 10,000 free Neurons/day. |
| Anthropic Claude | Native Messages API | Uses `x-api-key` and `anthropic-version`. |
| Arena AI | Anthropic-compatible | Uses `Authorization: Bearer`; requires a workspace API key, not a free-router key. |
| Mistral / Cohere / DeepSeek / Together | OpenAI-compatible | Mistral Free mode and Cohere trial keys are wired into the server router; bring your own model name for the others. |
| Custom | OpenAI-compatible | Any `/chat/completions` endpoint. |

> **Browser API keys:** direct browser calls to cloud providers may be blocked by CORS, and a key typed into a shared computer is visible to that browser. For a school deployment, configure the server proxy instead. Browser provider keys and student BYOK keys are stored only in this browser's IndexedDB, are excluded from exports, and never go to the public leaderboard. Student BYOK keys are also validated against official provider hosts before the server will call them.

---

## Configuring the free AI router / server proxy

`serve.mjs` is zero-dependency. It serves the static site, proxies AI calls to configured providers, provides a keyless Wikipedia fallback by default, reads explicitly requested public links, and serves the account API. Web fallback can send unmatched questions to Wikipedia without any environment variables; turn it off in the composer or server configuration when unwanted.

The easiest zero-budget start is one free key:

```bash
STUDY_AI_GEMINI_KEY='your-google-ai-studio-key' npm start
# or
STUDY_AI_GROQ_KEY='your-groq-key' npm start
```

Add more providers and the router will fall through them automatically. You can also add **several keys per provider** in one variable — separate them with commas or newlines, or use the plural alias. Vignan creates one upstream per key and rotates to the next one when a key is rate-limited:

```bash
STUDY_AI_GEMINI_KEY='gemini-key-1,gemini-key-2' \
STUDY_AI_GEMINI_KEYS='gemini-key-3
gemini-key-4' \
STUDY_AI_GROQ_KEYS='groq-key-1,groq-key-2' \
STUDY_AI_KEY_COOLDOWN_MS=60000 \
npm start
```

For a full multi-provider pool:

```bash
STUDY_AI_GEMINI_KEY='...' \
STUDY_AI_GROQ_KEY='...' \
STUDY_AI_CLOUDFLARE_ACCOUNT_ID='...' \
STUDY_AI_CLOUDFLARE_TOKEN='...' \
STUDY_AI_OPENROUTER_KEY='...' \
STUDY_AI_MISTRAL_KEY='...' \
STUDY_AI_COHERE_KEY='...' \
STUDY_AI_FREE_ROUTER_ORDER='gemini,groq,cloudflare,openrouter,mistral,cohere,arena,primary' \
npm start
```

If you later have an **Arena workspace API key** (not a free-router key), add
`STUDY_AI_ARENA_KEY=...` and put `arena` first in `STUDY_AI_FREE_ROUTER_ORDER`.
The same `/api/ai` endpoint is also available as a Supabase Edge Function under
`supabase/functions/vignan-ai/`.

### Health check

```bash
curl http://localhost:4173/api/health
# {"ok":true,"ai":true,"aiProviders":["gemini","groq"],"freeRouter":true,
#  "accounts":true,"accountsBackend":"local","offlineReady":true,"localAI":{"bundled":true},...}
```

Add `?social=1` to check the friends database, which is otherwise only exercised when a student opens the Friends, Chat or Play screen:

```bash
curl -s http://localhost:4173/api/health?social=1 | python3 -m json.tool
# "social": "supabase", "socialReady": true, "socialCheck": {"ok": true, "detail": "7 tables"}
# or  "socialCheck": {"ok": false, "missing": ["social_profiles", ...]}
```

Legacy `/study-ai/api/health`, `/study-ai/api/ai`, `/study-ai/api/search`, `/study-ai/api/auth/*`, `/study-ai/api/leaderboard` and `/study-ai/api/progress` aliases are still accepted for older bookmarks, but the PWA now lives at the site root.

### Study sheets and today's revision

Two academic helpers sit on top of the pages you already have. Neither one
calls a model, so neither can invent a fact.

**Cited study sheets.** Ask for revision instead of an explanation — *"key terms
of chapter 3"*, *"formula sheet for motion"*, *"important dates in Indian
history"* — and the answer becomes a sheet built only from the matched book
pages: key terms with their definitions, formulas and relations, and years,
each with its page number. The sheet can be copied with its citations or saved
as a `.md` file so it can be printed or pasted into a notebook. When the pages contain no definitions, formulas or dates the
sheet says so rather than filling the gap.

**Today's revision.** The Progress screen shows at most three short steps,
chosen from real data on the device: flashcards that spaced repetition says are
due, the topic with the weakest quiz average, and a keep-warm quiz only when
nothing is due. Each step shows its reason and an estimated number of minutes,
and the plan can be copied as plain text. With no history at all it suggests one
first step instead of an empty panel.

Pure modules, so both are unit-tested without a browser:

- `js/study-sheet.js` — `asksForStudySheet`, `studySheetTopic`, `buildStudySheet`, `studySheetMarkdown`
- `js/revision-plan.js` — `buildRevisionPlan`, `revisionPlanText`

### Answer length, follow-ups and citation honesty

Three additions make the chat behave like a teacher rather than a search box,
and all three work with the offline engine too.

**Answer length.** Next to *Answer style* in the composer, *Answer length*
offers **Brief** (about 80 words), **Balanced** (110-180 words with short steps)
and **Exam** (a model exam answer: definition, numbered key points, a formula or
example only if the passage has one, and an examiner note). The choice is stored
in settings and sent to the connected model as an explicit length directive; the
extractive engine ignores it because it can only quote what the page says.

**Next chips.** After an answer built from real pages, the suggestion row offers
the next useful move: *Explain step by step*, *Model exam answer*, or *Quiz me
on this*. They reuse the same pipeline, so a follow-up is grounded exactly like
the first answer. *Key terms sheet* appears only when no sheet was already made.

**Books beat the built-in notes.** Answers now always try the student's own
pages first. The built-in topic notes and the quick-fact pack are fallbacks for
topics no uploaded page covers, so a chapter the student added is never
skipped in favour of generic notes.

**Citation honesty.** A long model answer with fewer than half of its sentences
carrying a citation is not presented as grounded: a short note is added asking
the student to check the sources panel. Short answers are exempt — one sentence
cannot be "mostly uncited".

Pure module: `js/answer-quality.js` (`depthDirective`, `citationCoverage`,
`looksUncited`, `followUpsFor`).

### Pro Mode (easter egg)

Say who you are in the Ask box — **"I am Nezaad"**, "this is Nezaad", "my name
is Nezaad", "Nezaad here", "you are talking to Nezaad", "main Nezaad hoon",
"nenu Nezaad", or the full "I'm Nezaad from Nezaad Industries". Any sentence
that introduces you as Nezaad works: punctuation, capitalisation and polite
filler do not matter, and the usual misspellings (Nezad, Nezaaad) are accepted.
A *question* about Nezaad Industries — "what is Nezaad Industries?" — is still
answered normally, because asking about a subject is not the same as naming
yourself.

The screen then boots a four-beat HUD sequence: the reticle wakes and a radar
wedge starts sweeping, boot lines type out one at a time with a live phase label
and a progress bar (every line is a real number from your own device), the
title assembles letter by letter as the frame flashes once and locks on, then
the iris closes. The assistant introduces itself as **V.I.G.N.A.N.**, a
JARVIS-style interface wrapped around the same cited engine. Pro Mode is
skippable (click, Esc, Enter, or *Skip*) and stays on across reloads. An
introduction can carry a question — "I am Nezaad, explain photosynthesis" boots
the sequence and then answers it — and it adds:

- a briefing with the live readout: books and pages indexed, decks, cards due,
  answer route, streak and accuracy;
- **status report** or **run diagnostics** for a fresh readout at any time;
- **power down** (or clicking the ◆ PRO chip in the top bar) to return to Bolt.

The persona changes voice and chrome only. Every answer still comes from the
same retrieval, with the same citations, and nothing is invented — if the pages
do not contain it, Pro Mode says so too. Reduced-motion users get a cross-fade
instead of the animation. `js/pro-mode.js` is pure logic, `js/pro-ui.js` runs
the sequence, and `styles-pro.css` styles it.

### Publishing is the whole gesture

There is no update button, no banner and no "Later". A new release installs, the
worker takes over immediately (`skipWaiting`, then `clients.claim`), and the page
reloads itself once. Publishing reaches every device the next time it is open —
which is how a website is supposed to behave, and the reason the old permission
dance was removed: it only ever existed for offline users, and it slowed *them*
down rather than helping.

One courtesy is kept, and it is a delay rather than a question: a reload never
lands on top of the student's own work. The watcher waits while an answer is
being written **and** while a question sits in the box unsent, then reloads by
itself once the box is empty. A hidden tab reloads at once.

`Settings → App & offline` shows the current release, whether the offline copy is
complete, and a **Check offline readiness** button. That is all that card does
now: there is nothing to press to get a new version.

- `js/updates.js` — `parseCacheVersion`, `isNewer`, `shouldReloadNow`, `startUpdateWatch`
- `sw.js` — the only thing that calls `skipWaiting()`, in `install`

### Testing the offline version

Two ways, one automated and one by hand.

**Automated — no browser needed.** `tools/offline-sim.mjs` loads the real
`sw.js` in a sandbox with a Cache Storage implementation and a `fetch` that reads
the repository the way the server would. It installs the worker, turns the
network off, and asks for every core file and every module of the release.

```bash
npm run offline:check
```

```
Release v33
Cached after install: 372 files in vignan-vidyanikethan-ai-v33
  ok  200   75099 B  ./
  ok  200   166698 B  ./js/app.js?v=18
  ...
Navigation fallback offline: ok (75099 B of index.html)
Uncached file while offline: 503 with a clear message (correct)
OFFLINE CHECK PASSED
```

It is also a test (`tests/updates-security.test.mjs`), so `npm test` fails if a
new module is missing from the cache — this is exactly how `updates.js` and
`offline-check.js` were caught missing on the first run.

**By hand, in the browser.**

1. Open the deployed app once while online and wait a few seconds.
2. Go to **Settings → App & offline** and press **Check offline
   readiness**. It should read *Ready · N/N files*.
3. Open DevTools → Network → **Offline** (or switch the phone to aeroplane mode
   and reload).
4. Ask a question about a chapter you already added: it answers with page
   citations. Ask *"key terms of …"*: the sheet is built. Open Quiz, Flashcards
   and Progress: the revision plan is there. Type the Pro Mode phrase: it boots.
5. The web-fallback switch no longer offers dead links — the answer says the
   search was skipped because you are offline.

### Security and legal pages

| Page | What it covers |
| --- | --- |
| `privacy.html` | what stays on the device, what is sent where, choices |
| `terms.html` | acceptable use, accounts, limits of a student project |
| `security.html` | protections in place, what is deliberately not collected, limits, private disclosure, DPDP Act 2023 rights |
| `copyright.html` | no textbook is bundled or hosted, how quotations are used, takedown route |
| `/admin` | **operator console** (off unless `STUDY_AI_ADMIN_TOKEN` is set): account records, search, JSON/CSV backup, audit trail. Cannot read passwords, books, chats or answers; cannot sign in as anyone |
| `/setup` | live setup check (server-generated): which Supabase variable is missing, and whether each key has the right *shape* — never the value |
| `judge.html` | **Judge mode** — what this is and is not, two tests a judge can run in a minute, the FAQ, and the honest limitations |
| `SECURITY.md` | the same policy in repository form, for GitHub |
| `.well-known/security.txt` | machine-readable contact, policy and expiry |
| `robots.txt`, `sitemap.xml` | crawling rules and the public pages |

Judge mode is linked from the app footer, every legal page and the sitemap, so
it is one tap away when someone is standing at the table: the citation test, the
offline test, the questions judges ask and the limits are all on one page.

`CHECKLIST.md` is the other half of that: a printable pass/fail sheet for a real
phone, tablet and laptop, covering first impression, citations, the study loop,
social, permissioned updates, aeroplane-mode offline and polish. The automated
suite proves the code runs; only a human can see that a screen looks right.

Server-side hardening in `serve.mjs`: HTTPS-only HSTS, a strict CSP (no inline
scripts, no outside scripts, `object-src 'none'`), `nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a narrow
`Permissions-Policy`, `Cross-Origin-Resource-Policy: same-origin`,
`Cross-Origin-Opener-Policy: same-origin-allow-popups` and
`X-Permitted-Cross-Domain-Policies: none`. Every JSON response shares the same
base headers. Framing is deliberately **not** restricted, because the Arena live
preview embeds the page; clickjacking is instead limited by CSRF tokens,
same-origin checks on every mutation and JSON-only writes.

### Offline behaviour of the newest features

The service worker precaches every module, so the whole study loop is available
with no connection:

| Feature | Offline |
| --- | --- |
| Cited answers from saved books | Yes — retrieved from IndexedDB |
| Cited study sheets | Yes — built locally from the matched pages |
| Today's revision | Yes — computed from local decks and results |
| Flashcards, quizzes, evaluation | Yes |
| Exam practice: mocks, drills, coverage | Yes — exam patterns are local data; questions come from your saved pages |
| Starter shelf pages | Yes — bundled with the app and installed on first open |
| Viva practice and report card | Yes — the examiner's rules are local code |
| Reading aloud | Yes on devices with a local voice; a browser that needs to download a voice says so |
| Speaking your answer | Needs a connection in most browsers; the microphone button explains that and typing always works |
| Pro Mode and its briefing | Yes — no network call |
| Web fallback | Skipped, and the answer says so instead of offering a dead link |
| Friends, Chat, Play, leaderboard | Needs the server; the UI explains that |

`tests/offline-coverage.test.mjs` fails the build if any imported module, script
or stylesheet is missing from the worker's cache list — the quiet failure mode
where a feature works online and breaks the moment a judge turns off Wi-Fi.

### Ollama, fully offline

```bash
STUDY_AI_AI_BASE_URL=http://127.0.0.1:11434/v1 \
STUDY_AI_AI_MODEL=llama3.2:1b \
npm start
```

Or use Ollama's native API:

```bash
STUDY_AI_AI_KIND=ollama \
STUDY_AI_AI_BASE_URL=http://127.0.0.1:11434 \
STUDY_AI_AI_MODEL=llama3.2:1b \
npm start
```

### OpenAI-compatible provider

```bash
STUDY_AI_AI_BASE_URL=https://api.openai.com/v1 \
STUDY_AI_AI_MODEL=gpt-4o-mini \
STUDY_AI_AI_KEY=sk-... \
npm start
```

### Anthropic Claude

```bash
STUDY_AI_AI_KIND=anthropic \
STUDY_AI_AI_BASE_URL=https://api.anthropic.com/v1 \
STUDY_AI_AI_MODEL=claude-3-5-haiku-latest \
STUDY_AI_AI_KEY=... \
npm start
```

### Extra upstream headers

```bash
STUDY_AI_AI_EXTRA_HEADERS='{"HTTP-Referer":"https://school.example","X-Title":"Vignan Vidyanikethan AI"}' npm start
```

### Web fallback and public links

For new installations, the composer’s **Search the web if needed** switch is on. If local books have no match, `/api/search` queries, without any key, the Wikipedia edition for the selected interface language (any of the 33 offered languages that has an edition), the DuckDuckGo Instant Answer API and, as a last resort, Simple English Wikipedia. The server then reads up to two result pages (`STUDY_AI_SEARCH_READ_PAGES`, default 2) so the answer can quote a real passage instead of a two-line snippet; every result is shown with a `[Wn]` link and the providers that produced it. This is still an outside fallback, **not a verified answer key**, and it can fail, rate-limit or return irrelevant/incomplete material. A recent conversational topic may be included in the search query. The student can switch this off in the composer; existing stored choices are not overridden. Questions that match textbooks stay local unless a connected AI was explicitly configured. Avoid entering personal or sensitive information.

Operators can set `STUDY_AI_WIKIPEDIA_SEARCH=false` to disable the built-in provider, or configure an optional JSON endpoint with a `{q}` placeholder. A configured `STUDY_AI_SEARCH_URL` takes precedence and can use `STUDY_AI_SEARCH_TOKEN` / `STUDY_AI_SEARCH_TOKEN_HEADER`. The server normalises common JSON shapes and caps search response size. The public provider may have its own use and privacy policies; check them before classroom deployment.

Paste a public `http`/`https` URL in Ask to quote an excerpt without adding it to the library, or use **Library → Import a public link** to keep its extracted text on the device. The server retrieves the URL without forwarding student cookies or credentials and labels the resulting source as a web import. Only public network addresses and standard ports are allowed; DNS and every redirect are rechecked and the connection is pinned to an approved address. Downloads are capped at 12 MB, 3 redirects and 15 seconds; compressed HTTP responses are rejected. PDF text extraction is capped at 800 pages and approximately 4 million characters; text and HTML files are capped at 4 MB. HTML is converted to plain text without constructing or executing a DOM. Scripts, executables, archives and common binary signatures are rejected rather than opened. These safeguards are not a malware scanner or a guarantee that a PDF is harmless. Login-only, signed/private links, complex JavaScript-rendered pages, scanned PDFs and some encodings are unsupported. Links and search queries go to the site server and outside services, even if the rest of the library stays on the device; never paste private links or secrets.

### All environment variables

All variables also accept the new `VIGNAN_AI_` prefix as an alias, e.g. `VIGNAN_AI_GEMINI_KEY`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `STUDY_AI_HOST` | `0.0.0.0` | Bind host. |
| `STUDY_AI_PORT` / `PORT` | `4173` | Bind port. |
| `STUDY_AI_FREE_ROUTER` | `true` | Set `false` to use only the first configured provider. |
| `STUDY_AI_FREE_ROUTER_ORDER` | `gemini,groq,cloudflare,openrouter,mistral,cohere,arena,primary` | Comma-separated provider fallback order. |
| `STUDY_AI_KEY_COOLDOWN_MS` | `60000` | How long a quota-limited key is skipped before retry. |
| `STUDY_AI_STUDENT_KEY_FALLBACK` | `true` | Set `false` to disable student-owned keys school-wide. |
| `*_KEY` / `*_KEYS` / `*_TOKEN` / `*_TOKENS` | empty | Every key variable accepts multiple comma/newline-separated values; plural aliases are merged and deduplicated. |
| `STUDY_AI_GEMINI_KEY` / `_MODEL` / `_ENDPOINT` | empty / `gemini-3.5-flash-lite` / Google endpoint | Gemini free-tier key pool and model. |
| `STUDY_AI_GROQ_KEY` / `_MODEL` / `_ENDPOINT` | empty / `openai/gpt-oss-20b` / Groq endpoint | Groq free-tier key and model. |
| `STUDY_AI_CLOUDFLARE_ACCOUNT_ID` / `_TOKEN` / `_MODEL` | empty / empty / `@cf/openai/gpt-oss-20b` | Cloudflare Workers AI free Neurons. |
| `STUDY_AI_OPENROUTER_KEY` / `_MODEL` / `_ENDPOINT` / `_REFERER` | empty / `openrouter/free` / OpenRouter endpoint / repo URL | OpenRouter free models. |
| `STUDY_AI_MISTRAL_KEY` / `_MODEL` / `_ENDPOINT` | empty / `open-mistral-nemo` / Mistral endpoint | Mistral Free mode. |
| `STUDY_AI_COHERE_KEY` / `_MODEL` / `_ENDPOINT` | empty / `command-r-08-2024` / Cohere compatibility endpoint | Cohere free trial key. |
| `STUDY_AI_ARENA_KEY` / `_MODEL` / `_ENDPOINT` | empty / `coding-router-preview` / `https://api.arena.ai` | Optional Arena workspace API key. |
| `STUDY_AI_AI_BASE_URL` / `_MODEL` / `_KEY` / `_KIND` / `_EXTRA_HEADERS` | legacy single upstream | `openai`, `ollama`, `anthropic` or `arena`. Also appears as `primary` in the router order. |
| `STUDY_AI_WIKIPEDIA_SEARCH` | `true` | Set `false` to disable the default keyless Wikipedia fallback. |
| `STUDY_AI_SEARCH_URL` / `_TOKEN` / `_TOKEN_HEADER` | empty / empty / `Authorization` | Optional JSON search provider overriding Wikipedia. |
| `STUDY_AI_ACCOUNTS_BACKEND` | `local` | `local` or `supabase`. |
| `STUDY_AI_ACCOUNTS_FILE` | `server/data/accounts.json` | Local JSON account store path. Ignored by Git and blocked from static serving. |
| `STUDY_AI_SUPABASE_EMAIL_DOMAIN` | `students.vignanvidyanikethan.org` | Synthetic email domain for username/password Supabase Auth. No real emails are sent. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | empty | Supabase project URL, publishable/legacy anon key, and secret/legacy service-role key. The latter is server-only. |
| `STUDY_AI_COOKIE_SECURE` | auto | Set `true` to force `Secure` session cookies behind HTTPS. |
| `STUDY_AI_ALLOWED_ORIGINS` | empty | Comma-separated extra origins allowed to call account endpoints with cookies. Same-origin requests work without this. |
| `STUDY_AI_TRUST_PROXY` | auto on Render | Set `true` only behind a trusted proxy that appends the real client address; used for in-memory rate limits. |
| `STUDY_AI_AI_RATE_LIMIT` / `STUDY_AI_SEARCH_RATE_LIMIT` | `60` / `30` | Proxy requests per IP per minute. Limits are per instance, reset on restart and can be adjusted for shared school networks. |

Local WebLLM needs **no environment variable**. The model choice is stored in the browser's IndexedDB settings; the runtime is a static file under `vendor/webllm/`.

---

## How grounding works

```
PDF / readable text / user-imported web pages / pasted notes
        │
        ▼
Page-preserving chunks  ──►  cached hashed TF-IDF vectors + BM25 stats
        │                              (IndexedDB)
        ▼
Hybrid retrieval (top-k passages with page numbers)
        │
        ├──► offline engine: quoted, cited excerpts  (always available)
        │
        └──► model router: short page-labelled context ──► existing AI
                                      │
                                      ▼
                         answer + [n] citations ──► verifier model (optional)
```

The system prompt forbids answering from memory, requires `[n]` citations and treats passages as data, not instructions. User-imported web sources retain their origin and are labelled. On a miss, optional outside excerpts (Wikipedia in the chosen language, DuckDuckGo, Simple English Wikipedia) use separate `[Wn]` links, and questions about the school or the project are answered from a small built-in reference instead of being refused. Recent follow-ups reuse a bounded prior student topic; Bolt does not generate or remember like a large language model.

A retrieval example using a test-only synthetic fixture (not included in the app):

```bash
node --input-type=module -e "
import fs from 'node:fs';
import { buildBookIndex, retrieve } from './js/retrieval.js';
const i = buildBookIndex({ id: 'demo', title: 'Demo' }, fs.readFileSync('./tests/fixtures/sample-study.txt', 'utf8'));
console.log(retrieve('Why do leaves look green?', [i]).hits[0].page); // 3
console.log(retrieve('State Newton second law', [i]).hits[0].page);   // 6
"
```

---

## Adding your real textbooks

Only add material you have permission to use with this retrieval application. No Telangana SCERT or NCERT textbooks are bundled or indexed by default: publisher permission is required before adding those books to this service. The official NCERT textbook portal describes its software and linking restrictions; SCERT copyright notices reserve storage in retrieval systems.

- **PDF:** selectable text works via a vendored, patched PDF.js build. Page numbers come from the PDF itself. Local PDFs are limited to 800 pages / 40 MB and around 4 million extracted characters; the original PDF is kept locally (up to 20 MB) so citations can open it at the exact page. Remote downloads are limited to 12 MB.
- **Scanned PDFs:** images only. Run OCR first or upload a TXT version — the app will tell you when no text is found.
- **Readable UTF-8/UTF-16 text / pasted notes:** TXT, Markdown, CSV, JSON and other text formats are accepted up to 4 MB. Put `[[page:12]]` on its own line before each page's text. `--- Page 12 ---` and `Page 12:` also work. Without markers, long documents are split into approximate 420-word pages.
- Markdown `# Heading` lines become chapter/section labels and are removed from quiz blanks. Imported webpages/text use approximate sections rather than claimed original page numbers.
- **Not supported:** executable or script extensions, shebang scripts, archives, DOCX and other packaged formats, binaries, scanned PDFs and login-only/private links. File-name and signature checks reduce risk but do not replace a malware scanner.

After adding files, run `npm run precache` if you changed anything inside the app root so the service worker caches the new assets.

---

## Tests

```bash
npm test
```

615 Node tests cover page parsing, chunking, stemming, hybrid retrieval, grounded answers, quiz generation and grading, flashcard scheduling, streaks, provider adapters, prompt context, JSON extraction, web-result parsing, performance-card drawing, the permission-gated update flow, offline readiness, the service worker cache manifest, the legal pages, response compression (encoding negotiation, cache keys, and a spawned server proving a page arrives smaller and decodes back to the same bytes), the reading-position and shortcut arithmetic, the growing composer, and the server's security posture.

Everything at once — regenerate the cache manifest, run the suite, then prove the release works with the network off:

```bash
npm run check
```

`npm run check` runs, in order: the secret scanner, the precache generator, the
tests and the offline simulation. `npm run secrets` runs the scanner alone — it
reads every tracked file, recognises the shape of Supabase, Google, OpenAI,
GitHub, Slack, Cloudflare and AWS credentials, prints only a truncated hint
(`sb_secre…Bv3e`) so a report can be shared safely, and exits non-zero if
anything looks live. A key that reaches a public repository must be revoked, not
deleted, because the history keeps it.

### The design rules, checked rather than remembered

The interface is audited with [`impeccable`](https://github.com/pbakaus/impeccable)
(`npx impeccable@4.8.0 detect`), a deterministic detector for UI anti-patterns —
not a model, and not connected to the answer pipeline. On its first full pass this
site reported 409 findings; what it found has been fixed, and the rules a tool
cannot enforce once it is uninstalled are ordinary tests in
`tests/design-rules.test.mjs`:

- nothing below the 11px text floor (`font-size` and the `font` shorthand),
- no thick accent bar down one side of a card, and no inset side stripe,
- no repeating-gradient stripes and no tiled two-axis grid background,
- no chromatic glow shadow (zero offset, blurred, on a coloured value),
- Pro Mode drawn in ink rather than neon, with its scan, reticle and letter beats kept,
- the language band a wrapped grid of all thirty-three, with nothing moving on its own,
- no tracked-caps chip above a headline and no halo behind one.

Suppressions live in `.impeccable/config.json`, one entry per decision, each with a
written reason, so nothing is silenced anonymously. Four findings stay visible
instead of suppressed: the app's own full-bleed frames (`gate-tabs`,
`gate-optional`, `chat-shell`, `settings-tabs`), where children meeting the shared
hairline is the layout, not an accident.

A separate DOM smoke run (jsdom + fake IndexedDB) was used during development to verify first launch, adding notes, asking a question, generating a quiz, viewing results and opening the performance-card modal. Those harness dependencies are intentionally not added to this zero-dependency repository.

---

## Project structure

```
index.html                Vignan Vidyanikethan AI app shell / PWA entry
styles.css                Base responsive dark/light UI
styles-premium.css        Minimal workspace and study components
styles-identity.css       Sharp identity, local fonts and startup screen
styles-legal.css          Offline-friendly legal pages
privacy.html, terms.html  Student-facing policies (operator review required)
assets/                   User-supplied Vignan AI/Nezaad marks and licensed local fonts
LOCAL_AI.md               Real local WebLLM model guide
DESIGN.md                 The visual law, and the rules it deliberately breaks
manifest.webmanifest      PWA manifest
robots.txt, sitemap.xml   Search-engine crawling and canonical-page sitemap
sw.js                     Offline service worker
precache.json             Generated offline asset list
tests/fixtures/           Synthetic test data, not shipped as a book
icons/                    SVG + PNG app icons (including maskable icons)
vendor/webllm/            Vendored WebLLM 0.2.85 runtime (Apache-2.0)
vendor/pdfjs/             Vendored PDF.js (Apache-2.0)
vendor/qr/                Vendored on-device QR generator (MIT)
js/                       Browser ESM app modules
  startup.js              Skippable once-per-tab intro and focus handling
  boot.js                 Lightweight login/register/guest entry screen
  app.js                  UI controller
  auth.js                 Account API client + account modal
  password-policy.js      Shared password checks for new accounts
  ingest.js               Lazy-loaded PDF/text ingestion
  files.js                Bounded file classification and inert HTML text extraction
  link-reader.js          Public URL download and text/PDF extraction
  conversation.js         Creator intent and bounded follow-up context
  external-answer.js      Labelled web/link excerpt citations
  text.js                 Page parsing, sentences, chunks
  vector.js               Cached hashed TF-IDF vectors
  retrieval.js            Hybrid search + grounding decision
  answer.js               Offline cited-answer composer
  context.js              Shared prompts and JSON helpers
  providers.js            Adapters for existing AI services (incl. WebLLM and Arena AI)
  local-ai.js             WebLLM manager, model catalogue and Vignan's local rules
  local-ai-worker.js      Web Worker that owns the MLCEngine
  free-apis.js            Official free-tier key signup links (no keys bundled)
  model-router.js         Task routing, verification, AI grading
  llm.js                  Answer / quiz / flashcard model orchestration
  quiz.js                 Quiz writer and grader
  flashcards.js           Cards + Leitner scheduler
  study-decks.js          Persistent decks, mistake cards and next steps
  progress.js             Streaks, mastery, leaderboard
  web.js                  Optional labelled web fallback
  card.js                 Funky edit video / PNG poster canvas
  db.js                   IndexedDB persistence
  settings.js             Defaults and health checks
  i18n.js                 Interface dictionary loader and long-form English/Telugu/Hindi text
  languages.js            33-language catalogue, RTL flags and Wikipedia mapping
  translations-core.js    Core labels for every catalogue language
  knowledge.js            Built-in answers about the school, the project and evergreen facts
  ui.js, reader.js        DOM helpers and page reader
tests/                    Node test suite
serve.mjs                 Zero-dependency static + free AI/search/account server
server/free-router.mjs    Zero-budget multi-provider AI fallback
server/accounts.mjs       Local scrypt accounts, referrals, progress, leaderboard
server/supabase-accounts.mjs Supabase Auth + Postgres account store
server/data/              Local account JSON store (ignored by Git)
supabase/migrations/      SQL schema, RLS, triggers and session helpers
supabase/functions/vignan-ai/ Optional Edge Function alternative to Render API
tools/                    Precache/icon generators
render.yaml               Render free web service blueprint
.env.example              All environment variables (copy, do not commit secrets)
package.json              start / test / precache scripts
LICENSE                   MIT
README.md                 This file
DEPLOY.md                 Exact Render + Supabase deployment steps
```

---

## Repository name

The GitHub repository is now **Techno-projects-cpu/Vignan-Vidyanikethan-AI**. The old `Vignan-Vidyanikethan-E.M.-School` URL redirects here, so existing bookmarks and Render deploy hooks keep working. The in-repo package name is `vignan-vidyanikethan-ai` and all user-facing branding is **Vignan Vidyanikethan AI**.

If a local checkout still points at the old URL, run:

```bash
git remote set-url origin https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI.git
```

---

## Created Supabase project

A free Supabase project has already been created and the schema migration applied:

- **Name:** `Vignan-Vidyanikethan-AI`
- **Ref / URL:** `dwmzbrrnqxzdoxrxbrna` → <https://dwmzbrrnqxzdoxrxbrna.supabase.co>
- **Region:** `ap-south-1` (Mumbai, close to Andhra Pradesh)
- **Migration:** `20261027150656_create_vignan_ai_schema`
- **Auth:** email signup enabled, `mailer_autoconfirm` on (no real emails are sent for synthetic student accounts)

Copy the **publishable** key into `SUPABASE_ANON_KEY` and the **secret** key into `SUPABASE_SERVICE_ROLE_KEY` in Render. The latter is private; never put it in a browser, chat or Git. Legacy anon/service-role JWTs are also supported for migration. See `DEPLOY.md` for setup, rotation and verification steps.

---

## Deployment notes — $0 with Render + GitHub + Supabase

Recommended free architecture:

```
GitHub repo  ──auto-deploy──►  Render free web service (serve.mjs)
                                   │
        your own free AI keys ─────┤──► Gemini / Groq / Cloudflare / OpenRouter / Mistral / Cohere / Arena
                                   │
                                   └──► Supabase Auth + Postgres (profiles, sessions, leaderboard)

Student browser ──WebGPU──► Bundled WebLLM open-weight model (keyless, offline after download)
             └────────────► Offline cited-excerpt engine (always available)
```

1. **Push this branch to GitHub.** Render deploys from the repo using `render.yaml`.
2. **Create a free Supabase project** (Mumbai/`ap-south-1` is closest to Andhra Pradesh). Run `supabase/migrations/20261027000000_vignan_ai.sql` in the SQL editor. Note that Supabase free projects pause after a week of database inactivity and have a 500 MB database ([billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)).
3. **In Render → Environment**, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally one or more free AI keys generated from your own accounts (`STUDY_AI_GEMINI_KEYS`, `STUDY_AI_GROQ_KEYS`, etc. — comma/newline separated). Set `STUDY_AI_ACCOUNTS_BACKEND=supabase`, `STUDY_AI_COOKIE_SECURE=true`, `STUDY_AI_KEY_COOLDOWN_MS=60000` and `STUDY_AI_STUDENT_KEY_FALLBACK=true`. No key is required for the local WebLLM model; students can add their own keys in Settings when the Render pool is exhausted.
4. **Reload the app.** When `/api/health` reports `ai:true`, enable the server route in **Settings → Advanced settings** if desired. Bolt remains the default; students can instead enable a local model. If providers fail, the offline engine still answers from the library.
5. **Optional:** deploy `supabase/functions/vignan-ai/` as a Supabase Edge Function and point the `server` provider endpoint at it instead of Render's `/api/ai`. This can avoid Render's cold start for AI calls; the free tier includes 500,000 function invocations/month.

Render free web services sleep after ~15 minutes of inactivity, share 750 instance-hours/month, and its free Postgres expires after 30 days ([Render free-tier notes](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)). That is why Supabase — not Render Postgres or the local JSON file — should hold accounts on a public deployment. Static files on Render Static Sites do not sleep, so a static frontend + Supabase Edge Function is the most always-on $0 option if you later split the app.

Other notes:

- **Static hosting / GitHub Pages:** the offline app works from the site root, but the server API will not exist; use the local WebLLM model, direct provider endpoints (with CORS support), the Supabase Edge Function, or the offline engine.
- **School LAN / desktop:** run `npm start` on one machine and open `http://<lan-ip>:4173/`. With WebLLM cached or Ollama configured, no internet is needed after setup.
- **Offline first load:** service workers require HTTP/HTTPS. Open the app once while the server is reachable; afterwards the app shell, bundled WebLLM runtime, books you added, PDF.js and cached vectors remain available offline. Model weights download separately on first use.
- **Edit videos:** The 8-second edit and optional original synth beat are generated locally. Choose **Create my video**, keep the tab open, then tap **Download** or **Share**. MP4 and audio support vary by browser; WebM, silent recording or a PNG poster are fallbacks. 540p is the fastest option on many phones, 720p is the default and 1080p is optional. A locally generated QR linking to Zero Vast is on by default and can be disabled under **More options**. Nickname and invite code are opt-in; the score and topic appear in the video and copied caption. Reduced motion is enabled by default if the device requests it.

---

## Search indexing and the AI logo

The supplied AI mark has been redrawn as the reusable transparent SVG at `assets/brand/vignan-ai-mark.svg`. Browser favicons and separate mask-safe installed-app icons are in `icons/` (with a legacy `favicon.ico` at the root). All are served locally.

`robots.txt`, `sitemap.xml`, canonical links and social-preview metadata point to the current Render site. To request indexing, verify `https://vignanvidyanikethanai.onrender.com/` in Google Search Console and submit `https://vignanvidyanikethanai.onrender.com/sitemap.xml`. Search engines decide whether and when to index pages or refresh a favicon; submission is not a guarantee. If you move to a different public domain, update the URLs in those files and in the page metadata first.

---

## Privacy

The in-app [privacy policy](./privacy.html) and [terms of use](./terms.html) are accessible before registration and from Settings and the menu. **Before a public deployment, the operator should review both with appropriate legal guidance, add a real contact channel, set retention/deletion procedures, and arrange any required parental consent.** The current under-13 checkbox is self-attested and there is no self-service account deletion.

- Books, page text, vectors, chat history, saved decks, settings and quiz results stay in the browser's IndexedDB (with an in-memory fallback for restricted private windows).
- No analytics tracker or externally loaded third-party script is included. Vendored libraries run locally. Accounts are optional and off when using a plain static host; hosting providers can receive ordinary request metadata.
- With local accounts enabled, the server stores a username, scrypt password hash, age band (not exact age), private gender choice, referral count, XP/streak/quiz stats and 10 recent result summaries.
- With Supabase accounts, Supabase Auth stores the password hash; Postgres stores the age band, private gender choice, study stats and hashed session tokens. The leaderboard strips gender, age band, IDs and history.
- Session cookies are `HttpOnly` and `SameSite=Lax`; `Secure` can be forced with `STUDY_AI_COOKIE_SECURE=true`. Account mutations also check origin and a CSRF token. No password is ever sent back to the browser or written in plaintext.
- Signing out does not remove books, chats or student keys saved in the browser; use **Settings → Delete all local data** on shared devices. This does not delete account records, downloaded files, browser caches or separately cached models.
- WebLLM runs on the device after its first model download contacts the model host. Ollama / LM Studio requests go to the endpoint configured by the user, which may be on the device or another machine.
- Connected cloud modes send the question, instructions and short retrieved passages needed for the task. Free-tier providers may have different data-retention/training policies — check each provider before uploading sensitive or copyrighted books. OpenRouter free models in particular can have per-provider training policies.
- Web fallback is on for new installations and can be disabled in the composer; saved opt-outs remain off. Queries go to Wikipedia or the chosen provider only when local sources miss. Explicitly requested public URLs go through the site server to the destination even with fallback off; never include sensitive information. Search queries and results are cached briefly in server memory (about five minutes). Outside sources are labelled and not independently verified.
- Server keys never reach the browser, health response, logs or exports. Student BYOK keys are browser-local, sent per request only to this site's proxy, and excluded from exports, accounts and leaderboards. **Settings → Export data** produces JSON without any API key values; **Delete all local data** clears the database, local progress and saved student keys.

---

## Credits

- Made by a student of **Vignan Vidyanikethan English Medium High School** for the **INSPIRE-MANAK** science fair, with Arena.ai Agent Mode used as a development assistant. Nezaad Industries logo supplied by the project owner; [Zero Vast](https://zero-vast.vercel.app/).
- PDF text extraction uses [PDF.js](https://github.com/mozilla/pdf.js) 4.2.67 (legacy build), with dynamic PDF font evaluation and XFA disabled, vendored under `vendor/pdfjs/` with its Apache-2.0 license and font/CMaps notices. This replaces the older build affected by [CVE-2024-4367](https://github.com/advisories/GHSA-wgrm-67xf-hhpq).
- Application code is MIT licensed; see `LICENSE`. No board textbooks are bundled. Telangana SCERT books reserve rights including storage in retrieval systems, and NCERT restricts inclusion in software; obtain written publisher permission before including their material.
