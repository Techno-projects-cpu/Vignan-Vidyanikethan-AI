# Learning studio — presentation rehearsal (2.48.0 / cache v91)

## What changed

The offline quiz's MCQ branch previously hid a word and offered replacements;
short answers also said “Complete the sentence”. MCQs now offer complete factual
statements, with a prompt asking which matches the source evidence. Short answers
ask for an explanation. The quiz screen defaults to Mixed (MCQ, fill, short).
Explicit Fill remains available. Offline questions are heuristic evidence-
recognition practice, not a hand-validated competitive-exam bank. Connected AI
writers are instructed to vary concepts/application/reasoning; malformed choices,
disguised underscore blanks and all-fill “mixed” outputs are rejected so the
existing offline fallback can run. Output that passes validation still needs
human review: structural checks do not establish question quality or factuality.

## A dependable five-minute demo

1. If your library is empty, Library → Add the starter pages first. Then Start → Quizzes. Select Mixed, five questions, untimed. Keep a readable starter
   chapter selected. Turn off the connected writer to demonstrate the genuinely
   offline question variety. Walk through the choices and explanation question.
2. Start → Speak & write → Essay workshop. Enter “Should schools reduce single-use
   plastic?”. Show **Offline outline** first; this is explicitly a scaffold.
3. With a working AI selected in Settings, choose Model essay draft or enter your
   own draft and request Feedback. The selected answer route is used; nothing
   chooses a new provider or downloads model weights automatically.
4. Debate room: set two humans, two AIs and two rounds. Assign each participant
   a name and For/Against side. Both sides need a speaker. Humans use the same
   device; this is not remote multiplayer. Save each human contribution, then
   explicitly request each AI speaker's turn. One model simulates all AI roles.
5. Finish the debate and request coaching: argument structure, evidence gaps and
   rebuttal exercises, not an official score. Export the transcript and coaching.
6. Science events: show Chekumuki preparation, National Science Seminar rehearsal,
   science-fair rehearsal, four original science reasoning questions and an
   elapsed-time stopwatch. These are preparation activities, **not full official
   exam packs**, current notices, registration, official scoring or previous papers.
7. Library → Telangana State Board textbooks: open the official SCERT website,
   choose the right class/medium/edition there, download a readable PDF and import
   it using the existing upload control. Download in advance if demonstrating
   offline; no Telangana textbook is bundled by this release.

## Limits and privacy to say out loud

- Essay/debate text is held in this tab; export before reload. It is not synced
  to an account. AI actions send the supplied writing or recent debate transcript
  to the configured model route; human speech is saved to the tab only until an
  AI action sends context. Do not use sensitive personal material in a demo.
- Essay targets are guidance; exact length is not enforced. Check facts and
  citations, and revise model drafts instead of submitting them unchanged.
- Debate supports 1–4 human speakers, 1–6 AI roles and 2–5 rounds per speaker.
  The AI receives at most the last 14 speeches for each role-play turn; coaching
  receives a bounded transcript. Long sessions may lose early context.
- Requests are single-flight, cancellable and bounded to 60 seconds at this layer
  (provider/router deadlines can be shorter). Failures preserve the human text
  and do not advance the debate. A failed request is not silently resubmitted.
- Automatic release reloads defer for active studio AI work, unsent essay/debate
  writing and a populated debate transcript. A manual reload still clears it.
- Offline operation includes essay scaffolding, science prompts/quiz, timer and
  human turn-taking. AI speeches/coaching require an available configured hosted
  model or a previously loaded supported local model. No canned response is
  presented as live AI.
- SCERT's official root returned HTTP 500 during this session. A link is offered
  rather than unsupported scraping/redistribution or invented download URLs.
  PDFs consisting only of scanned images may require separate OCR.

## Source boundaries

- Official textbook entry: https://scert.telangana.gov.in/
- Historical JVV organiser description of Chekumuki:
  https://janavignanavedika.blogspot.com/2007/11/about-us.html
- Historical NCSM National Science Seminar reference:
  https://ncsm.gov.in/events/disket-angma-from-ladakh-was-declared-winner-of-the-national-science-seminar-2022
- Science-fair organiser entry: https://www.inspireawards-dst.gov.in/

No current-year dates, themes, time limits or eligibility were inferred from
historical material. Ask the school/local organiser for the current notice.

## Verification

`npm run check`: secret scanner, 787 tests and complete offline simulation.
Optional `tools/check-learning-studio.mjs`: real rendered UI with mocked same-
origin provider; essay validation, offline scaffold, literal text rendering,
two-human/two-AI teams across eight turns, outage preserving the turn, coaching,
science question feedback and 390/768/1024/1366px overflow checks.
This is not a live provider test, actual GPU inference or remote multiplayer test.
