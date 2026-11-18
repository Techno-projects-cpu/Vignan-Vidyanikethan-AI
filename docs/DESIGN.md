# Design notes

What this interface is, in the rules it follows, and — just as important — the
places it deliberately breaks a generic rule. Written so that the next person
(or the next agent) does not "fix" a decision back into a defect.

## The law

- **The palette is a set of named pigments.** Since 2.31.0 the landing page is
  painted, so colour is allowed — but only the pigments declared once in `:root`:
  warm sumi black, washi cream, paper, ochre, moss, and one vermilion seal.
  `tests/landing.test.mjs` fails if any hex outside a pigment declaration is a
  literal rather than a `var()`, and if any translucent wash is neither neutral
  nor one of those pigments. The app shell (`styles-premium.css`) stays neutral
  grey, because it sits behind a student's work rather than beside a painting.
  The reading pages share the landing page's five core pigments, and a test
  compares the two stylesheets token by token so the halves cannot drift.
- **Square corners, hairline rules.** No `border-radius` in the landing page or
  the premium shell; cards share a single 1px border instead of casting a
  shadow. Depth is a line, not a blur.
- **One grey floor for text.** Body copy on `#080808` uses `#8a8a8a` or lighter
  (5.80:1). `#5f5f5f` (3.14:1) and `#6f6f6f` (3.99:1) were removed in 2.23.0.
- **One size floor.** Nothing functional is set below 11px, including the mono
  labels, the index numbers and the legal fine print.
- **Motion is a courtesy, never a claim.** *Changed in 2.31.0 at the user's
  request — "where are the animations" — from "nothing loops" to a named
  allowance.* Three decorative layers may loop, and only these three: the hero
  painting drifting, the mist crossing it, the dust rising. None of them carries a
  word. Everything that carries type either enters once (and finishes) or is
  driven by the reader's own scroll, so it cannot run ahead of them. The
  reduced-motion block stops all of it and restores every element that starts
  hidden, so a reader who dislikes motion sees the whole page rather than an
  empty hero. A test reads the allowlist out of the stylesheet rather than
  keeping a second copy of it, and fails if anything else ever loops.
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
- **Movement comes from the material.** The vocabulary of this page is ink,
  paper and brush. So the motion is a press laying type down, a sheet being
  turned, a stroke being drawn, a seal being stamped, paint washing across a
  plate, and a room breathing while you look at it. Never parallax on text, never
  stripes, never glow. If a movement could belong to any other site, it does not
  belong here.
- **A picture is a plate, not a hero image.** Four paintings were made for this
  page, and they are used as printed plates: the library at dusk behind the
  opening, the open book with the brush in its gutter beside the claim, a band of
  sumi ink between the painted half and the paper half, and the lantern room the
  page closes in. Every plate is local, WebP, inside a 520KB budget for all four,
  precached by the worker, and described in its alt text. `tests/painted.test.mjs`
  fails if one is missing from the cache, oversized, mislabelled or fetching
  from another host.
- **Text is never set directly on a painting.** The hero puts a wash of ink
  between the plate and the type and sets the type above both; the closing room
  gets the same wash. The inks used there are checked against 4.5:1 in the test,
  computed from the tokens, so a repaint cannot quietly dim the body copy.

Those five, the size floor, the grey floor and the "nothing loops" rule are
asserted in `tests/design-rules.test.mjs`, so they survive the audit tool being
uninstalled.

## The painted edition (2.31.0)

The site proposes a book, so the last release painted the book. Four plates were
made for it in the register of an ink-and-gouache background painting — a school
library at dusk, an open textbook with the brush still in the gutter, a sweep of
sumi ink, and a lantern-lit reading room — and the page now alternates between
two worlds: a painted one where the app is explained, and a paper one where the
reader is being taught.

The type did not change. The headlines are still set in one voice, the body is
still one measure, the folios still sit in the margin, and the corners are still
square. What changed is what is behind them: paper cream instead of black on the
language board, the proof and the writing; a page of paper instead of a dark card
for the specimen answer, lying a degree off square on the table with a vermilion
seal pressed into the painting beside it. The brush strokes under the section
headings and the ensō behind the plate are inline SVG drawn in `currentColor`, so
they take the section's own ink and cost no request.

The app got the same opening and nothing more: a strip of the library fades into
the first screen and leaves as soon as a conversation starts. A student opening
the app to ask a question is not watching a film.

## Glass Morphism, the default (2.34.0)

