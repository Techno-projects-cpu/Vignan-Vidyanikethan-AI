# Vignan Vidyanikethan AI

A textbook-grounded study assistant for Vignan Vidyanikethan E.M. School — built as an **orchestrator around existing AI models**, not as a newly trained model.

This repository now contains only the Vignan Vidyanikethan AI app. The old school-website files were removed so the project can be deployed directly from the repository root.

Your class books are the knowledge base. Vignan Vidyanikethan AI retrieves page-preserving passages locally, then either:

- runs a **real open-weight model on the device** (Meta Llama 3.2 1B, SmolLM2 or Qwen2.5 via bundled WebLLM + WebGPU) with Vignan's own textbook rules — no API key after the first model download,
- sends those short passages to an existing AI provider (Gemini, Groq, Cloudflare, OpenRouter, Mistral, Cohere, OpenAI, Claude, Arena workspace, Ollama, LM Studio, or any OpenAI-compatible endpoint) for a natural explanation, or
- uses its built-in offline extractive engine to quote the passages directly.

Every answer, quiz question and flashcard keeps a page citation. If the books do not contain the answer, the app says so instead of inventing one.

---

## Quick start

Requirements: Node.js 18+ (no npm dependencies to install).

```bash
npm start
```

Open:

- Vignan Vidyanikethan AI: <http://localhost:4173/>

The server binds to `0.0.0.0`, so it also works in the Arena live preview. A plain static server (`python3 -m http.server`) can serve the app too, but the optional `/api/ai`, `/api/search` and `/api/auth/*` endpoints will not exist — the offline engine and guest progress still work.

On first launch the app loads a small **Demo Study Pack** so you can try questions immediately. Replace it with real class PDFs in **Library**. For a real AI answer with **no server key**, open **Settings → Real local model**, choose a model, and press **Download & enable** (first download needs internet; later runs are offline). To enable optional cloud AI answers, copy `.env.example` to `.env`, add one official free key from your own account, and restart the server — the app auto-detects the free router and keeps the offline engine as a fallback.

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

The server tries the configured providers in order, skips 429/5xx/empty responses, and the browser falls back to its offline extractive engine if everything fails. Add keys on the server only — never in the browser. See `.env.example` and `render.yaml`. The **Settings → Official free-tier API keys** panel links to each provider's own key-creation page; **no key value is ever committed to this repository**.

For full offline capability, see [LOCAL_AI.md](./LOCAL_AI.md). The bundled WebLLM runtime runs Meta Llama 3.2 1B / SmolLM2 / Qwen2.5 in a Web Worker with WebGPU, applies Vignan's own grounding rules, and caches the chosen model after one download. It powers answers, explanations, summaries, practice, quizzes, flashcards, short-answer grading and citation verification without a server key.

---

## What is implemented

| Area | What it does |
| --- | --- |
| Grounded answers | Local hybrid retrieval (BM25 + hashed TF-IDF vectors + phrase matching) over page chunks, with `[1]` citations and a clickable page reader. |
| Model router | Route **Answers**, **Quiz writing**, **Flashcard writing**, **Short-answer grading** and **Citation verification** to different existing AI providers. Automatic fallback to the offline engine. |
| Real local AI | Bundled WebLLM + Web Worker runs open-weight Meta Llama 3.2 1B, SmolLM2 or Qwen2.5 on-device with Vignan's grounding rules. Download once, then use every AI task offline. |
| Zero-budget AI runtime | Server-side **free AI router** tries Gemini, Groq, Cloudflare Workers AI, OpenRouter free models, Mistral, Cohere and an optional Arena AI workspace key in order; skips rate-limited providers and keeps keys off student devices. |
| Official key links | Settings shows safe signup links for eight free/keyless providers and explicitly warns against leaked or shared keys. |
| Library | Upload PDF / TXT / Markdown, paste notes, use `[[page:12]]` markers, delete books, open a page reader, open the original PDF at a cited page. |
| Quizzes | MCQ, fill-in-the-blank, short-answer and mixed quizzes; easy/medium/hard; timed or untimed; AI-written or offline-generated; instant grading with per-question review, topic breakdown and a revise list. |
| Flashcards | AI-written or offline definition / cloze cards generated from cited sentences, with a Leitner spaced-repetition scheduler. |
| Progress | Local streak, XP, accuracy, topic mastery, recent results, an on-device leaderboard and an optional live class leaderboard for logged-in students. |
| Student accounts | Roblox-inspired Log In / Register with username, password, age band and private gender; local scrypt hashes or Supabase Auth, persistent Supabase sessions, under-13 guardian consent, referral codes and squad invites. |
| Funky edit video | Animated 1080×1920 “edit” with neon cuts, beat pulses, glitch type, confetti, score ring, question bars, streak, XP, revise tip, hashtags and a squad invite. Records MP4 where supported, WebM otherwise, and always offers a PNG poster. |
| Web fallback | Disabled by default. When enabled, outside results are shown only after the books fail, and are labelled **OUTSIDE YOUR TEXTBOOKS**. |
| Offline / PWA | Service worker caches the full app shell, WebLLM runtime, local AI worker, PDF.js, CMaps and the demo pack after the first online visit. Installable manifest included. |
| Arena-inspired UI | Dark technical workspace with a narrow left rail, 1px bounded panels, compact mono labels, warm off-white type, restrained blue links and selective coral edges. Responsive icon rail on tablets and a bottom nav on phones. |
| Privacy | Books, vectors, chats, settings and results stay in this browser's IndexedDB. Local AI sends nothing off the device. Export excludes API keys. |
| Languages | English UI with a Telugu translation for the main interface. Textbook passages are never silently machine-translated. |

