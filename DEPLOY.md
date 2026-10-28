# Deploy Vignan Vidyanikethan AI for $0

This repository is now a clean, root-level Vignan Vidyanikethan AI app. The old school-website files were removed. It can be deployed to Render's free web service and backed by Supabase's free tier.

## What is already done

- All files except `.git` were cleared and rewritten with the Vignan Vidyanikethan AI code.
- The PWA is served from the site root (`/`), not `/study-ai/`.
- A free AI router is built into `serve.mjs` / `server/free-router.mjs`.
- Supabase project created: **Vignan-Vidyanikethan-AI**, ref `dwmzbrrnqxzdoxrxbrna`, region `ap-south-1`.
- Migration `20261027150656_create_vignan_ai_schema` applied: profiles, sessions, RLS, triggers, progress and leaderboard helpers.
- Supabase Auth email signup is enabled and `mailer_autoconfirm` is on, so synthetic student emails do not need real delivery.
- `render.yaml`, `.env.example`, `supabase/migrations/`, and an optional `supabase/functions/vignan-ai/` Edge Function are included.
- The premium monochrome shell is live: command menu (`Ctrl/⌘ + K`), centered Ask hero, one-click PDF upload, built-in **Bolt** instant AI, and nicknamed AI routes with specialties instead of provider names.
- Advanced model, key, web, privacy and appearance controls are hidden behind the command menu and **Settings → Advanced settings**.

## 1. Confirm the GitHub repo

The repository is now **Techno-projects-cpu/Vignan-Vidyanikethan-AI**. The old `Vignan-Vidyanikethan-E.M.-School` URL redirects here, so Render's existing deploy hook keeps working.

If a local checkout still points at the old URL, run:

```bash
git remote set-url origin https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI.git
```

## 2. Create the Render web service

1. Push this branch to GitHub.
2. In Render, choose **New → Web Service**, connect the repo, and let it use `render.yaml`.
3. Render will run `npm run precache` then `npm start`.
4. Health check path is `/api/health`.

Render free web services sleep after inactivity and have limited instance hours; its free Postgres also expires after 30 days. That is why Supabase holds accounts ([Render free-tier notes](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)). Supabase's free tier includes 50,000 MAUs, a 500 MB database and 500,000 Edge Function invocations, but pauses after a week of database inactivity ([Supabase billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)).

## 3. Add Render environment variables

Paste these in **Render → Environment**. The Supabase service-role key is secret — never commit it or put it in the browser.

```dotenv
STUDY_AI_ACCOUNTS_BACKEND=supabase
STUDY_AI_COOKIE_SECURE=true
SUPABASE_URL=https://dwmzbrrnqxzdoxrxbrna.supabase.co
SUPABASE_ANON_KEY=<Project Settings → API → anon>
SUPABASE_SERVICE_ROLE_KEY=<Project Settings → API → service_role>
STUDY_AI_FREE_ROUTER=true
STUDY_AI_FREE_ROUTER_ORDER=gemini,groq,cloudflare,openrouter,mistral,cohere,arena,primary
STUDY_AI_KEY_COOLDOWN_MS=60000
STUDY_AI_STUDENT_KEY_FALLBACK=true
```

Get the two keys from <https://supabase.com/dashboard/project/dwmzbrrnqxzdoxrxbrna/settings/api>.

## 4. Use a real local AI — or add your own free keys

**No API keys are bundled.** Public, leaked or shared keys are not safe: they can expose private data, exhaust someone else's quota, and create surprise bills. Generate keys from your own provider accounts and paste only the secret value into Render → Environment. The app's **Settings → Advanced settings → Official free-tier API keys** panel links directly to every official key page.

### 4a. Keyless local model (recommended for offline)

The app bundles WebLLM and a Web Worker. In **Settings → Real local model** (always visible), choose Meta Llama 3.2 1B, SmolLM2, or Qwen2.5, then press **Download & enable**. The first download needs internet; after that the model is cached in the browser and answers, quizzes, flashcards, grading and verification run on the device with Vignan's textbook rules. WebGPU is required; Ollama (`ollama pull llama3.2:1b`) and the cited-excerpt engine are the fallbacks. See `LOCAL_AI.md`.

### 4b. Optional server free router with multiple keys

Add one or more of these. **A single env var may contain several keys** — separate them with commas or newlines. Alternatively use the plural alias (`STUDY_AI_GEMINI_KEYS`, `STUDY_AI_GROQ_KEYS`, `STUDY_AI_CLOUDFLARE_TOKENS`, etc.). Vignan deduplicates the values, creates one internal upstream per key, tries them in order, and pauses a quota-limited key for `STUDY_AI_KEY_COOLDOWN_MS` (default 60 s). If all Render keys are exhausted, student keys from Settings are tried next; if those also fail, the offline engine answers.

