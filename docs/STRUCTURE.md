# Where everything is

One repository, three kinds of file: the app that runs in the browser, the
server that serves it, and the paper trail that lets a judge check it. The
layout below is the whole map; if a file is not here, it is in `vendor/` and it
is somebody else's.

```
/
├── index.html              the app (one document, eleven screens)
├── welcome.html            the landing page — no JavaScript at all
├── judge.html  privacy.html  terms.html  security.html  copyright.html
├── blog/                   ten pieces + an index, hand-written HTML
│
├── js/                     75 modules, native ES modules, no bundler
├── styles*.css             11 stylesheets, one per surface (see below)
├── assets/                 the two bundled fonts, brand marks
├── icons/                  app icons, 48 → 512, plus the maskable pair
├── vendor/pdfjs/           the PDF reader, vendored so it works offline
│
├── serve.mjs               the whole server: static, API, health, security
├── server/                 accounts, social store, games, Supabase bridges
├── supabase/               migrations and edge functions
├── sw.js                   the service worker (and the release number)
├── precache.json           generated: every file the worker installs
├── manifest.webmanifest    the installable-app manifest
│
├── tests/                  75 files, `node --test`, no dependencies
├── tools/                  precache generator, offline simulator, secret scan,
│                           the live-deploy check, and the address rewriter
├── docs/                   this folder: design, deploy, credits, checklist
└── .github/                CI and the two issue templates
```

## The root rule

The root holds what a browser, the service worker or a judge asks for by name:
the seven pages, the stylesheets, the icons, the manifest, the worker, the
precache list, the server and the package file. Documentation lives in `docs/`,
because a page and a policy document are not the same kind of thing and the
root was starting to read like both.

Moving a file out of the root is not free: every `?v=` reference, the worker's
`CORE` list and `precache.json` are generated from what is actually there.
`tests/organisation.test.mjs` fails the build if a page links a file that is not
in the repository, or if a Markdown file other than `README.md` and `LICENSE`
turns up in the root again.

## The JavaScript

| Group | Modules | What it does |
| --- | --- | --- |
| The shell | `boot`, `app`, `shell`, `premium-ui`, `ui`, `motion`, `viewport`, `themes` | one document, eleven views, one drawer |
| Answers | `answer`, `answer-quality`, `retrieval`, `context`, `vector`, `llm`, `providers`, `model-router`, `key-pool`, `local-ai`, `web`, `external-answer` | retrieval first, a citation or a refusal, then the model |
| Study | `quiz`, `flashcards`, `study-decks`, `study-sheet`, `revision-plan`, `exam-packs`, `model-paper`, `code-mode`, `progress`, `notes`, `memory` | the things a student does with a chapter |
| People | `social`, `friends-ui`, `chat-ui`, `chat-scroll`, `play-ui`, `chess`, `avatars`, `study-card` | friends, the Study Hall, games, and a cited answer that can leave the app |
| Reading | `reader`, `ingest`, `files`, `link-reader`, `text`, `languages`, `i18n`, `translations-core` | PDFs, OCR, thirty-three languages |

## The stylesheets

`styles.css` is the base; the rest layer on top and are loaded by the pages that
need them. `styles-welcome.css` belongs to the landing page alone and never
loads into the app, which is why the landing page can be a document while the
app is an application.

## What is generated, and never edited by hand

- `precache.json` — `npm run precache`, from the files that exist and the
  release number in `sw.js`.
- `icons/` — `tools/generate-icons.py`.
- Any `?v=` query string — the release, bumped in one pass; a test fails if two
  files disagree about it.