---

## Student accounts, squad invites & leaderboard

Vignan Vidyanikethan AI remains fully usable as a guest. When the Node server is running, students can create a free account from the **profile button** or **Progress → Join the Vignan squad**:

- **Register** asks for a username, password, age and gender. A confirm-password field and an under-13 parent/guardian permission checkbox are shown on the client.
- The server stores **only an age band** (`under-13`, `13-15`, `16-18`, `19+`), never the exact age. Gender is kept in the private profile and is omitted from the public leaderboard.
- Passwords are hashed with Node's built-in `scrypt` and a unique random salt. Plaintext passwords are never written to disk. Sessions are random tokens in `HttpOnly`, `SameSite=Lax` cookies.
- Each account gets a referral code such as `VIGNAN-ANANYA`. An invite link containing `?ref=VIGNAN-ANANYA&view=progress` opens the register tab and credits the referring student.
- Quiz results sync XP, streak, best score, accuracy and recent topics to the account. The live leaderboard exposes only usernames and study stats — no password hashes, exact ages, genders, IDs or full history.
- The result **edit video** includes the student's squad code so friends can join from a share caption.

Account endpoints reflect `Origin` only for the same host/proto or origins listed in `STUDY_AI_ALLOWED_ORIGINS`; they never combine credentialed cookies with a wildcard origin.

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
- **Supabase (recommended for Render):** set `STUDY_AI_ACCOUNTS_BACKEND=supabase` plus `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Apply `supabase/migrations/20261027000000_vignan_ai.sql` first. Supabase Auth handles password hashing; profiles, progress, referrals and sessions live in Postgres with row-level security, so Render's ephemeral filesystem and cold starts do not erase accounts. Supabase's free tier includes 50,000 monthly active users, a 500 MB database and 500,000 Edge Function invocations ([billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)), but free projects pause after a week of database inactivity.

For a larger public deployment, add email verification, password reset, moderation and backups. Never put the Supabase service-role key in the browser or in Git.

---

## Using other AIs (the intended architecture)

Vignan Vidyanikethan AI does **not** train a model. It provides a task-based router over existing model APIs:

1. Open **Settings → Real local model** for a keyless on-device model, or **Settings → Model router** for hosted / desktop providers.
2. Pick a provider and fill in its endpoint, model name and (if needed) your own API key. For WebLLM, choose and download a model instead.
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

> **Browser API keys:** direct browser calls to cloud providers may be blocked by CORS, and a key typed into a shared computer is visible to that browser. For a school deployment, configure the server proxy instead. Keys are stored only in this browser's IndexedDB and are excluded from exports.

---

## Configuring the free AI router / server proxy

`serve.mjs` is zero-dependency. It serves the static site, proxies AI calls to configured free-tier providers, optionally proxies web search, and serves the account API. Nothing is sent anywhere unless you set environment variables.

The easiest zero-budget start is one free key:

```bash
STUDY_AI_GEMINI_KEY='your-google-ai-studio-key' npm start
# or
STUDY_AI_GROQ_KEY='your-groq-key' npm start
```

Add more keys and the router will fall through them automatically:

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

### Web fallback with a JSON search API

Web fallback is off by default. Configure a JSON endpoint with a `{q}` placeholder:

```bash
STUDY_AI_SEARCH_URL='http://127.0.0.1:8080/search?q={q}&format=json' npm start
# Optional authenticated provider:
STUDY_AI_SEARCH_TOKEN='...' \
STUDY_AI_SEARCH_TOKEN_HEADER='X-Subscription-Token' \
npm start
```

The server normalises common JSON shapes (`results`, `items`, `organic`, `webPages.value`, DuckDuckGo `RelatedTopics`) and rejects non-HTTP URLs.

### All environment variables

All variables also accept the new `VIGNAN_AI_` prefix as an alias, e.g. `VIGNAN_AI_GEMINI_KEY`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `STUDY_AI_HOST` | `0.0.0.0` | Bind host. |
| `STUDY_AI_PORT` / `PORT` | `4173` | Bind port. |
| `STUDY_AI_FREE_ROUTER` | `true` | Set `false` to use only the first configured provider. |
| `STUDY_AI_FREE_ROUTER_ORDER` | `gemini,groq,cloudflare,openrouter,mistral,cohere,arena,primary` | Comma-separated fallback order. |
| `STUDY_AI_GEMINI_KEY` / `_MODEL` / `_ENDPOINT` | empty / `gemini-3.5-flash-lite` / Google endpoint | Gemini free-tier key and model. |
| `STUDY_AI_GROQ_KEY` / `_MODEL` / `_ENDPOINT` | empty / `openai/gpt-oss-20b` / Groq endpoint | Groq free-tier key and model. |
| `STUDY_AI_CLOUDFLARE_ACCOUNT_ID` / `_TOKEN` / `_MODEL` | empty / empty / `@cf/openai/gpt-oss-20b` | Cloudflare Workers AI free Neurons. |
| `STUDY_AI_OPENROUTER_KEY` / `_MODEL` / `_ENDPOINT` / `_REFERER` | empty / `openrouter/free` / OpenRouter endpoint / repo URL | OpenRouter free models. |
| `STUDY_AI_MISTRAL_KEY` / `_MODEL` / `_ENDPOINT` | empty / `open-mistral-nemo` / Mistral endpoint | Mistral Free mode. |
| `STUDY_AI_COHERE_KEY` / `_MODEL` / `_ENDPOINT` | empty / `command-r-08-2024` / Cohere compatibility endpoint | Cohere free trial key. |
| `STUDY_AI_ARENA_KEY` / `_MODEL` / `_ENDPOINT` | empty / `coding-router-preview` / `https://api.arena.ai` | Optional Arena workspace API key. |
| `STUDY_AI_AI_BASE_URL` / `_MODEL` / `_KEY` / `_KIND` / `_EXTRA_HEADERS` | legacy single upstream | `openai`, `ollama`, `anthropic` or `arena`. Also appears as `primary` in the router order. |
| `STUDY_AI_SEARCH_URL` / `_TOKEN` / `_TOKEN_HEADER` | empty / empty / `Authorization` | Optional labelled web fallback. |
| `STUDY_AI_ACCOUNTS_BACKEND` | `local` | `local` or `supabase`. |
| `STUDY_AI_ACCOUNTS_FILE` | `server/data/accounts.json` | Local JSON account store path. Ignored by Git and blocked from static serving. |
| `STUDY_AI_SUPABASE_EMAIL_DOMAIN` | `students.vignanvidyanikethan.org` | Synthetic email domain for username/password Supabase Auth. No real emails are sent. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | empty | Supabase project credentials. Service-role key is server-only. |
| `STUDY_AI_COOKIE_SECURE` | auto | Set `true` to force `Secure` session cookies behind HTTPS. |
| `STUDY_AI_ALLOWED_ORIGINS` | empty | Comma-separated extra origins allowed to call account endpoints with cookies. Same-origin requests work without this. |