Eighteen paintings shipped and the app still looked the same on a school tablet,
because the default was the one theme that is *not* painted. The correction was not
to pick a painting as the default — it was to give the site a look that could be
the default: **Glass Morphism**, which is made of light, not of a photograph.

Then the same thing happened one level down. The glass theme was built for a dark
screen, and a dark default in a classroom reads as a phone at night. 2.34.0 repaints
the theme in daylight — pink, sand, turquoise and peach — and adds three painted
rooms that are light enough to sit beside it, so the default is no longer the only
light thing in a set of night rooms.

### Why it is built from gradients

A glass interface needs something colourful behind it to be frosted *over*. That
could have been a photograph, but a photograph is the one thing a low-end phone
cannot afford on its first screen: 40-120KB before a single word is legible. The
fields are painted by the browser instead — four `radial-gradient`s on one fixed
layer, drifting with a compositor transform. The default screen makes **no image
request at all**, and the whole theme is 9KB of CSS.

### The numbers, and why they are numbers

- **60%** the base, `#fdf7f2`; **30%** the four fields at 44–62%; **10%** the lagoon
  teal accent, `#0b726b`, which only ever marks something live — the send button,
  the active tab.
- **The sheet is 58% white.** Not a mood: it is the lightest sheet at which the ink
  still clears **7:1** composited over the *strongest* field, and the accent still
  clears 4.5:1 there. Measured worst case: ink **12.9:1**, muted **6.1:1**, accent
  **4.9:1**. `tests/glass.test.mjs` recomposites all four fields and fails if a
  thinner sheet reads worse without saying so.
- **Blur 8px, saturation 180%, brightness 1.06.** A 24px blur turned the pastels grey; the
  refraction lens is what makes it glass, and the blur is only a safety net under
  the type (2px, the glasswork value, is unreadable where the lens is unavailable).
  Saturation is what makes frosted glass read as
  glass rather than as fog: it concentrates the colour behind it.
- **A light page needs a darker accent, not a brighter one.** White on `#0b726b` is
  **5.78:1**; the first candidate, `#0f8b83`, was 3.92:1 on the page and was
  rejected by the test, not by taste.

### The wall: one painted classroom, full screen

The theme used to draw its own background — four radial fields on a cream page —
and then stood in front of a set of 1280×714 *plates*: pictures made to sit behind
a panel, with a cream paper margin. Both were the same mistake. A gradient has no
detail to bend, and a plate stretched across a screen is a blank wall with a
margin, so the glass had nothing to work with and the theme read as frosted
plastic. **The wall is now one illustration, painted for this project** — a
sunlit classroom with tall windows, a blackboard, wooden desks, a monstera and
dust in the light — and everything above it is thin enough to see it through:

    wall      assets/walls/study-afternoon-{wide,tall}.{avif,webp}
    wash      four pastel fields at 26%          (--tg-wash-1..4)
    veil      20% warm white                     (--tg-veil)
    light     a soft source from above, and the grain
    sheet     --tg-tint at 34%, blur 8px, saturate 180%, plus the rim lens

`tools/optimise-walls.mjs` encodes two framings from the masters — 1920×1080 for a
desktop, 1080×1920 for a phone — because `cover` on a 16:9 painting crops a tall
screen down to its middle third and throws the composition away. The page carries
the wall as a `<picture>` with media-query sources, so only one file is fetched
(90 KB AVIF wide, 103 KB AVIF tall; 162 KB and 181 KB WebP). Both are inside a
220 KB wall budget and the 555-file offline cache.

**It fills the viewport on every screen.** The layer is `position: fixed;
inset: 0; width: 100%; height: 100%; min-height: 100dvh` with `object-fit:
cover`. The previous version used `inset: -7%; width: 100%; height: 100%`, which
looks like a full-screen layer and is not one: with `width` and `height` set,
`right` and `bottom` are ignored, so it covered only the top-left 93% and left a
cream band down the right and the bottom — worst on a phone, where that band was
most of the screen.

`tools/backdrop-report.mjs` composites the whole stack **pixel by pixel** over the
wall's darkest pixel and writes `assets/walls/study-afternoon.backdrop.json`:

| | through the sheet | floor |
| --- | --- | --- |
| ink | **7.2:1** | 7:1 |
| muted ink | **5.3:1** | 4.5:1 |
| accent | **5.4:1** | 4.5:1 |
| ink straight on the wall | **1.3:1** | — |

