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

The quickest regression test for a UI fix is `npm test` (536 checks) plus
`npm run offline:check`. If both pass and the screen looks right, ship it.
