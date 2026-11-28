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
| 3.18 | Settings: 33 large language tiles show their own script; typing "tel" leaves one and the count reads `1 of 33`; tapping తెలుగు switches the interface, the tile keeps its tick, and the whole card turns Telugu — no stray dropdown above the grid | ☐ | ☐ | ☐ |
| 3.18b | Microphone blocked: the notice stays under the composer, names the cause and offers "Open in a new tab" | ☐ | ☐ | ☐ |
| 3.18c | Six style tiles switch the whole app; Terminal and Minimal are dark, the other four stay light even with the invert switch | ☐ | ☐ | ☐ |
| 3.18d | Phone at 390px, tablet at 820px, laptop and a 1280×720 projector: nothing clipped, composer always reachable | ☐ | ☐ | ☐ |
| 3.18e | Settings shows three tabs; the first-run tour appears once and never blocks typing | ☐ | ☐ | ☐ |
| 3.18f | With Soft, Editorial, Luxury, Terminal or Neo-brutalism selected, the light/dark button in the header is greyed out and Settings shows one line saying the style fixes its own palette; switching to Minimal brings it back | ☐ | ☐ | ☐ |
| 3.18g | A device that never chose a style starts in the school's default (set `SCHOOL_DEFAULT_STYLE` on the server); once the student picks one, that choice survives a reload | ☐ | ☐ | ☐ |
| 3.19 | Ask a question the book does not cover: the refusal names the words it could not find and the closest page, and never offers a guess | ☐ | ☐ | ☐ |
| 3.19b | An answer that only partly matches says so inside the answer body, not just in a tag | ☐ | ☐ | ☐ |
| 3.19c | Open a citation: the reader highlights the passage, `A+` makes the text bigger, "Only pages with your quote" filters the page list, and arrow keys turn pages | ☐ | ☐ | ☐ |
| 3.19d | Under a cited page, write a note and press Save; turn two pages and come back — the note is still there, and saving again updates it instead of adding a second one | ☐ | ☐ | ☐ |
| 3.19e | `Save my notes (.md)` downloads a file that lists the notes in page order, and the note text never appears in any request to a model | ☐ | ☐ | ☐ |
| 3.19f | Ask something the books do not cover: the reply names the closest page and a button opens it; nothing is guessed | ☐ | ☐ | ☐ |
| 3.19g | A connected answer that cites more pages than were found shows the warning above the text and `n of m pages cited` in the meta line | ☐ | ☐ | ☐ |
| 3.20 | Terminal is dark; the light/dark button works there and turns it paper-white with dark-green ink. Editorial, Soft, Luxury and Neo-brutalism stay locked with the one-line reason | ☐ | ☐ | ☐ |
| 3.20b | Choose a style and a theme, reload: the page never flashes the wrong colours before the app starts | ☐ | ☐ | ☐ |
| 3.20c | Read to page 7 of a book, close it, open it again from Library: it continues at page 7 and says so. Open a citation instead: it opens the cited page, not page 7 | ☐ | ☐ | ☐ |
| 3.20d | In the reader press "Ask about this page": the reader closes, the composer holds a complete question, and nothing has been sent | ☐ | ☐ | ☐ |
| 3.20e | Type half a note, turn the page, come back: the text is still there, and it was never saved as a note | ☐ | ☐ | ☐ |
| 3.20f | The sources panel under an answer shows `Matched: lever, moments` for a page that shares words, and a plain note when it does not | ☐ | ☐ | ☐ |
| 3.20g | Switch the interface to తెలుగు and open a citation: the reader's buttons, note box and hint are in Telugu, with no English island left | ☐ | ☐ | ☐ |
| 3.21 | Settings → Study & AI: the search card reads "Where outside answers come from", and there is no `{q}`, no URL with braces and no "endpoint" anywhere until "My own search service" is chosen | ☐ | ☐ | ☐ |
| 3.21b | On the language board no two tiles show the same character: English shows EN, Español ES, Português POR, Polski POL, Türkçe TÜ, Tiếng Việt TI, اردو ار, العربية ال | ☐ | ☐ | ☐ |
| 3.21c | Type `francais`, `turkce` or `portugues` with no accents: each still finds its language | ☐ | ☐ | ☐ |
| 3.21d | Type `zzz`: the message quotes what you typed and a "Show all 33 languages" button clears the box and brings every tile back | ☐ | ☐ | ☐ |
| 3.21e | Tap the language that is already selected: a short note says you are already using it, instead of nothing happening | ☐ | ☐ | ☐ |
| 3.21f | On a 360px phone the glyph is still clearly larger than the name — around 22px, not 17px | ☐ | ☐ | ☐ |
| 3.27 | Any screen: the title is visible above the content, numbered 01–10, and matches the sidebar item you tapped | ☐ | ☐ | ☐ |
| 3.27b | Corners are square in Minimal and Terminal (Settings → Look & language) | ☐ | ☐ | ☐ |
| 3.27c | On a phone the bar has Ask, Library, Quiz, Exams, Progress, More — and More opens a menu listing all ten screens | ☐ | ☐ | ☐ |
| 3.27d | Scroll to the bottom of Settings, tap Ask, then tap Settings again: you return to where you were, not to a random offset | ☐ | ☐ | ☐ |
| 3.27e | Tab through the page with a keyboard: every control shows a 2px outline, and the current screen is announced | ☐ | ☐ | ☐ |
| 3.26 | Settings → App & offline → switch **Offline mode** on: the chip in the top bar reads "Offline mode" and the web switch is greyed out | ☐ | ☐ | ☐ |
| 3.26b | With offline mode on, ask a question and check the network panel (or turn Wi-Fi off): no request is made, and the answer still cites your pages | ☐ | ☐ | ☐ |
| 3.26c | Turn offline mode off: the web switch returns to whatever it was before | ☐ | ☐ | ☐ |
| 3.25 | judge.html: the "files precached" number, the sample offline output and the release number all match this build — a test runs the simulator and compares | ☐ | ☐ | ☐ |
| 3.24 | Ask any question that finds a page: the answer appears with its source cards and **no** second bubble saying "I could not complete that answer" | ☐ | ☐ | ☐ |
| 3.24b | Open a source card: "Read this page" and "Copy quote" are both present and work | ☐ | ☐ | ☐ |
| 3.23 | Library → Add the starter pages, then ask "What is photosynthesis and why does it matter?": the answer cites the Biology photosynthesis page, not a chemistry page about matter | ☐ | ☐ | ☐ |
| 3.23b | Ask "Why does a body float in water?" and "What is pH?": each is answered from a page that actually explains it | ☐ | ☐ | ☐ |
| 3.23c | Ask something the pages do not cover, such as "what is the Pauli exclusion principle": the answer refuses and names the closest page instead of inventing one | ☐ | ☐ | ☐ |
| 3.23d | Open judge.html → section 06: the answer benchmark paragraph is there and names the test file that enforces it | ☐ | ☐ | ☐ |
| 3.22 | No stray markup anywhere: no line reading `id="view-friends" data-panel="friends">`, and each of the ten screens appears once (Settings → as you tab through Ask, Library, Quiz, Exams, Flashcards, Friends, Chat, Play, Progress, Settings) | ☐ | ☐ | ☐ |
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