That last row is why every screen of text sits on a sheet: nothing readable is
placed directly on a painting this detailed.

**The sheet is white at 34%, not 58%.** A 58% tint over a light painting renders
a panel about 85% white — opaque paper, with the room visible only in the margins,
which is exactly how the theme read before this pass. 34% (plus a 30%-to-2%
highlight gradient, which used to peak at 78% and was a second coat of white) lets
the blackboard, the plant and the window frames be read *through* the pane. The
inks pay for the thinner sheet: ink `#221b28`, secondary `#3a323f`, and an accent
`#063a35` taken from the blackboard shadows — one step above pure black, so white
on a filled button is 12.6:1.

**There is one wall, not a picker.** An earlier version offered four room
swatches; they were nearly identical pastels under the same veil, so tapping one
changed almost nothing on screen — a control that does nothing is worse than no
control. The room is the design.

### The drawer

The menu had a real bug: `.app-menu-scroll` was a flex child with
`overflow: auto` and no `min-height: 0`, so instead of scrolling it grew to its
content and pushed the footer out of the panel. Everything below the fold was
unreachable, which is what "the menu is not scrollable" meant. Three declarations
fix it (`flex: 1 1 auto; min-height: 0; overflow-y: auto`), the head and foot are
pinned ends, and the drawer is now a glass sheet over a 2px-blurred scrim rather
than an opaque wall in a second palette.

### The four layers a sheet is made of

1. the tint, at 58% warm white (`#fffaf6`);
2. `backdrop-filter: blur(8px) saturate(180%)` plus the `--glass-lens` refraction, which is the glass itself;
3. `inset 0 1px 0 #fff` — the lit top edge, the single line that stops a
   translucent box reading as a flat rectangle;
4. a specular band that crosses the sheet once on hover **or keyboard focus**, and
   a slow 18s sheen on the sidebar and composer so the screen is never frozen.

### The glass kit: two components, not a repaint

The material above is only interesting if the interface has furniture made of it.
The glass theme carries one control surface of its own (`styles-glass.css` §10),
hidden on every other theme:

- **`.gg-seg`** — a segmented control on the Ask screen. The rail is a frosted,
  lensed pill; the selected item is a white lens with a lit top edge, a shadow
  *under* it and a 14px accent tick, so the selection reads as a physical slider
  rather than a coloured button. It is navigation, not decoration: each item
  carries a `data-view` and the handler calls the same `setView()` the sidebar
  uses, so there is one definition of which screen is open, and `setView()` marks
  the item `aria-current="page"` like every other nav control.
- **`.gg-stats`** — three tiles: paintings, languages, trackers. The numbers are
  checked against `assets/paint/manifest.json` and `SUPPORTED_LANGUAGES` by
  `tests/glass.test.mjs`, so a tile cannot quietly drift away from the release.
  The tiles get the tint and the rim but **not** the lens: each
  `var(--glass-lens)` is a separate SVG displacement filter, and three small tiles
  are not worth three of them.

Lite mode paints the kit flat (no blur, no shadow stack, one inset border) and a
phone stacks the rail above the tiles.

### The three daylight rooms

A painting is only a theme here if its colours can be a page: near 60/30/10, a
dominant tone light enough that dark ink sits on it at 7:1, and an accent that is
either a pigment already in the plate or that pigment taken *down*. Measured:

| theme | plate | dominant / secondary / accent | page | accent |
| --- | --- | --- | --- | --- |
| blush | `blush-hall` | 48.8 / 44.9 / 6.3 | `#fdf4ee` | `#17635a` (6.52:1) |
| sand | `sand-desk` | 70.5 / 20.9 / 8.6 | `#fdf8f1` | `#725729` (6.39:1) |
| mint | `mint-class` | 67.0 / 22.5 / 10.5 | `#f8fdfa` | `#6f4f22` (7.25:1) |

On a light plate the accent is the same pigment **deepened**, which is why
`PAINTED_THEMES` carries `accentSource: "deep"` and the test checks **hue distance**
(≤26°) rather than ΔE: ΔE cannot tell a shade from a stranger.

### The cheap mode is part of the design

Blur is a per-panel GPU pass, and that is the whole cost of this theme. `data-lite`
is set from the device (≤4 cores, ≤4GB, or a metered connection) and it cuts the
blur to 8px, raises the tint to 80% so the sheets stay opaque enough to read on
without the blur carrying them, and stops every animation. A phone in Guntur gets the idea of glass
without the bill for it.

