---
name: antara-carousel
description: Generate a ready-to-paste Instagram carousel for Antara Freediving (Koh Tao) as a design-schema JSON for the local carousel builder. Use when the user wants to turn a topic, outline, or draft into finished slides — e.g. "make a carousel about the dive reflex", "turn this into slides", "write the sigh carousel". Output one JSON block the user pastes into the app's "import outline" box.
---

# Antara carousel generator

Turn a topic or rough draft into a finished carousel for **Antara Freediving, Koh Tao**.
Your output is a single JSON object (the "design schema"). The user pastes it into
the builder's **import outline** box (top bar) — because it starts with `{`, the app
loads it as a full carousel: theme, every slide type, inline marks, and per-element
sizes/colors. (Text not starting with `{` or `[` is treated as a loose outline instead.)

Do NOT try to run or edit the app. Just produce the JSON. The builder derives ids,
element ordering, page numbers, and chrome labels automatically. Anything it doesn't
recognize (invalid type, unknown field, out-of-range value) is silently dropped or
clamped — so when in doubt, omit a field rather than guess.

## Workflow

1. If the user gave a finished draft (e.g. "Slide 1 — …" lines), map it faithfully.
   If they gave only a topic, write the content yourself in Antara's voice.
2. Pick a theme (see below). Default to `parchment` for text-led carousels.
3. Shape the arc: **hook → 4–7 body/fact/quote slides → cta**. Aim for 6–9 slides.
4. Add emphasis marks sparingly — at most one marked phrase per slide, and **only in
   the `text` field** (marks are literal text anywhere else). The `manifesto` theme is
   the exception: marks work in `sub`/`def` too and are used more freely — see below.
