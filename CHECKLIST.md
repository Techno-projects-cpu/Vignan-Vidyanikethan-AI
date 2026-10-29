# Real-device checklist

The automated suite proves the code runs; it cannot see a phone. This sheet is
the part only a human can do. Print it, or keep it open on a laptop while you
hold the phone.

**Before you start**

- Deployed URL open once, online, and left alone for ten seconds (the service
  worker needs a moment to cache the release).
- You have one small PDF or a few paragraphs of notes on the device, ready to add.
- Accounts backend is live: `/api/health` shows `accounts: "supabase"`, not `"local"`.
- Test on **Wi-Fi first**, then repeat the offline section with **aeroplane mode**.
- A tick means it looked right *and* nothing appeared in the console. If you see
  red in DevTools, note it — a silent error is still a failure.

Legend: `P` phone · `T` tablet · `L` laptop. Fill each column.

---

## 1. First impression

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 1.1 | Startup screen appears, wordmark is sharp, **Skip intro** works | ☐ | ☐ | ☐ |
| 1.2 | Nothing overflows sideways; no horizontal scrollbar anywhere | ☐ | ☐ | ☐ |
| 1.3 | Login/register gate appears **before** the workspace, not after | ☐ | ☐ | ☐ |
| 1.4 | Register: username, password, age, gender all usable with the on-screen keyboard | ☐ | ☐ | ☐ |
| 1.5 | Password rules show live and the button enables at the right moment | ☐ | ☐ | ☐ |
| 1.6 | A wrong password says something kind and specific, not "error" | ☐ | ☐ | ☐ |
| 1.7 | After login the workspace loads once, without a flash of the gate | ☐ | ☐ | ☐ |

## 2. Books and citations — the core claim

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 2.1 | **Add book** accepts a PDF; the page count matches the real file | ☐ | ☐ | ☐ |
| 2.2 | A photo or pasted text also works | ☐ | ☐ | ☐ |
| 2.3 | The chapter list is readable, not cramped, on the narrow screen | ☐ | ☐ | ☐ |
| 2.4 | Ask a question covered by that page → answer arrives in a sensible time | ☐ | ☐ | ☐ |
| 2.5 | The citation names the file and a page number, and quotes the sentence | ☐ | ☐ | ☐ |
| 2.6 | Open the page by hand: the quote really is on that page | ☐ | ☐ | ☐ |
| 2.7 | Ask something **not** in the book → it says so instead of inventing | ☐ | ☐ | ☐ |
| 2.8 | Only then does a web search run, clearly labelled as outside the book | ☐ | ☐ | ☐ |
| 2.9 | Ask in Telugu/Hindi/Urdu → the answer language matches the question | ☐ | ☐ | ☐ |

## 3. Study loop

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 3.1 | Study sheet builds from the chapter and can be saved as `.md` | ☐ | ☐ | ☐ |
| 3.2 | Revision plan has real days and topics, not placeholders | ☐ | ☐ | ☐ |
| 3.3 | Quiz: choose chapter + difficulty, questions actually match it | ☐ | ☐ | ☐ |
| 3.4 | Grading marks a wrong answer wrong and explains why | ☐ | ☐ | ☐ |
| 3.5 | Flashcards flip by tap (not hover only) and "again/good" reschedules | ☐ | ☐ | ☐ |
| 3.6 | Evaluation screen shows the score without scrolling to find it | ☐ | ☐ | ☐ |
| 3.7 | Result image/video saves to the phone gallery or downloads, and opens | ☐ | ☐ | ☐ |
| 3.8 | Progress and streak update after finishing a quiz | ☐ | ☐ | ☐ |
| 3.9 | Exams: pick JEE/NEET/AP EAPCET, a mock starts with the real subject split and marks out of the real marking | ☐ | ☐ | ☐ |
| 3.10 | A wrong answer in a mock costs marks, and the result says so in the exam's units | ☐ | ☐ | ☐ |
| 3.11 | Syllabus coverage counts only chapters your own pages can answer | ☐ | ☐ | ☐ |
| 3.12 | First open is not empty: the starter books are in Library and an answer cites them | ☐ | ☐ | ☐ |
| 3.13 | Removing the starter pages in Library leaves your own uploads untouched | ☐ | ☐ | ☐ |
| 3.14 | Viva: the examiner asks, a thin answer gets one follow-up, the card shows marks out of ten | ☐ | ☐ | ☐ |
| 3.15 | Read aloud speaks a real answer without reading `**` or `[1]` | ☐ | ☐ | ☐ |
| 3.16 | Speaking an answer works, or says why not and leaves typing intact | ☐ | ☐ | ☐ |
| 3.17 | First open: five numbered blocks sit under each other, square and joined, and the old suggestion chips are not showing beside them | ☐ | ☐ | ☐ |
| 3.17b | Tapping "Explain a concept" sends the question by itself and the block flashes brand blue on the way out | ☐ | ☐ | ☐ |
| 3.18 | Settings: 33 language tiles show their own script; tapping తెలుగు switches the interface and the tile stays marked | ☐ | ☐ | ☐ |
| 3.18b | Microphone blocked: the notice stays under the composer, names the cause and offers "Open in a new tab" | ☐ | ☐ | ☐ |
| 3.19 | Library: the "coming soon" card is visible, says publisher permission, and its button cannot be pressed | ☐ | ☐ | ☐ |
| 3.20 | A link ending in `?ask=…` fills the composer on open and does not send by itself | ☐ | ☐ | ☐ |

