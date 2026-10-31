# Vignan Vidyanikethan AI — Supabase Edge Function

Optional replacement for the Render Node API. It proxies free-tier AI providers
while keeping API keys in Supabase secrets. Each secret may contain multiple
comma/newline-separated keys, and student BYOK keys are accepted after the
server pool is exhausted.

## Deploy

```bash
supabase functions deploy vignan-ai --no-verify-jwt
supabase secrets set \
  STUDY_AI_GEMINI_KEYS='key1,key2' \
  STUDY_AI_GROQ_KEYS='key3,key4' \
  STUDY_AI_OPENROUTER_KEY=... \
  STUDY_AI_CLOUDFLARE_ACCOUNT_ID=... \
  STUDY_AI_CLOUDFLARE_TOKENS='token1,token2' \
  STUDY_AI_MISTRAL_KEY=... \
  STUDY_AI_COHERE_KEY=... \
  STUDY_AI_ARENA_KEY=...
```

Singular secrets also accept multiple keys. The function creates one upstream per
key and rotates on quota/auth failures. Because Edge Functions are stateless,
cooldowns are per request; the Render Node server keeps short in-memory
cooldowns between requests.

The endpoint becomes:

```
https://<project-ref>.supabase.co/functions/v1/vignan-ai
```

In the app, open **Settings → Provider setup**, choose **Vignan free AI router**, and set its endpoint to that URL. Students who enable **Settings → Real local model** do not need this Edge Function at all. The client POSTs the same
`{ messages, temperature, max_tokens, studentKeyFallback, studentKeys, forceStudentKeys }` body it sends to `/api/ai`. Student keys are never stored by the function; only official provider hosts are accepted, and key values never appear in errors or logs.

If you keep JWT verification on, send the Supabase anon key in the `apikey`
header from your own backend; do not put the service-role key in the browser.