Local WebLLM needs **no environment variable**. The model choice is stored in the browser's IndexedDB settings; the runtime is a static file under `vendor/webllm/`.

---

## How grounding works

```
PDF / TXT / pasted notes
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

The system prompt forbids answering from memory, requires `[n]` citations, and instructs the model to say **“I could not find this in your textbooks.”** when the passages are insufficient. Textbook passages are treated as data, not instructions, to reduce prompt injection.

A demo of the retrieval quality:

```bash
node --input-type=module -e "
import fs from 'node:fs';
import { buildBookIndex, retrieve } from './js/retrieval.js';
const i = buildBookIndex({ id: 'demo', title: 'Demo' }, fs.readFileSync('./data/demo-textbook.txt', 'utf8'));
console.log(retrieve('Why do leaves look green?', [i]).hits[0].page); // 3
console.log(retrieve('State Newton second law', [i]).hits[0].page);   // 6
"
```

---

## Adding your real textbooks

- **PDF:** selectable text works out of the box via a vendored PDF.js build. Page numbers come from the PDF itself. PDFs up to 800 pages / 40 MB are supported; the original PDF is kept locally (up to 20 MB) so citations can open it at the exact page.
- **Scanned PDFs:** images only. Run OCR first or upload a TXT version — the app will tell you when no text is found.
- **TXT / Markdown / pasted notes:** put `[[page:12]]` on its own line before each page's text. `--- Page 12 ---` and `Page 12:` also work. Without markers, long documents are split into approximate 420-word pages.
- Markdown `# Heading` lines become chapter/section labels and are removed from quiz blanks.