5. Output exactly one ```json fenced block and a one-line note telling the user to
   paste it into **import outline**.

## Voice & style (non-negotiable)

- **Always write lowercase.** Never capitalize — not sentence starts, not "i", not
  names. The field-journal themes show exactly what you write; the `manifesto` theme
  uppercases for you in CSS, so you still type lowercase there too.
- **One idea per slide.** Short. A slide is a breath, not a paragraph.
- **Line breaks are intentional** — use `\n` to control how lines stack. This is a
  poet's tool; break lines where you'd pause.
- Second person, calm, physiological, a little wonder. Naturalist field-journal tone.
  Think: the body already knows how to do this. **Exception:** the `manifesto` theme
  wants the opposite register — bold, declarative, myth-busting (still second person,
  still lowercase). Match the tone to the theme.
- The closing slide signs off `antara freediving · koh tao`.

## The schema

```json
{
  "title": "lowercase title — shown in the app, not on slides",
  "theme": "parchment",
  "colors": { "accent": "#C2714A" },
  "slides": [ { "type": "...", ... } ]
}
```

Top-level keys: `title`, `theme` (alias `themeId`), `slides` (required, non-empty),
and optional `colors` (project-wide overrides — see Color below) and `chrome`
(toggle the auto corner labels / page numbers / wordmark — see Chrome below).
`theme` is one of:
`journal`, `openwater`, `linen`, `seachart`, `parchment`, `tide`, `noir`, `manifesto`.
(`custom` exists but needs the user to supply an image, so don't emit it.)

`manifesto` is a different beast — a bold, high-impact "viral infographic" look
(black canvas, heavy uppercase sans, mint accent, boxed eyebrow labels). Its
typography and emphasis marks differ from the field-journal themes; see its notes
under Themes and Inline emphasis below.

### Slide types and their fields

Each content field is an optional string. Omit what you don't use. `\n` = line break.

| type      | default fields (in render order)                  | use for |
|-----------|---------------------------------------------------|---------|
| `hook`    | `text` (headline), `sub` (kicker)                 | the cover. one bold line. `sub` empty → renders "keep reading →" |
| `text`    | `text`                                            | one plain thought |
| `fact`    | `stat` (big figure), `text` (body), `def` (margin note) | a number/claim + explanation |
| `quote`   | `text` (the quote), `attribution`                 | borrowed words, centered |
| `diagram` | `image` (asset name), `annotations` (one label per line), `text` (caption) | an image plate with hand annotations |
| `cta`     | `text` (the ask), `sub` (sign-off lines)          | closing slide; always inverted colors |

The seven content fields are: `text`, `sub`, `stat`, `def`, `attribution`, `image`,
`annotations`. You may add **any** of them to **any** type (e.g. a `stat` on a `text`
slide). A field you fill but that isn't in the type's defaults is appended to the
render order automatically. The builder shows whatever fields you fill.

### Inline emphasis marks — `text` field ONLY

Inside the `text` field (not `sub`, `stat`, `def`, etc.):

- `*word*` → hand-drawn **pen circle** around the word(s)
- `_word_` → hand-drawn **underline**
- `==word==` → **highlighter** sweep

All three render in the theme's accent color. Use at most one mark per slide, on the
single most important phrase. Mark 1–3 words, never whole sentences. In any other
field these characters show up literally.

**In the `manifesto` theme** the same marks render crisp instead of hand-drawn —
`*word*` → bold white run, `_word_` → straight mint underline, `==word==` → solid
mint highlight — and they work in the `sub` and `def` fields too, not only `text`.
That theme leans on emphasis far more: its body text is gray, so use `*...*` to pull
key phrases to white and `_..._` to underline the punchline (as in the reference,
2–3 marked phrases per body paragraph is normal there).

### Optional per-slide controls

All optional. Skip unless you have a specific reason — auto behavior is good.

- **`sizes`** — pin a font size in px, e.g. `"sizes": { "text": 64, "stat": 200 }`.
  Omit for auto-fit. Ranges (clamped): text 28–160, stat 80–380, sub 18–90,
  def 20–90, attribution 16–72, annotations 24–96.
- **`colors`** — per-element color, hex or a palette token, e.g.
  `"colors": { "stat": "#C2714A", "text": "accent" }`. Tokens: `paper`, `fg`,
  `dim`, `accent` (resolve to the theme's palette).
- **`background`** — pin a background plate (only for themes that have them).
  Omit to let slides auto-cycle the set for nice variety. ids: seachart →
  `chart1`..`chart5`; parchment → `parch1`..`parch6`; tide → `tide1`.
- **`elements`** — override vertical stacking order, a subset of
  `["stat","text","sub","image","annotations","def","attribution"]`. Rarely needed.
- **`eyebrow`** — a short kicker shown in the slide's corner label box, e.g.
  `"eyebrow": "the truth"`. Empty = the theme's auto label. Most useful in the
  `manifesto` theme, where the boxed eyebrow is a signature element — give each slide
  a 1–3 word section name (`the paradox`, `the choice`, `the conclusion`).

### Advanced (need an uploaded image or careful tuning — usually omit)

- **`bgImage`** — a full-slide background image by asset name. The user must upload a
  file with that exact name, or the slide shows nothing. Pair with `overlay`.
- **`overlay`** — tint/scrim over `bgImage` for legibility:
  `{ "color": "#0A0A0A", "opacity": 0.4, "mode": "wash" }`. `mode` is `wash`
  (even), `top`, or `bottom` (fade). opacity 0..1, defaults to 0.4.
- **`imageMode`** — for `diagram`/`image` slides: `inline` (boxed plate, default),
  `top`, or `bottom` (full-bleed band). With `top`/`bottom`, **`imageFrac`** (0.3–0.6,
  default 0.45) sets the band height.
- **`textBg`** — per-element legibility backing on busy images:
  `{ "text": { "style": "box", "color": "paper", "opacity": 0.85 } }`. style is
  `box`, `pill`, `highlight`, or `band`.
- **`free` / `positions`** — free-drag layout in 1080×1350 canvas coords. Don't emit;
  it's for hand-tuning in the editor.

## Themes — when to use which

- **`parchment`** — soft aged paper, faint imagery only at the edges, clear centers.
  Best default for text-led carousels; the background never competes with words.
- **`journal`** — clean cream paper with a hairline frame. Crisp, editorial, neutral.
- **`openwater`** — deep-water blue ink on pale sea-foam; cta goes dark navy. Cooler,
  more clinical. Good for technique/physiology series.
- **`linen`** — warm white with a vermilion accent. Minimal, modern, gallery-like.
- **`tide`** — a single soft watercolor wash (sand, coral, sea-foam on cream); cta
  goes deep teal. Warm and organic; keep text short so the wash breathes.
- **`noir`** — pure black canvas, cream type, gold accent. Built to pair with one
  full-bleed photo (`imageMode: "top"`/`"bottom"`). Striking, photo-led.
- **`seachart`** — busy antique nautical plates (squid, seahorse, ship). Characterful
  but strong imagery — use only when the visual texture is the point, keep text short.
- **`manifesto`** — bold, punchy, declarative: black canvas, heavy uppercase sans,
  mint accent. Headlines (`text`) read huge and white; `stat` is huge and mint; body
  (`sub`/`def`) is gray with `*bold*`/`_underline_` emphasis. Give every slide an
  `eyebrow`. Best for myth-busting, empowering, or stat-driven carousels where impact
  beats subtlety — not the calm naturalist tone the other themes carry. Write body
  copy short and punchy; let the marks and the eyebrow do the editorial work.

## Chrome (optional)

Every slide carries auto "chrome": a corner micro-label (`field notes · no. 33`,
`observation ii`, …), a `N / total` page counter, and the antara wordmark. The
top-level `chrome` object switches any of these off project-wide or overrides the
entry number:

```json
"chrome": { "labels": false, "pageNumbers": false, "wordmark": false, "entryNo": 1 }
```

- `labels` (default `true`) — the auto corner labels. `false` hides them on every
  slide. A per-slide `eyebrow` you set still shows; only the *auto* text is dropped.
- `pageNumbers` (default `true`) — the `N / total` counter.
- `wordmark` (default `true`) — the antara wordmark footer.
- `entryNo` (1–999) — replaces the title-derived "no. 33" number in the labels.
  Omit for the auto value. Ignored when `labels` is off.

Omit `chrome` entirely (the default) to keep all the chrome on — that's the
intended look for most carousels. Reach for it only when the user asks to clean a
slide up or pin the entry number.

## Color (optional)

Project-wide overrides go in the top-level `colors`: `{ "fg", "dim", "accent" }`,
each a hex string or palette token. `accent` drives rules, marks, and highlights —
the easiest single knob to re-tint a whole carousel. Per-slide `colors` (above)
override individual elements.

## Images

The only built-in image is **`seal-plate.jpg`** (a vintage seal photograph). Any other
`image` or `bgImage` name must be uploaded by the user in the app with that exact
filename, or the slide shows a "missing image" warning. So: prefer text/fact/quote
slides; use `diagram` + `seal-plate.jpg` only when fitting, or tell the user which
image to upload.

## Full example

Topic: "why you sigh when you're stressed."

```json
{
  "title": "why you sigh when you're stressed",
  "theme": "parchment",
  "slides": [
    { "type": "hook", "text": "why you *sigh*\nwhen you're stressed", "sub": "your body is fixing itself" },
    { "type": "text", "text": "when you're tense, your breathing goes ==shallow==.\nyou stop taking full breaths without noticing." },
    { "type": "text", "text": "deep in your lungs are millions of tiny air sacs.\nshallow breathing lets some of them collapse and stick shut." },
    { "type": "text", "text": "a sigh is a _double inhale_ — a second small breath stacked on the first.\nit's the only breath shaped to pop those sacs back open." },
    { "type": "fact", "stat": "every 5 min", "text": "you sigh without deciding to.\nit's maintenance — the system cleaning up after itself." },
    { "type": "text", "text": "which means you can do it on purpose.\ntwo inhales through the nose, one long exhale through the mouth. twice." },
    { "type": "quote", "text": "we spend our days learning to control the breath on purpose.\nthis is just the shallow end of it.", "attribution": "antara" },
    { "type": "cta", "text": "learn to use it.", "sub": "antara freediving · koh tao" }
  ]
}
```

## Full example — `manifesto`

Topic: "the dive reflex." Note the per-slide `eyebrow`, the white `text` headline over a
gray `def`/`sub` body, marks in `sub`/`def`, and the bolder register.

```json
{
  "title": "the dive reflex",
  "theme": "manifesto",
  "slides": [
    { "type": "hook", "eyebrow": "the reflex", "text": "your body has a setting\nfor underwater", "sub": "and it switches on by itself" },
    { "type": "text", "eyebrow": "the trigger", "text": "cold water\non your face", "sub": "is all it takes to *flip the switch*. nothing else in the body works this fast." },
    { "type": "fact", "eyebrow": "the slowdown", "stat": "-25%", "text": "your heart rate\ndrops", "def": "the moment you submerge, your pulse _falls on its own_ — *before* you've held your breath a single second." },
    { "type": "text", "eyebrow": "the shift", "text": "blood leaves\nyour limbs", "sub": "and pools around your *heart and lungs*, the organs that cannot wait." },
    { "type": "fact", "eyebrow": "the proof", "stat": "100m+", "text": "humans freedive\ndeeper than seals were thought to", "def": "the same reflex that protects a diving seal is _already in you_." },
    { "type": "text", "eyebrow": "the real story", "text": "you were never\nbad at this", "sub": "you just never met the part of you that was *built for it*." },
    { "type": "cta", "eyebrow": "the invitation", "text": "come find it.", "sub": "antara freediving · koh tao" }
  ]
}
```

After the block, tell the user: *paste this into the **import outline** box (top bar) and
hit "replace slides" — it loads the whole carousel. tweak anything in the editor, then
**save design** and **export pngs**.*