### The paintings stay, and they got faster

Ninety-six encodings of twenty-four paintings: a canonical 1280px WebP for a
full-bleed theme, a 640px AVIF/WebP pair for a gallery tile, and a placeholder
colour per plate so a tile never flashes an empty box. AVIF is served first —
roughly 40% smaller than WebP at the same quality — and the whole set is inside a
measured budget, so "add a painting" cannot quietly make the site slower. The
canonical set is **997KB** (606KB of it AVIF); the tiles are **373KB** as WebP and
**261KB** as AVIF, which is about 11KB per tile on a phone.

And every one of the twenty-four is on the landing page, because a painting that
exists only in `assets/` is a painting nobody sees: eleven as room tiles (glass has
no plate), nine framed as pictures, five hung as the accents worn inside the night
rooms. `tests/painted-themes.test.mjs` fails if a plate on disk is on neither a
theme nor the page.

**Minimal** is still a style, and so is **Legacy**; neither was removed. Glass is
simply what a device that has never chosen now opens on.

## The painted edition, twelve plates (2.32.0)

2.31.0 proved the idea with four plates. 2.32.0 makes it the system: **twelve**
painted backgrounds, twelve measured palettes, seven of them full themes in
Settings, and the four-plate look kept intact as the theme called **Legacy**.

### A plate is either a ground or a picture, and the measurement decides

The first genuine design problem was not generating pictures, it was deciding
which ones may sit under text. Colour theory answers it if the answer is allowed
to be a number. `tools/palette-report.mjs` decodes each WebP with Magick, converts
pixels to CIELAB and runs a deterministic k-means to get three roles — dominant,
secondary, accent — then reports the share each one holds.

By the 60-30-10 rule a ground may carry an interface only if its measured share is
within tolerance of 60 / 30 / 10 (±8 / ±8 / ±5, applied by `balance()` in
`js/colour.js`). The measurements split the set cleanly:

| Plate | Dominant / secondary / accent | Verdict |
| --- | --- | --- |
| rain-window | 59.5 / 32.3 / 8.2 | ground — the reference case |
| book-stair | 67.3 / 24.4 / 8.3 | ground |
| paper-night | 67.8 / 20.4 / 11.8 | ground (Legacy) |
| aurora-teal | 71.2 / 20.4 / 8.5 | ground |
| ember-rose | 73.0 / 15.5 / 11.6 | ground |
| moss-hall | 74.2 / 16.4 / 9.4 | ground |
| indigo-shelf | 64.8 / 19.7 / 15.5 | ground |
| brush-band | 70.0 / 20.4 / 9.6 | accent plate |
| library-dusk | 46.1 / 28.3 / 25.5 | accent plate |
| dawn-desk | 51.4 / 27.2 / 21.4 | accent plate |
| frost-glass | 46.4 / 35.9 / 17.8 | accent plate |
| open-book | 44.4 / 43.0 / 12.5 | accent plate |

That is not a taste judgement: a plate at 46 / 36 / 18 has no dominant field for
type to sit in, so it is hung as a framed picture instead — a full-bleed section
with no interface text over it. The distinction is asserted in
`tests/painted-themes.test.mjs`, which fails if a theme claims a ground it cannot
measure.

### A theme's colours are the plate's colours

Every theme value is derived, not chosen. For each ground plate the script takes
the dominant tone, scales it down in linear light until lightness is at most 16
(the page), takes the mid-tone with the *same hue* (within 1°) and less light for
the panel, and lifts the accent until it is the most chromatic of the three.
Ink is the plate's own cream, checked at 8.6:1 against the page. Then the glass
alpha is the smallest value at which ink still clears 4.6:1 when the panel tint is
composited over *every* role in the plate — the worst case, not the average.

The two exceptions are documented in `js/theme-paint.js` with an `accentSource`
field rather than a comment nobody reads. **Legacy** takes its accent from the
house seal (`#b23a29`, lifted to ΔE 14.7 so it reads as the same vermilion in a
darker room). **Ember** takes a mid-tone rather than the k-means accent, because
its accent was a highlight rather than a pigment.

The test uses two different measurements on purpose. ΔE (CIEDE2000) answers "is
this a different colour?" — the right question for panel versus page. Hue distance
answers "is this the same pigment under less light?" — the right question for the
two escape hatches, where ΔE cannot distinguish a shade from a stranger.

