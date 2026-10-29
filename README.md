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

A first-time visitor can enter or skip the branded startup screen, then choose **Log in**, **Register**, or **Continue as guest** beneath the account options. The intro is remembered for the current tab when session storage is available. Existing signed-in sessions and a guest choice reopen the workspace; the guest choice is remembered only in the current tab. The guest path remains available when the account server is offline. The library starts empty; add material you have permission to use in **Library**. The old sample pack is retired, while student uploads and study history are preserved. For a real AI answer with **no server key**, open **Settings → Real local model**, choose a model, and press **Download & enable** (first download needs internet; later runs are offline). To enable optional cloud AI answers, copy `.env.example` to `.env`, add one or more official free keys from your own accounts (comma/newline separated), and restart the server — enable the server route in **Settings → Advanced settings**; it rotates through the key pool, keeps student keys as a last resort, and retains the offline engine as a fallback. The minimal UI keeps those controls tucked behind **Settings → Advanced settings**.

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
| Library | Upload PDFs and readable text (for example TXT, Markdown, CSV and JSON), paste notes, or import a public webpage/PDF/text URL. Scripts, executables and archives are rejected. Web imports retain their origin and are labelled separately. |
| Quizzes | MCQ, fill-in-the-blank, short-answer and mixed quizzes; easy/medium/hard; timed or untimed; AI-written or offline-generated; instant grading with per-question review, topic breakdown and a revise list. |
| Flashcards | Create multiple device-local cited decks, switch between them, review due cards with a Leitner schedule, or practise without altering that schedule. Missed quiz questions can become a revision deck. |
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

## Premium minimal shell

The public interface is intentionally sparse: a skippable student-project intro, sharp-edged controls, one large headline, one composer, and a command menu for everything else. Its prompt-first layout was informed by [Arena.ai](https://arena.ai/).

- Press **Ctrl/⌘ + K** or choose **Menu** to open the command palette. It contains every section, PDF upload, quiz/flashcard actions, sources, settings, keys, theme, account, credits and policy links. Use arrow keys to browse, Enter to open and Escape to close.
- After the entry screen, **Add a book** opens the file chooser. In **Library**, students can also drag a file, paste notes, or import a public URL. PDFs are indexed locally and their page numbers are preserved.
- **Bolt** is the built-in super-fast AI: it answers from the local textbook index with citations, requires no model download and works offline. It is the default route.
- The main AI chooser is hidden. Bolt is the default; optional local and connected model routing is available only through the advanced Settings panels. Existing deliberately configured routes are preserved.
- Settings open with a single **Control room** card; the dense model, key, web, privacy and appearance panels stay hidden until **Advanced settings** is chosen.
- The interface palette is black/grey/white in both themes. Fonts are bundled locally, motion respects reduced-motion preferences, and the score studio offers additional colourful styles. See [OPEN_SOURCE_CREDITS.md](./OPEN_SOURCE_CREDITS.md).

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

52 Node tests cover page parsing, chunking, stemming, hybrid retrieval, grounded answers, quiz generation and grading, flashcard scheduling, streaks, provider adapters, prompt context, JSON extraction, web-result parsing and performance-card drawing.

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