## 5. A released version reaches the device

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.1 | Settings → *App & offline* shows the current release number | ☐ | ☐ | ☐ |
| 5.2 | There is no update button and no banner: publishing is the whole gesture | ☐ | ☐ | ☐ |
| 5.3 | Publish a release, open the app on a phone that already has it: within a minute the page reloads **by itself** into the new release | ☐ | ☐ | ☐ |
| 5.4 | Type half a question (do not send) and publish a release: the page does **not** reload on top of the draft; send or clear it and the reload happens by itself | ☐ | ☐ | ☐ |
| 5.4b | Publish a release while an answer is being written: the answer finishes first, then the page reloads — it is never cut off | ☐ | ☐ | ☐ |
| 5.5 | Saved books, chats and streaks are still there after that reload | ☐ | ☐ | ☐ |

## 5b. The simple shell — one chat, one logo

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.6 | The app opens on a chat: greeting, four chips, a question box on the bottom edge. No sidebar, no top bar, no numbered header | ☐ | ☐ | ☐ |
| 5.7 | The logo is a 40px square in the **top-left** corner and opens the drawer with account, chat, history, library, quiz, exams, flashcards, progress, friends, Study Hall, play, settings, install and theme | ☐ | ☐ | ☐ |
| 5.7b | In Library, **Chat** returns to the conversation with every message intact; **New chat** asks before clearing it | ☐ | ☐ | ☐ |
| 5.8 | The question box sits in the middle of the **bottom edge** on every screen size, only the messages scroll, and nothing sits above the conversation | ☐ | ☐ | ☐ |
| 5.8c | Opening the phone keyboard lifts the box above it instead of hiding it behind | ☐ | ☐ | ☐ |
| 5.8b | Swiping in from the left edge opens the drawer; swiping back, tapping the darkened chat, or pressing Escape closes it | ☐ | ☐ | ☐ |
| 5.9 | The **+** beside the question box opens the sheet; **Upload a textbook** opens the file picker without visiting Settings, and the book answers questions afterwards | ☐ | ☐ | ☐ |
| 5.10 | **Fetch a website** reads a public page, the question box is pre-filled about it, and the answer is labelled outside your textbooks | ☐ | ☐ | ☐ |
| 5.11 | **History** lists the questions asked on this device, newest first; tapping one puts it back in the box | ☐ | ☐ | ☐ |
| 5.12 | **Install the app** installs the website (full screen, offline) and states plainly that an `.apk`/`.exe` needs a build machine | ☐ | ☐ | ☐ |
| 5.13 | Escape closes the menu, then a sheet; focus returns to the logo; Tab stays inside the menu | ☐ | ☐ | ☐ |