### Glass, because there is a painting under it

Every card, panel, command panel, sidebar and composer on a painted theme is a
frosted sheet: `backdrop-filter: blur(18px) saturate(118%)`, the panel tint at
55–76% over a `noiseDataUri()` grain so the surface has a tooth rather than
looking like a gradient. The tint is thick enough that the ink test passes over
the *busiest* part of every plate — that is why the alphas differ per theme (0.60
on book-stair, 0.76 on ember-rose) instead of being one shared number.

The generator auto-thickens a theme's glass if any ink falls below the floor, which
is how `rain` moved from 0.60 to 0.66: its cream accent made a thin panel fail.

### Motion, and why the page moves at all

The complaint that produced this round was that the animations were not visible
enough. The answer is not bigger decoration on the same elements; it is to give
every part of the page a job that involves moving, and to make the movement part
of the reading.

- **The view itself arrives.** `vn-view-in` wipes the screen with a clip-path,
  rises 16px and settles from 0.996 scale over 420ms, on every screen change.
- **Content arrives in an order.** `vn-panel-in` staggers the first six children of
  a panel from 40ms to 240ms, so a page assembles rather than appearing.
- **Glass answers the pointer.** A specular sweep crosses a painted card on hover
  and on `focus-within` over 900ms — one sweep, not a shimmer, and it runs for a
  keyboard user too.
- **The landing page is read, not scrolled past.** Cells, steps, numbers and the
  closing lines rise 10px as they enter the viewport, driven by
  `animation-timeline: view()` — no script, no scroll listener. The ink band under
  the claim finishes drawing itself as you reach it.
- **The paintings keep moving.** Twelve plates, each with its own 46–58s drift, so
  no background is ever static; the landscape keeps its mist, motes and ensō.

Everything above is in a `prefers-reduced-motion: reduce` block that sets the
final state, and the painted sheet's own reduced-motion rule stops the drift. No
animation carries words: the loading indicator is a drawn stroke, not moving
type, and no sentence is ever animated in and out of legibility.

### The default had to change (2.32.2)

Twelve paintings shipped, and the site still looked identical to a returning
visitor, because `DEFAULT_STYLE` was `minimal` — the one theme that is not
painted. Everything new lived behind a Settings tab nobody had a reason to open,
and a device with a saved `minimal` was restored to it by the first-frame mirror
on every single load.

Three things had to change together, and a test now holds them:

1. **The default is a painted room** (`rain`, the most evenly measured ground, so
   it is also the safest surface for any screen). `minimal` still exists by name
   and still sets no `data-style` attribute — it is the base sheet, not a theme.
2. **A migration, not a switch.** `styleEra` is stored in settings. Below era 2, a
   value of `minimal` cannot be told apart from "never chose", because the painted
   themes did not exist when it was written — so it is moved once, with a toast
   that names the way back. Any other choice is never touched, in any era.
3. **The mirror loses to the migration.** `applyStyle` is called at boot from the
   first-frame mirror; when that mirror holds the old default and settings have
   moved forward, the migration wins and the mirror is rewritten. Otherwise the
   app repaints itself into the past on every load.

### Security and the paperwork

The policy is no longer a sentence in a document. `serve.mjs` generates a
Content-Security-Policy at boot: a `sha256` hash per inline script (computed from
the HTML, so it cannot go stale), no `unsafe-inline`, no `eval`, and a
`connect-src` that names the app's real traffic instead of `https:`. The legal
set grew from four documents to ten, indexed at `legal.html`; the reasoning and
the out-of-scope list are in `docs/THREAT-MODEL.md`.

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

## What a returning student sees (2.29.0)

The ask screen used to be the same for a first visit and a tenth: greeting, five
starting sentences, a box. That is right for a stranger and wrong for somebody
who was in the middle of chapter four last night.

So the screen now opens with what the student already has — the last three
questions they asked, newest first, with a plain-language time under each, one
tap to ask again — and a single quiet line under it: `6 day streak · 2 questions
today`. Both are counted from this device's own log, never from the network, so
they work in a room with no Wi-Fi. And both **hide themselves** when there is
nothing to say: an empty "recent" row and a `0 questions today` are the kind of
furniture that makes an app feel assembled rather than written.

On the landing page the same idea appears as a hairline: a 1px rule at the top
of the viewport that fills as you scroll, scroll-driven CSS with no script, and
switched off entirely for a reader who has asked for reduced motion.

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