```dotenv
STUDY_AI_GEMINI_KEY=<key1>,<key2>
STUDY_AI_GEMINI_KEYS=<key3>\n<key4>
STUDY_AI_GROQ_KEY=<Groq keys comma/newline separated>
STUDY_AI_OPENROUTER_KEY=<OpenRouter key>
STUDY_AI_CLOUDFLARE_ACCOUNT_ID=<Cloudflare account id>
STUDY_AI_CLOUDFLARE_TOKEN=<Cloudflare token 1>,<Cloudflare token 2>
STUDY_AI_MISTRAL_KEY=<Mistral free-mode keys>
STUDY_AI_COHERE_KEY=<Cohere trial keys>
STUDY_AI_ARENA_KEY=<Arena workspace API key, optional>
```

Key values never appear in `/api/health`, logs, errors, exports or the public leaderboard. Health only reports counts such as `keyPool.serverKeys`.

### 4c. Student-owned keys in account settings

When every official Render key is over, students can open **Settings → Advanced settings → Your own API keys** (also reachable from **Progress → My AI keys** or the **Add keys** button on the Ask screen). They choose a provider, optionally adjust its official endpoint/model, and paste one or more keys. The keys are:

- stored only in that browser's local settings, not in Supabase accounts;
- sent per request to this site's own `/api/ai` proxy, never to another origin chosen by arbitrary URL input;
- excluded from JSON exports and the public leaderboard;
- tried only after the Render pool, or during the explicit **Test my keys** button;
- clearable per provider, and removable by **Delete all local data**.

`STUDY_AI_STUDENT_KEY_FALLBACK=false` disables this school-wide. Warn students not to add keys on shared computers. Direct browser provider keys also rotate, but the server proxy remains the safer production path.

Free-tier reality (Oct 2026):

- Gemini has free Flash / Flash-Lite rows, but Google no longer publishes fixed free RPM/RPD; limits are shown per project in AI Studio ([overview](https://www.memetik.ai/guides/gemini-api-free-tier-limits)).
- Groq has a no-card free tier with per-model rate limits, roughly 30 RPM / 1,000 RPD on GPT-OSS models ([2026 review](https://omidsaffari.com/blog/groq-pricing)).
- OpenRouter free models are capped at 20 RPM and 50 requests/day on an unfunded account ([rate limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know)).
- Cloudflare Workers AI gives 10,000 free Neurons/day ([official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)).
- Mistral Free mode and Cohere trial keys have account-specific limits; Cohere trial keys are for evaluation only.
- **Arena.ai free-router keys are not for websites.** They are documented for Claude Code / Claude Desktop; other harnesses such as `curl` or a server-side `fetch` get 403 restrictions ([Arena docs](https://platform.arena.ai/docs), [harness note](https://portal.api.preview.arena.ai/docs/windows)). Use only a workspace API key if you add Arena.

There is no legitimate “free unlimited AI API”. The local open-weight model and the cited-excerpt engine are the truly unlimited $0 fallbacks.

## 5. Verify the deployment

```bash
curl https://<your-render-service>.onrender.com/api/health
# {"ok":true,"brand":"Vignan Vidyanikethan AI","ai":true,
#  "aiProviders":["gemini","groq"],"freeRouter":true,
#  "keyPool":{"serverKeys":4,"coolingKeys":0,"cooldownMs":60000,"studentKeyFallback":true},
#  "accountsBackend":"supabase","offlineReady":true,"localAI":{"bundled":true},...}
```

Open the root URL. When `/api/health` reports `ai:true`, Vignan Vidyanikethan AI can auto-select the free router for answers, quizzes, flashcards, grading and verification. Students can instead enable the bundled local model; if every provider is down, the app still answers from the demo textbook offline.

## 6. Optional: Supabase Edge Function

`supabase/functions/vignan-ai/` contains a Deno Edge Function that can replace the Render `/api/ai` proxy:

```bash
supabase functions deploy vignan-ai --no-verify-jwt
supabase secrets set STUDY_AI_GEMINI_KEYS='key1,key2' STUDY_AI_GROQ_KEYS='key3,key4'
```

The Edge Function uses the same comma/newline-separated key pools and student BYOK payload as the Render server. Because Edge Functions are stateless, its quota cooldowns are per request rather than in-memory between requests.

Then set the `server` provider endpoint in **Settings → Advanced settings → Provider setup** to:

```
https://dwmzbrrnqxzdoxrxbrna.supabase.co/functions/v1/vignan-ai
```

This can avoid Render cold starts for AI calls, but the Node server is still needed for accounts unless you also move those to Supabase Auth client-side.
