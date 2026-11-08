# Design notes

What this interface is, in the rules it follows, and — just as important — the
places it deliberately breaks a generic rule. Written so that the next person
(or the next agent) does not "fix" a decision back into a defect.

## The law

- **Black, grey and white.** Every hex in `styles-welcome.css` and
  `styles-premium.css` is greyscale, and a test fails if a colour appears. The
  only exceptions are the bundled score-studio styles, which are an artist's
  choice inside a document, not part of the shell.
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

Those five, the size floor, the grey floor and the "nothing loops" rule are
asserted in `tests/design-rules.test.mjs`, so they survive the audit tool being
uninstalled.

## Deliberate breaks, with the reason

These are reported by `impeccable detect` **and are not defects**. Each one is a
decision that has a cost, and the cost is accepted. Every entry is machine-readable
in [`.impeccable/config.json`](./.impeccable/config.json) with the same reason, so
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

## How this was audited

The pages are scanned with [impeccable](https://github.com/pbakaus/impeccable)
(Apache-2.0), the deterministic 62-rule detector — no model, no key, and no
network after the first download:

```sh
npx impeccable@4.8.0 detect index.html welcome.html judge.html privacy.html \
  terms.html blog styles*.css
```

**2.24.0 result: 4 failures and 3 advisories, down from 89 failures and 23
advisories.** The four are the frames in the table above, left visible on purpose.
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
