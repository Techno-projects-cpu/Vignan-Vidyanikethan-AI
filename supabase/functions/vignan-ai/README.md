# Vignan Vidyanikethan AI — Supabase Edge Function

Optional replacement for the Render Node API. It proxies free-tier AI providers
while keeping API keys in Supabase secrets.

## Deploy

```bash
supabase functions deploy vignan-ai --no-verify-jwt
supabase secrets set \
  STUDY_AI_GEMINI_KEY=... \
  STUDY_AI_GROQ_KEY=... \
  STUDY_AI_OPENROUTER_KEY=... \
  STUDY_AI_CLOUDFLARE_ACCOUNT_ID=... \
  STUDY_AI_CLOUDFLARE_TOKEN=... \
  STUDY_AI_MISTRAL_KEY=... \
  STUDY_AI_COHERE_KEY=... \
  STUDY_AI_ARENA_KEY=...
```

The endpoint becomes:

```
https://<project-ref>.supabase.co/functions/v1/vignan-ai
```

In the app, open **Settings → Provider setup**, choose **Vignan free AI router**, and set its endpoint to that URL. Students who enable **Settings → Real local model** do not need this Edge Function at all. The client will POST the same
`{ messages, temperature, max_tokens }` body it sends to `/api/ai`.

If you keep JWT verification on, send the Supabase anon key in the `apikey`
header from your own backend; do not put the service-role key in the browser.