## 5c. Code practice and conversation memory

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.14 | **Code practice** opens from the drawer and shows three languages and four lessons each; every lesson has one idea, one example and one thing to try | ☐ | ☐ | ☐ |
| 5.15 | **Explain this example** reads the lesson's code line by line in plain words; the same works for any code pasted into the box | ☐ | ☐ | ☐ |
| 5.16 | A line the rules do not recognise is marked as unrecognised, not guessed at; missing colons, `=` where `==` belongs, unclosed braces and unclosed tags are named | ☐ | ☐ | ☐ |
| 5.17 | **What will this print?** marks "17 / Done" as correct and says which line differs when the answer is wrong; a program with a loop or an `input()` says it cannot be predicted instead of inventing an output | ☐ | ☐ | ☐ |
| 5.18 | Pasting a program into the chat gets the same line-by-line reading; "teach me loops in python" opens the lesson; "explain the functions of the heart" still searches the library | ☐ | ☐ | ☐ |
| 5.19 | Typing "why is it important?" after a question shows **Continuing: <that question>** above the box, and the answer stays on the same topic | ☐ | ☐ | ☐ |
| 5.20 | A new question with its own subject ("List the parts of a flower") carries nothing over, and greetings never do | ☐ | ☐ | ☐ |
| 5.21 | With the Wi-Fi off, the code reader and the lessons still work, and a follow-up to a library answer continues from the same cited pages | ☐ | ☐ | ☐ |

## 5d. The landing page

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.22 | `/welcome` opens on a phone and on a laptop, and the hero fits without sideways scrolling | ☐ | ☐ | ☐ |
| 5.23 | The four moves in the specimen panel finish visibly: question, cited answer, follow-up with the **Continuing:** chip, second answer | ☐ | ☐ | ☐ |
| 5.24 | The language board shows all thirty-three languages at once, each in its real script, and none of it moves on its own | ☐ | ☐ | ☐ |
| 5.25 | All eleven cards open the app, and each one names a screen that exists in the drawer | ☐ | ☐ | ☐ |
| 5.26 | The five numbers match `/judge.html`, and **Re-run all of it** opens the judge page | ☐ | ☐ | ☐ |
| 5.27 | Turn on the phone's "Remove animations" / "Reduce motion" setting and reload: every part of the page is still visible, nothing is stuck at zero opacity | ☐ | ☐ | ☐ |
| 5.28 | With the Wi-Fi off, `/welcome` still opens (it is in the offline cache) and shows every section | ☐ | ☐ | ☐ |

