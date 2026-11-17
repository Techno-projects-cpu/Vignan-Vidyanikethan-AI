# Design notes

What this interface is, in the rules it follows, and — just as important — the
places it deliberately breaks a generic rule. Written so that the next person
(or the next agent) does not "fix" a decision back into a defect.

## The law

- **Black, grey and white.** Every hex in `styles-welcome.css` and
  `styles-premium.css` is greyscale, and a test fails if a colour appears. The
  only exceptions are the bundled score-studio styles, which are an artist's
  choice inside a document, not part of the shell. Black is `#000000`, not a
  tinted near-black: `#080808` reads as a dark grey the moment it sits next to a
  true black, which is the tell that gives it away.
- **Square corners, hairline rules.** No `border-radius` in the landing page or
  the premium shell; cards share a single 1px border instead of casting a
  shadow. Depth is a line, not a blur.
- **One grey floor for text.** Body copy on `#080808` uses `#8a8a8a` or lighter
  (5.80:1). `#5f5f5f` (3.14:1) and `#6f6f6f` (3.99:1) were removed in 2.23.0.
- **One size floor.** Nothing functional is set below 11px, including the mono
  labels, the index numbers and the legal fine print.
- **Motion is a courtesy, never a claim.** Nothing loops on its own. The two
  landing-page animations are entrances; the reduced-motion block restores every
  element that starts hidden, so a reader who dislikes motion sees the whole
  page rather than an empty hero.
- **No JavaScript on the landing page.** `/welcome` is a document: no script
  tag, no host but this one, and it must still read correctly with CSS motion
  switched off.
- **No accent bar down one side of a card.** A thick `border-left` in a colour
  is the most recognisable generated-UI tell there is. Meaning is carried by a
  tinted surface, a full hairline box, or the colour of the text.
- **No glow.** No zero-offset shadow with a blur on a coloured value, no
  chromatic radial wash behind type. Elevation is a line, not a light.
- **No decorative field.** No repeating-gradient stripes and no tiled
  two-axis grid background: if a surface needs structure, draw it with real
  borders.
- **Pro Mode is drawn in ink.** The easter-egg boot keeps its scan, reticle and
  letter beats in white on black; it is not a neon HUD.
- **A link says where it goes.** No `↗` glued to the end of a link or a button,
  and no arrow standing in for a label. The words carry the meaning; the arrow
  was decoration that meant "external" on some links and "go" on others, which
  means it meant nothing. A test fails on the glyph.
- **Labels are not shouted.** All-caps is a property of the display voice — the
  landing title, the three section headings, the closing line — and nothing
  else. Eyebrows above content (`LOCAL ENGINE`, `VERIFY`, `YOUR STUDY SPACE`)
  were sentence case or gone, and a test reads the stylesheet and fails if
  `text-transform: uppercase` appears on any other selector.
- **Monospace is for numerals.** Folios, list indexes, the page number on the
  specimen plate. Not for small data labels, not for tags, not for emphasis.
- **No element enters the way another one does.** One fade-and-rise, copied onto
  every block with a delay, is the signature of a page that was assembled rather
  than designed. The hero sets its three lines three ways and turns the plate in
  perspective; a margin rule inks itself down; a drawing draws itself. A test
  fails if two hero elements ever share an entrance again.
- **Movement comes from the material.** The vocabulary of this page is
  hairlines, margin rules and type. So the motion is lines being drawn, type
  being set, a sheet being turned — never stripes, fields, parallax or glow. If
  a movement could belong to any other site, it does not belong here.

Those five, the size floor, the grey floor and the "nothing loops" rule are
asserted in `tests/design-rules.test.mjs`, so they survive the audit tool being
uninstalled.

## Deliberate breaks, with the reason

These are reported by `impeccable detect` **and are not defects**. Each one is a
decision that has a cost, and the cost is accepted. Every entry is machine-readable
in [`.impeccable/config.json`](../.impeccable/config.json) with the same reason, so
a reviewer can see what was suppressed and why.

