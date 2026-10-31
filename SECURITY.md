# Security policy — Vignan Vidyanikethan AI

A student project for the INSPIRE-MANAK science fair, run on free tiers. The
full, student-readable version of this policy lives at
[`security.html`](./security.html); the machine-readable contact is
[`.well-known/security.txt`](./.well-known/security.txt).

## Reporting a problem

Report privately to the project operator — the student, the teacher in charge,
or the school office of Vignan Vidyanikethan English Medium High School — before
publishing anything. A useful report says:

- the page or endpoint involved,
- what you expected and what happened,
- the smallest steps that reproduce it,
- whether any personal data was exposed.

Please do not scan the live site automatically, do not try to reach accounts that
are not yours, and do not test with real personal data. Good-faith reports within
those limits are welcome and will not be treated as attacks.

## In scope

- The deployed app and its API (`/api/*`).
- Account, session and CSRF handling.
- The service worker, cache and update flow.
- Any answer that presents invented facts, citations or page numbers.

## Out of scope

- Denial of service, load testing, or anything that could cost the free hosting
  tier its quota.
- Reports that need a compromised device, browser extension, or the victim's own
  password.
- Missing security headers that are intentionally omitted so the Arena live
  preview can embed the page (framing is not restricted; mutations are protected
  by CSRF tokens and same-origin checks instead).
- Social engineering of students, teachers or the operator.

## What is protected, honestly

HTTPS with HSTS, a strict Content Security Policy, `nosniff`, a narrow
permissions policy, HttpOnly/SameSite/Secure session cookies, CSRF tokens and
same-origin checks on every mutation, JSON-only writes, rate limits on sign-in,
registration, progress, search, link reading and the AI proxy, and hashed
passwords handled by the account backend.

What a free school project cannot promise: a formal audit, a guaranteed
incident-response time, or the absence of bugs. Books, chats, decks and results
stay in the student's browser; the app has no analytics, no advertising
identifiers and no data-broker integrations.

## Supported version

Only the current release is supported. The app updates only when the student
allows it; the release is shown in **Settings → App, updates & offline** and in
the service worker cache name (`vignan-vidyanikethan-ai-v<N>`).