## 5d2. The answer has to be on screen

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.36 | Ask anything on a phone. The answer's **first line** is at the top of the reading area — not its last paragraph, and not below the fold | ☐ | ☐ | ☐ |
| 5.37 | Ask for a long answer (an exam-style one). The beginning is what you see; the end is a short scroll away | ☐ | ☐ | ☐ |
| 5.38 | Scroll up mid-answer. When the answer lands, the page does **not** jump; a **↓ Newest answer** pill appears above the box | ☐ | ☐ | ☐ |
| 5.39 | Tap the pill: it lands on the first line of the answer, and the next answer pins normally again | ☐ | ☐ | ☐ |
| 5.40 | Ask a follow-up with a long answer while the keyboard is open: the box stays visible and the answer still starts on screen | ☐ | ☐ | ☐ |
| 5.41 | On a phone with a conversation open, the starter chips and the answer-style row are gone, leaving the conversation the screen | ☐ | ☐ | ☐ |

## 5e. Writing (ten pieces)

| # | Check | P | T | L |
| --- | --- | --- | --- | --- |
| 5.29 | **Writing** opens from the drawer, from the landing page's top bar and from its ten-piece band, and from every legal page footer | ☐ | ☐ | ☐ |
| 5.30 | `/blog` lists all ten pieces with a date and a reading time; each title opens the piece | ☐ | ☐ | ☐ |
| 5.31 | A piece is comfortable to read on a phone: one column, no sideways scrolling, numbered section headings, quotes indented | ☐ | ☐ | ☐ |
| 5.32 | Every piece ends with **How you know it worked**, and offers the next piece, the full list and the app | ☐ | ☐ | ☐ |
| 5.33 | The RSS link in the footer opens a feed a reader app can subscribe to | ☐ | ☐ | ☐ |
| 5.34 | View source on a piece: one canonical URL, a description, and structured data whose headline matches the heading on the page | ☐ | ☐ | ☐ |
| 5.35 | With the Wi-Fi off, `/blog` and a piece open from the offline cache | ☐ | ☐ | ☐ |

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

The quickest regression test for a UI fix is `npm test` (748 checks) plus
`npm run offline:check`. If both pass and the screen looks right, ship it.

### Search, links and Judge instructions (2.46.0)

- [x] Chromium at 390, 768, 1024 and 1366px: all four citation-step explanations
  share the title's wide column rather than the number column (306–1118px text width).
- [x] Browser: “turn on web search” confirms immediately without search/model calls.
- [x] Browser: attach a public HTML page, import/index it and prepare a question;
  upstream HTML mocked because the sandbox cannot reach arbitrary websites.
- [x] Regression tests: stalled transport/body, caller cancellation, stalled search
  and link APIs, web-search commands, Judge placement and presentation copy.
- [ ] Production: repeat a public webpage fetch and a real online search on the
  deployed host. This is not proven by mocked transport tests or local offline mode.

### Successful public fetch, not only error paths (2.46.0)

- Root defect: `handleFetch` called nonexistent `securityHeaders()` after a
  successful download, so it returned 502. Use `baseSecurityHeaders(request)` and
  `Cache-Control: no-store`. A spawned-server success test now covers this path.
- GitHub repository roots use the public README API and decode validated base64;
  provenance explicitly says README only. No clone, code execution, authentication
  forwarding or automatic use of the API's download URL. Private repositories,
  missing READMEs and API throttling produce explanatory errors.
- A safe `.txt` filename prevents repositories ending in `.js` from being mistaken
  for executable script imports. Ordinary pages retain the existing guarded fetch.
- Live local endpoint → actual GitHub → file validation → passage indexing:
  `nodejs/node`: 43,193 bytes / 22 passages; this project: 113,847 bytes / 125 passages.
  These runs used real responses, not mocks. The sandbox required its installed
  system CA via `NODE_EXTRA_CA_CERTS`; certificate verification was not disabled.
- Reproduce with `node tools/check-public-links.mjs` while the server is running.
  This optional live check is separate from deterministic offline CI.

### Start and presentation readiness (2.46.0)

- Chromium: presentation navigation and no horizontal overflow at 390, 768, 1024
  and 1366px; all seven story sections and the return-to-Start link are present.