After adding files, run `npm run precache` if you changed anything inside the app root so the service worker caches the new assets.

---

## Tests

```bash
npm test
```

52 Node tests cover page parsing, chunking, stemming, hybrid retrieval, grounded answers, quiz generation and grading, flashcard scheduling, streaks, provider adapters, prompt context, JSON extraction, web-result parsing and performance-card drawing.

A separate DOM smoke run (jsdom + fake IndexedDB) was used during development to verify first launch, demo pack loading, asking a question, generating a quiz, viewing results and opening the performance-card modal. Those harness dependencies are intentionally not added to this zero-dependency repository.

---

## Project structure

```
index.html                Vignan Vidyanikethan AI app shell / PWA entry
styles.css                Arena-inspired responsive dark/light UI
LOCAL_AI.md               Real local WebLLM model guide
manifest.webmanifest      PWA manifest
sw.js                     Offline service worker
precache.json             Generated offline asset list
data/demo-textbook.txt    Original sample study notes
icons/                    SVG + PNG app icons
vendor/webllm/            Vendored WebLLM 0.2.85 runtime (Apache-2.0)
vendor/pdfjs/             Vendored PDF.js (Apache-2.0)
js/                       Browser ESM app modules
  app.js                  UI controller
  auth.js                 Account API client + Log In / Register modal
  ingest.js               PDF/TXT ingestion
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
  progress.js             Streaks, mastery, leaderboard
  web.js                  Optional labelled web fallback
  card.js                 Funky edit video / PNG poster canvas
  db.js                   IndexedDB persistence
  settings.js             Defaults and health checks
  i18n.js                 English / Telugu UI strings
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

The in-repo name is `vignan-vidyanikethan-ai` and all user-facing branding is **Vignan Vidyanikethan AI**. Arena's GitHub App token cannot rename repositories (it returns `HTTP 403: Resource not accessible by integration`), so the remote rename must be done by you:

1. Open the repo on GitHub → **Settings** → **Repository name**.
2. Rename it to `Vignan-Vidyanikethan-AI` (the other repo with that name is already deleted).
3. In this checkout, run:
   ```bash
   git remote set-url origin https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI.git
   ```

GitHub redirects the old URL, so existing bookmarks and the Render deploy hook will keep working after the rename.

---

## Created Supabase project

A free Supabase project has already been created and the schema migration applied:

- **Name:** `Vignan-Vidyanikethan-AI`
- **Ref / URL:** `dwmzbrrnqxzdoxrxbrna` → <https://dwmzbrrnqxzdoxrxbrna.supabase.co>
- **Region:** `ap-south-1` (Mumbai, close to Andhra Pradesh)
- **Migration:** `20261027150656_create_vignan_ai_schema`
- **Auth:** email signup enabled, `mailer_autoconfirm` on (no real emails are sent for synthetic student accounts)

Copy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings → API** into Render. Only the service-role key is secret; never put it in the browser or Git. See `DEPLOY.md` for the exact Render environment variables and verification steps.

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
3. **In Render → Environment**, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally one free AI key generated from your own account (`STUDY_AI_GEMINI_KEY`, `STUDY_AI_GROQ_KEY`, `STUDY_AI_MISTRAL_KEY`, etc.). Set `STUDY_AI_ACCOUNTS_BACKEND=supabase` and `STUDY_AI_COOKIE_SECURE=true`. No key is required for the local WebLLM model.
4. **Reload the app.** When `/api/health` reports `ai:true`, Vignan Vidyanikethan AI can auto-select the free router for answers, quizzes, flashcards, grading and verification. Students can instead enable the local model. If all providers fail, the offline engine still answers from textbooks.
5. **Optional:** deploy `supabase/functions/vignan-ai/` as a Supabase Edge Function and point the `server` provider endpoint at it instead of Render's `/api/ai`. This can avoid Render's cold start for AI calls; the free tier includes 500,000 function invocations/month.

Render free web services sleep after ~15 minutes of inactivity, share 750 instance-hours/month, and its free Postgres expires after 30 days ([Render free-tier notes](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)). That is why Supabase — not Render Postgres or the local JSON file — should hold accounts on a public deployment. Static files on Render Static Sites do not sleep, so a static frontend + Supabase Edge Function is the most always-on $0 option if you later split the app.

Other notes:

- **Static hosting / GitHub Pages:** the offline app works from the site root, but the server API will not exist; use the local WebLLM model, direct provider endpoints (with CORS support), the Supabase Edge Function, or the offline engine.
- **School LAN / desktop:** run `npm start` on one machine and open `http://<lan-ip>:4173/`. With WebLLM cached or Ollama configured, no internet is needed after setup.
- **Offline first load:** service workers require HTTP/HTTPS. Open the app once while the server is reachable; afterwards the app shell, bundled WebLLM runtime, books you added, PDF.js and cached vectors remain available offline. Model weights download separately on first use.
- **Edit videos:** `MediaRecorder` MP4 support varies by browser. The app prefers MP4, falls back to WebM, and always offers a PNG poster.

