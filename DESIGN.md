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

## Deliberate breaks, with the reason

These are reported by `impeccable detect` and are **not** defects. Each one is a
decision that has a cost, and the cost is accepted:

| Reported as | Where | Why it stays |
| --- | --- | --- |
| `overused-font` | every page | Space Grotesk is the brand face and the only display font bundled locally (`assets/fonts/space-grotesk-latin.woff2`). Swapping it to satisfy a popularity heuristic would change the identity to no one's benefit. |
| `numbered-section-labels`, mono `01 — 03` | hero, screens, writing | The numbered index above each title is the layout authority borrowed from [zero-vast.vercel.app](https://zero-vast.vercel.app): a document with sections you can count. It is information about position, not decoration. |
| `hero-eyebrow-chip` | `blog/index.html` and every post | The `WRITING / 03 / 10` line above a post title is the series position. It is the one eyebrow that carries a number a reader can use, which is why the slogan eyebrows on `index.html`, `welcome.html` and the legal pages were deleted and this one was not. |
| `tight-leading` | `.wl-cell-title`, `.bl-card-title`, article `h2` | 1.10–1.16 is normal for display type at 19–30px. The rule's 1.3 floor is a body-text floor; applying it to the headlines would make the page look loose, not more readable. |
| `cramped-padding` | every `.wl-*` section, `gate-tabs`, `chat-shell` | The hairline grid *is* the layout: cells sit flush against the shared 1px border on purpose, with the text inset inside the cell. Padding every child would double every rule and break the stack. |
| `tiny-text` at 11–11.5px | labels, metadata, legal fine print | The detector's own floor is 11px and this is its body-text heuristic reading a label. Sizes were raised to that floor from 9–10.5px; they are not going lower and do not need to be bigger. |
| `dark-glow`, `radial-halo` | Pro Mode overlay | The PRO easter-egg intro is a piece of cinema — one screen, entered on purpose, left by pressing Escape. Its bloom is removed from anything legible (screen text, the PRO chip, status dots), and what is left is atmosphere behind display-size type. |
| `repeating-stripes-gradient` | `blog` rules, `welcome` hero grid, social stripes | Measured single-pixel rules at 96px intervals are the document grid, drawn once per section. They are not a decorative fill; the second field that used to sit on top of the first was removed in 2.23.0. |
| `codex-grid-background` | `welcome` hero | Same grid, seen through the hero. One field, greys only, on the one screen that argues the page has a structure. |

## How this was audited

In 2.23.0 the pages were scanned with [impeccable](https://github.com/pbakaus/impeccable)
`0.1.18` (Apache-2.0), the deterministic 62-rule detector — no model, no key, no
network:

```sh
# engine verified by sha256 against the publisher's manifest before first run
impeccable detect --json index.html welcome.html judge.html blog/
```

Findings fell from 70 to 27 on `index.html` and 72 to 24 on `welcome.html`. What
it caught that was genuinely wrong: an auto-scrolling language marquee that hid
half the languages and moved unbidden, a 6px pulsing dot, seven eyebrows that floated
above a headline without saying anything a reader could use, more than a hundred
declarations of 9–10.5px text, seven body greys under 4:1,
a doubling of the decorative stripe field, and glow used where a hairline
belongs. What is left is the table above.

The tool is a development aid only: it is not a dependency, nothing it produces
is served, and the site still builds and runs offline without it. Do not run
`impeccable install` here — it writes agent hooks that execute outside approval.
`detect` alone is read-only and local.