- Chromium: Start opens every study destination and submits through real Chat.
- Chromium: 33 language tiles form eleven rows of three at those four widths.
- Chromium with mocked cloud: ready hosted AI routes untouched defaults to
  `/api/ai`; Nezaad switches local selection to hosted AI and exit restores local.
- Existing Chromium chat geometry and Judge instruction checks still pass at all
  five tested phone/tablet/desktop dimensions.
- Real tablet keyboards, provider quota and account-backed shared activities still
  require deployment/device verification. No new claim of a live provider test.

### 2.46.1 smoothness regression checks

- Queue tests: one glass attachment per frame, duplicate suppression, stop/exit
  cancellation, detached-node cleanup, and added-subtree-only mutation scans.
- Reveal test: all geometry reads precede reveal class writes.
- Chromium: Presentation/Start/33 languages at 390, 768, 1024 and 1366px;
  all eleven Start destinations and real Chat submission; no page errors.
- Chromium Chat geometry: empty/long answers at 1024×768, 800×1280,
  768×1024, 390×844 and 1366×768. Hosted routing checks use mocked inference.
- No claim of measured device FPS improvement or live provider quota validation.

### 2.46.2 security and notices

See `docs/SECURITY-LEGAL-REVIEW.md` for findings, validation and outstanding
operator actions. Private-path bypass reproduced locally and regression-tested;
all ten policy pages checked in Chromium at phone/tablet/desktop widths. Policy
consistency is not legal certification. Deploy the server, not just PWA assets.

### 2.46.3 API / WebLLM / stack regression checks

See `docs/API-RUNTIME-REVIEW.md`. Cancellation, worker recovery and command
serialization, cache-deletion errors, offline routing, invalid JSON and shared
provider deadlines are tested. Optional `tools/check-local-runtime.mjs` imports
the real worker in Chromium but does not prove GPU generation. Live key quota
and actual device-model downloads still require separate verification.

### 2.47.0 recovery and cached availability

See `docs/RECOVERY.md`. API → ready WebLLM → offline composition is tested,
with no recovery downloads or cancellation retries. Cooldown/reset/opt-out and
category-only diagnostics are covered. Hosting 5xx uses cached navigation, and
an incomplete essential module cache cannot activate over a working worker.
Browser recovery and five-size Chat geometry gates pass; inference is mocked.

### 2.47.1 artwork and appearance

- `tools/check-appearance.mjs`: all 17 real theme tiles, ten distinct computed
  painted backgrounds, actual thumbnail decoding, and no artwork HTTP errors.
- Anime/painting selector tested at 390/768/1366px with no horizontal overflow.
- Deliberate Minimal choice and light/dark value survive a real browser reload.
- Generated palette blocks use `background-color`, not a `background` shorthand
  that clears the painting. Existing theme palette/contrast tests still pass.

### 2.47.2 reliability and efficiency pass

- Updates: changing tab visibility is not an update signal; genuine updates still
  respect the busy/unsent-question guard and reload at most once.
- Cache activation deletes only this app's old release caches, preserving local
  model and unrelated caches. Operator pages bypass interception; private and
  no-store network responses are not written to the app cache.
- Blocked cache opening/matching cannot prevent successful network responses.
- Social polling unregisters its visibility listener on stop; repeated starts are
  idempotent. Leaving lite mode removes the correct `data-lite` attribute.
- New optional real-worker Chromium gate: `tools/check-browser-resilience.mjs`.
  Model-cache verification uses a synthetic marker, not downloaded model weights.
- 779 tests / offline checks pass. Appearance (17 looks), recovery, real runtime
  import and five-size Chat browser gates pass. Live inference remains unverified.

### 2.47.3 fresh-visitor recheck

Previous gates skipped the first-run tour. A real fresh tablet profile exposed
its fixed card overlapping the Start heading and Ask form. The guide now sits
in document flow on each step's screen. Login introductory copy has a readable
glass backing, and tablet login columns leave enough width for that copy.

`tools/check-first-visit.mjs` clears origin storage between 390/768/1024/1366 px
runs, verifies login backing/no overflow, all eight tour targets unobscured,
completion to Start and question submission. This does not test live providers.
`check-study-start.mjs` also accepts automatic guest entry when accounts are
unavailable, instead of clicking the already hidden login gate in that case.