---

## Privacy

- Books, page text, vectors, chat history, settings and quiz results stay in the browser's IndexedDB (with an in-memory fallback for restricted private windows).
- No analytics, no telemetry, no third-party scripts. Accounts are optional and off when using a plain static host.
- With local accounts enabled, the server stores a username, scrypt password hash, age band (not exact age), private gender choice, referral count, XP/streak/quiz stats and 10 recent result summaries.
- With Supabase accounts, Supabase Auth stores the password hash; Postgres stores the age band, private gender choice, study stats and hashed session tokens. The leaderboard strips gender, age band, IDs and history.
- Session cookies are `HttpOnly` and `SameSite=Lax`; `Secure` can be forced with `STUDY_AI_COOKIE_SECURE=true`. No password is ever sent back to the browser or written in plaintext.
- Local WebLLM / Ollama / LM Studio modes send nothing off the device. WebLLM's first model download contacts the model CDN; the model itself then runs locally.
- Connected cloud modes send only the short retrieved passages needed for the task. Free-tier providers may have different data-retention/training policies — check each provider before uploading sensitive or copyrighted books. OpenRouter free models in particular can have per-provider training policies.
- Web fallback is off by default; outside results are visually separated and labelled.
- **Settings → Export data** produces JSON without API keys. **Delete all local data** clears the database and local progress.

---

## Credits

- Built for the students of **Vignan Vidyanikethan E.M. School** and the **INSPIRE MANAK** science-fair demo, with Arena.ai Agent Mode used as the development assistant.
- PDF text extraction uses [PDF.js](https://github.com/mozilla/pdf.js) 3.11.174, vendored under `vendor/pdfjs/` with its Apache-2.0 license and font/CMaps notices.
- Application code is MIT licensed; see `LICENSE`. Replace the demo study pack with your own board textbooks before classroom use.