## 4. Social and play

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 4.1 | Add a friend by username; the request appears on the other account | ☐ | ☐ | ☐ |
| 4.2 | Chat message arrives within a few seconds, without a manual refresh | ☐ | ☐ | ☐ |
| 4.3 | Notification dot clears when the item is opened | ☐ | ☐ | ☐ |
| 4.4 | Invite to a mini game; the board is usable with a thumb | ☐ | ☐ | ☐ |
| 4.5 | Leaderboard loads, your name is in the right place after a quiz | ☐ | ☐ | ☐ |
| 4.6 | Referral link copies and the referral is credited | ☐ | ☐ | ☐ |
| 4.7 | Avatars stay small in every list — no layout jump when one loads | ☐ | ☐ | ☐ |

## 5. Updates ask permission

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.1 | Settings → *App, updates & offline* shows the current release number | ☐ | ☐ | ☐ |
| 5.2 | **Check for updates** returns a clear message within a few seconds | ☐ | ☐ | ☐ |
| 5.3 | When a new version exists: the banner offers **Update now** and **Later** | ☐ | ☐ | ☐ |
| 5.4 | **Later** hides the banner and the page does **not** reload | ☐ | ☐ | ☐ |
| 5.5 | **Update now** reloads once, and saved books/chats are still there afterwards | ☐ | ☐ | ☐ |

## 6. Offline — the part that matters at a science fair

Turn on aeroplane mode (or DevTools → Network → Offline) and reload the app.

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 6.1 | The app opens at all — no browser "no internet" dinosaur | ☐ | ☐ | ☐ |
| 6.2 | **Check offline readiness** says *Ready · N of N files cached* | ☐ | ☐ | ☐ |
| 6.3 | Ask about a saved chapter → answered, with a page citation | ☐ | ☐ | ☐ |
| 6.4 | Study sheet builds offline | ☐ | ☐ | ☐ |
| 6.5 | Revision plan, quiz and flashcards still open and work | ☐ | ☐ | ☐ |
| 6.6 | Evaluation screen and result card still render | ☐ | ☐ | ☐ |
| 6.7 | Web fallback says a connection is needed instead of spinning forever | ☐ | ☐ | ☐ |
| 6.8 | Friends/chat/leaderboard say they need a connection — no silent failure | ☐ | ☐ | ☐ |
| 6.9 | Pro Mode still boots offline | ☐ | ☐ | ☐ |
| 6.10 | Privacy, terms, security, copyright and **judge mode** pages open offline | ☐ | ☐ | ☐ |
| 6.11 | Turn the network back on: the app recovers without a manual reload | ☐ | ☐ | ☐ |

## 7. Polish and trust

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 7.1 | 200 % text size does not clip buttons or captions | ☐ | ☐ | ☐ |
| 7.2 | Every tap target is comfortable — nothing smaller than a fingertip | ☐ | ☐ | ☐ |
| 7.3 | Landscape phone: the workspace still works | ☐ | ☐ | ☐ |
| 7.4 | Footer shows Privacy · Terms · Security · Copyright · Judge mode · Zero Vast | ☐ | ☐ | ☐ |
| 7.5 | The Nezaad logo and the student credit are visible without hunting | ☐ | ☐ | ☐ |
| 7.6 | Console is clean (no red) after a full pass | ☐ | ☐ | ☐ |

---

## If something fails

Write it down with the **device, the screen, and the smallest action that breaks
it**, then fix that one thing and re-run only the section above. Do not re-test
everything after a single fix — you will run out of time and start doubting
checks you already passed.

The quickest regression test for a UI fix is `npm test` (388 checks) plus
`npm run offline:check`. If both pass and the screen looks right, ship it.