| Reported as | Where | Why it stays |
| --- | --- | --- |
| `overused-font` | every page | Space Grotesk is the brand face and the only display font bundled locally (`assets/fonts/space-grotesk-latin.woff2`). Swapping it to satisfy a popularity heuristic would change the identity to no one's benefit. |
| `numbered-section-labels`, mono `01 — 03` | hero, screens, writing | The numbered index above each title is the layout authority borrowed from [zero-vast.vercel.app](https://zero-vast.vercel.app): a document with sections you can count. It is information about position, not decoration. |
| `tight-leading` | `.wl-cell-title`, `.bl-card-title`, article `h2` | 1.10–1.16 is normal for display type at 19–30px. The rule's 1.3 floor is a body-text floor; applying it to the headlines would make the page look loose, not more readable. |
| `cramped-padding` wall sections | every `.wl-*` section, `bl-list-cards` | The hairline grid **is** the layout: cells sit flush against the shared 1px border on purpose, with the text inset inside the cell. It is also what the static reader gets wrong here: it cannot resolve `clamp()` padding, so 18–28px of real inset reads as zero. Verified by hand, then recorded. |
| `cramped-padding` frames | `gate-tabs`, `gate-optional`, `chat-shell`, `settings-tabs` | Left **visible** rather than suppressed. These are edge-to-edge frames: tabs share one underline, the two chat panes share one hairline, and the text is inset inside the pane. Padding the children would double every rule and break the frame. |

Nothing else is left. The `tiny-text`, `hero-eyebrow-chip`, `dark-glow`,
`radial-halo`, `repeating-stripes-gradient` and `codex-grid-background` rows this
file used to carry were **fixed** in 2.24.0 rather than argued: the copy that was
carrying sentences at 11px is 12.5–13px, the tracked-caps breadcrumb above each
piece is a breadcrumb, Pro Mode is monochrome, the hero grid and the stripe fields
are gone, and the em-dash staccato in the landing copy was rewritten as sentences.

## Where the look comes from (2.25.0)

The landing page stopped being a product page and became a **set book**. The
subject is a school textbook and a machine that quotes it, so the page borrows the
textbook's own grammar instead of a SaaS template's: a 76px margin column with a
folio number and a hairline rule running the height of the row, text set in one
column of a readable measure, hanging quotes, and the specimen answer presented as
a plate with its page number in the gutter. That single idea is the page's one
bold move; everything else on it is quiet so the idea can be seen.

This direction came from Anthropic's `frontend-design` brief (Apache-2.0, 9.4 kB
of Markdown, no code and nothing executed) — applied as a design brief, not as a
generator. What it indicted here was mostly the furniture a generated page
carries: eight all-caps eyebrow labels, thirty-five `↗` glyphs, three `·` meta
strings, a grey `<span>` inside a display headline to accent a phrase, fifteen
monospace uses, and a four-cell `₹0 / 33 / 11 / Tested` stat strip under the hero.
None of that was wrong exactly; it was the shape of a page that had been dressed
rather than written. All of it is gone, and `tests/landing.test.mjs` now fails if
an arrow, a middle-dot meta string, a caps label or a tinted phrase inside a
headline comes back.

The same pass reached the app. The two primary buttons in the ask hero lost their
trailing arrows; `STUDENT BUILT` and `YOUR STUDY SPACE` are sentence case in the
body face rather than a tracked caps tag; the arrow prefixes on three feature
lines (which were not links) are gone; and the blog's palette tokens were moved
onto the landing page's, which is what the palette-parity test in
`tests/blog.test.mjs` had been asserting and politely failing to get. A merge
accident that had given the header badge a two-column layout grid and 54px of
padding was split into its two intended rules.

## Motion, and where the four skills went (2.26.0)

Four external skills were read for this round — bang-motion, huashu-art-motion,
claude-drawing-skill and vox-director. All four are MIT, all four were read
through the public GitHub API, and **none of them was installed or executed**:
no `npx skills add`, no plugin, no hooks. `docs/SKILLS.md` records what each one
is and exactly what was taken from it, including the one that was read and
deliberately not run (vox-director needs a paid API key and ffmpeg to render
video, and neither belongs in a dependency list for a school project).

What changed, in the language the skills use:

- **The anti-slide-deck test.** Four hero elements all faded up with a delay.
  They now have four different movements: ink arriving, the outline word printed
  across the line by a `clip-path` wipe, the sub-line *set* (tracking closing),
  and the specimen plate turned on the Y axis out of a 1400px perspective. A
  test asserts that no two of them share an entrance, because a rule that lives
  only in a document is a rule the next edit breaks.
