# Private online debate rooms — 2.49.0 / cache v92

## Deploy before presenting

This feature has **not** been enabled in the production database by this change.
For a Supabase-backed deployment, run the new migration once in the project's
SQL editor, then deploy the code:

```
npm run sql:debate
# prints supabase/migrations/20261029000000_debate_rooms.sql
```

The existing server-only Supabase service-role key is reused. No new browser key,
CDN, realtime subscription, public room listing or websocket server is needed.
RLS is enabled with no browser policies; anon/authenticated roles are explicitly
revoked. All access goes through the application's signed-in cookie + CSRF API.
Do not expose the service-role key to users. If a deployment lacks the migration,
the room UI reports storage unavailable and names the migration; the rest of
Learning studio continues working.

With local accounts, rooms use ignored `server/data/debate-rooms.json`, overridden
by `STUDY_AI_DEBATE_FILE`. This serialized JSON store is for one server process,
not multiple replicas or ephemeral production disks. Supabase uses atomic
revision-conditional PATCH updates for multi-instance consistency.

## Two-device demo

1. Sign in with two separate student accounts in different browsers/devices.
2. Start → Speak & write → **Online debate**.
3. Host enters the motion, 2–5 rounds, human speaking time and 0–4 AI roles.
4. Create room. Copy the full private invitation code to the second participant.
5. Second participant pastes it into Join private room. Up to six humans can join.
6. Host assigns each speaker's For/Against team; both sides need a speaker.
   Host can remove lobby speakers and replace the invitation code. Replacing a
   code prevents future use of the old code; it does not eject existing members.
   Removing somebody is not a permanent ban: rotate the invitation if needed.
7. Host starts. Each signed-in person may submit only their own turn. All clients
   refresh about every four seconds while this tab is visible and online.
8. AI turn: the host explicitly requests it. One hosted server model role-plays
   every labelled AI speaker. Clients cannot submit a fabricated AI speech.
9. Host may skip a speaker (recorded visibly) or close the room. Expired human
   turns require host skip; AI generation is not automatic. No penalty/official
   competitive score is assigned.
10. Completion: host can generate shared coaching. Any member can export the
    transcript. Save the invitation privately and export before the room expires.

Start with **0 AI roles** to prove actual two-device multiplayer without external
AI quota. To demonstrate AI, configure server provider keys as for `/api/ai` and
verify a real response before presenting. Online-room AI does not use browser
BYOK, local WebLLM or each participant's individual routing setting. A failed AI
request preserves the turn; retry deliberately or skip it. No canned speech is
presented as AI inference.

## Privacy, reliability and retention boundaries

- Invitations are high-entropy bearer secrets, useful only with a student
  account. Share privately, never project them publicly or put them in URLs.
  Anyone signed in who receives one can join an open lobby; these rooms are not
  restricted to accepted Friends relationships.
- Nonmembers cannot read room state/transcripts by ID. Members see the motion,
  usernames, teams and submitted speeches; only the host sees the invitation in
  the lobby. There is no public discovery or anonymous access.
- Speeches are stored on the server. When the host requests AI, the motion and
  bounded recent transcript are sent to configured hosted providers. Do not put
  sensitive personal information into debates. This is not end-to-end encrypted.
- Rooms expire logically 24 hours after creation. Expired rows are purged when
  another room is created. For guaranteed physical cleanup regardless of traffic,
  operators should schedule `delete from public.debate_rooms where expires_at < now()`
  (plus their normal database backup retention policy). Expiry is not a claim
  of instant erasure from backups.
- Room IDs are remembered in this browser tab's session storage per account.
  Reload reconnects and retrieves the server transcript; unsent text is not
  persisted across reload. Polling/reconnects do not erase a typed speech.
  “Leave room on this device” disconnects the view, not membership; reload can
  restore it. There is no automatic host transfer when a host disconnects.
- Polling pauses offscreen/hidden/offline and does not overlap itself. Failed
  requests preserve drafts and do not auto-resend a speech. Server revisions
  reject stale/double actions. Host controls remain needed for absent speakers.
- AI generation reserves a turn with a bounded lease. Concurrent generation is
  rejected; skipped/closed-room late replies are discarded, and upstream errors
  are replaced by a safe message. Host AI calls have per-user/network rate limits.
- This is text-only, not voice/video, a moderation service or a public chat lobby.
  The shared-device Debate room remains available separately.

## Verification

- 796 tests, secret scanner and offline simulation pass.
- Domain tests: membership/invitation privacy, invitation rotation, host-only
  controls, turn/identity spoofing, duplicate speech races, concurrent joins,
  capacity, round completion, deadlines, TTL, AI reservation/failure/late reply,
  shared coaching and persistent local/CAS store behaviour.
- Actual HTTP test: two signed-in sessions, CSRF rejection, no-store responses,
  private reads and cross-session speech synchronisation.
- `tools/check-online-debate.mjs`: Chromium with two isolated cookie sessions on
  a real local backend, invite/join, four speeches, polling preserving typed
  drafts, host reload/rejoin, completion, literal text safety and three widths.
  It creates throwaway accounts and deliberately refuses a non-local host.
- Supabase REST CAS is tested with a controlled fetch implementation, not a live
  project. Production migration, live provider inference and production
  two-device connectivity remain deployment checks, not claimed passes.
