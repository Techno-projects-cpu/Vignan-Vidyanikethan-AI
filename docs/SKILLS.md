# Skills this project has read

An "agent skill" is a folder of Markdown instructions that an AI coding agent
loads before it works. Four motion and illustration skills were read for this
round of design work. This page records what each one is, what was taken from
it, and — just as importantly — what was **not** run, so that nobody has to
guess later whether a third-party script executed in this repository.

**Nothing was installed.** No `npx skills add`, no plugin marketplace, no hooks,
no post-install telemetry. Every repository below was read through the public
GitHub API, and every licence was read from the repository itself. Where a skill
ships helper scripts, they were left where they were: this project is a
dependency-free static site with a service worker, and nothing in it may require
a build step to be seen.

| Skill | Licence | Size | What it is |
| --- | --- | --- | --- |
| [Bangtutorial/bang-motion](https://github.com/Bangtutorial/bang-motion) | MIT | 45 files | Rules for browser motion graphics that move like video instead of like slides |
| [Alisa0808/vox-director](https://github.com/Alisa0808/vox-director) | MIT | 52 files | A pipeline that turns one topic into a narrated paper-collage video |
| [Alchaincyf/huashu-art-motion](https://github.com/Alchaincyf/huashu-art-motion) | MIT | 518 files | Chinese art-animation skill: 36 styles, 9 explainer grammars, a shot-list method |
| [Cloveric/claude-drawing-skill](https://github.com/Cloveric/claude-drawing-skill) | MIT | 449 files | Procedural illustration in 83 styles — drawing with code, no image model |

## What was taken from each

### bang-motion — the anti-slide-deck test

The part worth quoting is its list of mechanical tests for "this is a
PowerPoint wearing a costume": three or more scenes that are switched on and off
with opacity; a transition that is always fade plus a scale bump; Ken Burns as
the only motion; one entrance pattern copied onto every element; three levels of
text per scene; a "hook → feature → feature → promise → logo" rundown.

Applied to the landing page, which had exactly the copied-entrance problem: four
elements all fading up with a delay. The hero now has one subject (the page being
made) and three different movements — ink arriving, the outline word printed
across the line, the sub-line set — plus the specimen plate **turned in
perspective** rather than faded in. There is a test for it
(`the hero moves as an object, not as four things fading up`), because a rule
that only lives in a document gets broken by the next edit.

Its other law that changed the app: *the background is never static, but motion
must come from the vocabulary of the thing you are showing*. On a page whose
whole visual language is hairlines and margin rules, that vocabulary is **lines
being drawn** — so the margin rule inks itself downward as its section arrives,
and the ink plate draws itself while you scroll to it. No stripes, no fields, no
glow: the movement is the layout.

### huashu-art-motion — the shot list

Its rail-track workflow is a storyboard method: lock one style in three lines
(style, palette, characters), then write every shot as *time | what is on screen
| what it is doing | camera | on-screen words*, keep shots to 2–6 seconds, open
on a concrete small scene rather than a title, and keep text-led shots under
30%. Its lint step refuses to let you start writing code while the board has
errors.

Applied as the discipline behind the landing page's scroll sequence: the page is
built as shots, not sections. Folio, quote, plate, list — each one has a single
thing doing a single thing, and no shot repeats the previous shot's entrance.

### claude-drawing-skill — drawing in ink, by hand

The skill's real insight is its principles table: paint far to near; few smooth
paths; hatch densely enough to saturate and let pressure decide depth; put the
texture strokes on the shadow side; let paper tooth stay subtle. That is how a
person draws with a pen, and it is a good enough specification for an SVG.

Applied to the plate in the claim section: construction lines first, then the
page outline, then the writing, then the cited sentence, then the hatching on
the shadow side of the folded corner — drawn in that order, scroll-driven, from
one inline SVG with `pathLength="1"` so a single dash rule draws every path
without measuring anything. No image file, no image model, no network: the
landing page still renders with the Wi-Fi off, and it still has a drawing on it.

Its `numpy` + `Pillow` examples were **not** run. They generate raster images on
a CPU, which would have added a binary asset and a build step to a page that has
neither.

### vox-director — read, not run, and the reason

This one produces a finished video: it needs **an Atlas Cloud API key** and a
local **ffmpeg** to render frames, then it assembles a narrated collage. Neither
is available in the environment this was built in, and neither belongs in a
school project's dependency list. Running it would also have meant uploading
content to a paid third-party service and shipping an MP4.

Its art direction was still useful and is credited: the idea that each beat is a
**finished poster** and the motion only animates an already-complete
composition. The ink plate follows it — the drawing is finished and correct even
with every animation switched off.

### The painted round (2.31.0) — the four skills, applied again

The user asked for the look of the illustrated web: painted back images, brush
strokes, the register of an anime background painting, on a book theme. The same
four skills were re-read and this is what each contributed to the four plates and
the page that carries them.

- **Cloveric/claude-drawing-skill** — the medium checklists are the reason the
  plates are painted rather than rendered. Its gouache and ink notes (a limited
  palette, dry-brush edges that thin into bare paper, no more than a few glazes,
  one light) went into the prompts: rough washi paper, visible bristle texture,
  edges that dissolve, one vermilion accent and nothing else. Its rule that white
  objects are warm off-white is why the paper is `#efe3c8` rather than `#ffffff`.
- **Bangtutorial/bang-motion** — its anti-slide-deck tests decided the motion
  budget. Ken Burns as the only motion is banned there, so the plate is never the
  only thing moving: the title is being set, the stroke is being drawn, the seal
  is stamped, the mist crosses and dust rises, and the scroll itself drives the
  sections. Its "background may only change with a visible trigger" is why the
  page changes world exactly twice, and both times on a real brush-band plate
  rather than a cross-fade.
- **Alchaincyf/huashu-art-motion** — the "轨道档" route: lock the style in three
  lines (one style, a palette of six, a character policy of none), then a shot
  table. That is why the palette is six named pigments and why there are no
  people in any of the plates. Its ban on blue-purple palettes is now the same
  law as the project's own.
- **Alisa0808/vox-director** — storyboard discipline only, as before: each plate
  is a finished poster that reads correctly with every animation switched off —
  which the reduced-motion block guarantees rather than hopes for.

The pictures themselves were generated as image models output, not traced from
any work, and no third-party asset, font or script was shipped: four WebP files,
404KB together, committed here and precached.

## The skills the site itself carries

Separately from the four above, the design work is checked by
[impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, a deterministic
rule detector, no model, no key). It is a development aid: it is not a
dependency, nothing it produces is served, and `docs/DESIGN.md` records its
findings and every deliberate deviation. Do not run `impeccable install` here.

Anthropic's `frontend-design` skill (Apache-2.0) was read in the previous round
and its direction is why the landing page is a set book; `docs/DESIGN.md` records
what it indicted.