- **Background never static, movement from the material.** The margin rule of
  every section is now *drawn* downward as the section arrives, scroll-driven
  (`animation-timeline: view()`), and the plate in the claim section draws
  itself in the order a person draws with a pen: construction lines, outline,
  writing, the cited sentence, then the hatching on the shadow side of the
  folded corner. One inline SVG, `pathLength="1"` on every path so a single dash
  rule draws all of them, no image file, no JavaScript, no network.
- **A screen is laid down, not slid in.** In the app the `vn-view-in` fade and
  six-pixel rise is gone; the rule under the active screen's title is drawn
  across in 420ms and nothing else moves. The five goal cards are set down in
  order, and a meter travels to its value. Nothing loops; the global
  reduced-motion rule still cuts every animation to a hundredth of a
  millisecond, and the landing page's reduced-motion block restores the drawing
  to its finished state rather than hiding it.

Two rules came out of this round that now live in the law above: no element
enters the way another one does, and movement has to come from the material.

## Organised, not just tidier (2.26.0)

Six documents moved to `docs/` (design, deploy, local AI, packaging, checklist,
credits) and three stay in the root because the world looks for them there:
`README.md`, `LICENSE`, `SECURITY.md`. `docs/README.md` is the index,
`docs/STRUCTURE.md` is the map, and `tests/organisation.test.mjs` holds the
shape: no Markdown in the root except the two that belong there, every relative
link in the documentation resolves, no page the browser loads links into the
uncached `docs/` folder, and the counts in the map match the repository.

`.github/` now has CI that runs the same command a person runs (`npm run check`,
plus the secret scan first so a leak fails fastest), a pull-request template that
asks the four questions this project actually cares about, and two issue
templates — one for a broken thing, one for a wrong claim, because the second
kind is the one this project is about.

## The deploy was invisible, so now it says what it built (2.27.0)

Not a design change; the reason for one small server change. The live host was
pointed at a pull-request branch. That branch stopped moving when the pull
request merged, so every later release reached `main`, GitHub Pages and Vercel,
and never reached the site a judge would open. The build log was green and every
request answered 200.

`/api/health` now reports `build: { commit, branch, service, hosted }` from the
environment the host provides, and `npm run deployed` compares the live version
against this checkout and named the gap ("1 minor release(s) behind") with the
one dropdown to change. A deploy target is part of the product's honesty: the
judge page promises every number can be re-run, and a number re-run against a
three-release-old host is a lie nobody intended to tell.

## How this was audited

The pages are scanned with [impeccable](https://github.com/pbakaus/impeccable)
(Apache-2.0), the deterministic 62-rule detector — no model, no key, and no
network after the first download:

```sh
npx impeccable@4.8.0 detect index.html welcome.html judge.html privacy.html \
  terms.html blog styles*.css
```

**2.26.0 result: 4 failures and 3 advisories** — unchanged from 2.24.0, which was
itself down from 89 failures and 23 advisories. The rewrite added no new finding, and neither did the motion work: the detector
does not object to a page that draws itself, only to one that dresses itself. The four are the frames in the table above, left visible on purpose.
The three advisories are em-dash saturation in three of the ten pieces, where the
dashes are load-bearing dialogue rather than filler.

What the audit caught that was genuinely wrong this round: a Pro Mode overlay
built from a perspective grid, three coloured radial washes and glow shadows; four
coloured `border-left` accents on cards; a coloured brand shadow and an ellipse
halo; a pulsing 6px dot above the ask hero; stripe fields on the writing and
landing heroes and in the avatar patterns; a dozen rules carrying sentences at
11–11.5px; and fifteen em-dashes in one page of landing copy. All of it is fixed,
and `tests/design-rules.test.mjs` holds the rules so they cannot come back.

Earlier rounds used `impeccable 0.1.18` and took the same tree from 202 findings to
94 (marquee, pulsing dot, seven slogan eyebrows, a hundred declarations of 9–10.5px
text, seven body greys under 4:1). The tool is a development aid only: it is not a
dependency, nothing it produces is served, and the site still builds and runs
offline without it. Do not run `impeccable install` here — it writes agent hooks
that execute outside approval. `detect` alone is read-only and local.