### 2.48.0 — question variety and learning studio

- Quiz defaults to Mixed; offline MCQs use full statements, short answers ask
  for explanation, AI malformed/all-fill mixed output triggers offline fallback.
- Start → Speak & write and drawer → Learning studio: essay outline/draft/feedback,
  configurable pass-and-play human/AI debate teams, explicit turns, cancellation,
  transcript export and post-debate AI coaching. No fake offline model speeches.
- Science-event preparation for Chekumuki, National Science Seminar and science
  fairs with independent exercises, four original questions and rehearsal timer.
  These are not official full exam packs. Current rules must be checked elsewhere.
- Library official Telangana SCERT link plus PDF-import guidance; no books bundled.
- Presentation runbook and privacy/feature limits: `docs/LEARNING-STUDIO.md`.
- 787 tests plus offline/secret checks; rendered studio four-width gate uses a
  mocked provider, including a failed request with no skipped/erased turns.

### 2.49.0 — private online text debate

- Learning studio → Online debate: signed-in invitation rooms, 6 human / 4 AI
  caps, host teams/start/skip/close/rotate, server turns/deadlines/revisions,
  shared transcript, explicit hosted AI turns/coaching, export and reload restore.
- Shared-device debate remains unchanged. Online polling is ~4 seconds, not video
  or websocket streaming. Hidden/offline tabs pause reads and typed drafts survive
  polling; manual reload loses only unsent text.
- New private RLS migration required for hosted Supabase: `npm run sql:debate`.
  Not applied to production in this session. See `docs/ONLINE-DEBATE.md`.
- 796 tests / offline / secret checks. Real HTTP and two-isolated-browser-session
  local multiplayer gates pass. AI races/failures are controlled tests; no live
  hosted inference, production Supabase or production multiplayer pass claimed.

### 2.49.1 — less background work, stable room controls

- Unchanged online-room polls update freshness without rebuilding controls or
  transcript DOM. Invitation selection/focus is preserved. Revision/pending
  changes still render. Older-account read completion cannot unlock a newer read.
- Chat and Play scheduled polling pauses on other screens, hidden tabs and
  offline devices. Social badge polling also skips hidden/offline starts/ticks.
- Decorative background/tour movement pauses on hidden tabs without hiding
  artwork or stopping functional progress indicators. Motion observer cleanup
  also runs when reinitializing with reduced motion.
- Seminar stopwatch skips offscreen/hidden DOM updates but retains elapsed time.
- 800 tests, offline and secret checks pass. Real two-account local room gate,
  four-width studio gate, hidden-background/stopwatch gate and all17 appearance
  gate pass. No FPS, battery-life or live provider benchmark is claimed.
- An intermittent server-test startup failure exposed a weak test harness: it
  chose random ports and discarded logs. It now uses OS-assigned ports, waits
  for the actual listening message and reports startup errors. Final full run:
  800/800, offline simulation passed. Five-size pinned-chat gate also passed.

### Solo Play release 2.50.0 / v94

- Automated: 813 tests + offline/secret checks pass. `tools/check-solo-games.mjs`
  verifies guest chess/quiz/maths/words, real worker, hints/undo, daily replay,
  review, saved records, three viewport widths and offline reload/computer opening.
- Chromium study/start regression passes navigation, four widths and language grids.
- Still manually check: physical tablet touch/keyboard chess and screen reader;
  first online cache then airplane mode; deployed release/version and online
  multiplayer with two accounts. Solo bests are browser-only; no synced progress.

### Intro/appearance release 2.50.1 / v95

- 814 tests, secret scan and offline simulator pass.
- Real Chromium: intro/login isolation and overflow at three widths; 17 themes,
  ten decoded/distinct paintings, background/palette independence, actual glass
  filters, clear canvas wrappers, solid toggle and reload persistence pass.
- Solo worker/offline gate, five-size chat layout and four-size Start/presentation/
  language/navigation gates pass. Tablet intro/settings screenshots inspected.
- Manual deployment check: fresh tab intro must not show login; dismiss → usable
  login/guest. Settings → Look & language → choose picture → change palette:
  picture and glass should stay. Try solid checkbox and reload in airplane mode.
- Physical device/screen-reader checks and Render production verification pending.
