# Security and policy review — 2.46.2 / v85

Reviewed 27 October 2026. This is a code-and-notice consistency review, not a
penetration-test certification, legal opinion or statement of statutory compliance.

## Fixed

- **High priority — private static-file boundary:** a locally reproduced encoded
  path bypass reached a private server source file. Static serving now rejects
  decoded dot segments, backslashes, null bytes and nested dotfiles before file
  resolution. Real-handler regression tests cover private paths and confirm the
  public `/.well-known/security.txt` route remains accessible. No live exploitation
  or access to actual student records was attempted. Deploy the server patch
  promptly; updating only cached browser assets does not fix the server.
- Corrected cookie names and attributes, IndexedDB storage, browser model caches
  and the limits of the local-data deletion button.
- Disclosed automatically selected hosted AI, provider retries (including Bytez),
  conversation context/library excerpts, and server-stored social messages.
- Removed unsupported assurances about CSRF preventing clickjacking, every
  citation being valid, all material remaining local, comprehensive accessibility
  coverage, and automatic policy-change acknowledgement after sign-in.
- Distinguished original starter notes from publisher textbooks; acknowledged the
  repository's MIT licence and avoided blanket fair-use permission claims.
- Replaced the public-issues security contact with reporting instructions that
  explicitly acknowledge the absence of a monitored private channel.

## Validation

- `npm run check`: 754 passing tests, offline simulation passes.
- Existing real-handler suites cover account/session cookies, CSRF and origins,
  rate limits, admin access, request limits and fetch controls; SSRF tests cover
  private addresses, redirects and DNS/socket validation.
- Secret-pattern scan passes. This scans tracked current files, not all Git
  history, deployment logs, provider dashboards or server environment secrets.
- `tools/check-legal-pages.mjs`: Chromium renders all ten legal pages at 390,
  768 and 1366px with no horizontal overflow or page errors. This is not a full
  screen-reader or WCAG audit. Browser dependencies are installed externally,
  as with the other optional rendered gates.

## Operator actions still required before broad public student use

1. Deploy this server release. Review available hosting access logs for possible
   private-file access on earlier versions. Exposure has not been established or
   ruled out. If account/session stores or credential files may have been read,
   use the incident process: invalidate affected sessions, rotate exposed secrets,
   assess password resets and obtain appropriate notification/legal advice.
2. Publish a monitored private security/privacy/grievance contact. GitHub's private
   vulnerability reporting was checked and is disabled; public issues are not a
   confidential reporting route. No repository settings were changed by this audit.
3. Define server retention, backups and an actionable account/social-data access,
   correction and deletion process; local deletion is not server deletion.
4. Obtain appropriate Indian child-data and consent advice. The current under-13
   self-attestation is not verified parental consent or proof of compliance with
   rules that may cover children under 18. Check applicable commencement,
   exemptions, provider age restrictions and school requirements.
5. Review hosted-AI defaults and provider retention/training/transfer terms before
   allowing sensitive material. Use Offline mode for device-only study.
6. Decide a production framing policy: unrestricted embedding preserves the live
   preview but leaves clickjacking risk. CSRF is not a substitute for frame controls.
7. Do not place custom data stores in public paths or add public symlinks to private
   files. This review did not inspect live Supabase RLS, hosting configuration,
   backups, historical logs or provider accounts.
