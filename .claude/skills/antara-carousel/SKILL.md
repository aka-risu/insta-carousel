---
name: antara-carousel
description: Generate a ready-to-paste Instagram carousel for Antara Freediving (Koh Tao) as a design-schema JSON for the local carousel builder. Use when the user wants to turn a topic, outline, or draft into finished slides — e.g. "make a carousel about the dive reflex", "turn this into slides", "write the sigh carousel". Output one JSON block the user pastes into the app's "import outline" box.
---

# Antara carousel generator

Turn a topic or rough draft into a finished carousel for **Antara Freediving, Koh Tao**.
Your output is a single JSON object (the "design schema"). The user pastes it into
the builder's **import outline** box (top bar) — it starts with `{`, so the app loads it
as a full carousel: theme, every slide type, inline marks, and per-element sizes.

Do NOT try to run or edit the app. Just produce the JSON. The builder derives ids,
element ordering, page numbers, and chrome labels automatically.

## Workflow

1. If the user gave a finished draft (e.g. "Slide 1 — …" lines), map it faithfully.
   If they gave only a topic, write the content yourself in Antara's voice.
2. Pick a theme (see below). Default to `parchment` for text-led carousels.
3. Shape the arc: **hook → 4–7 body/fact/quote slides → cta**. Aim for 6–9 slides.
4. Add emphasis marks sparingly (1 marked phrase per slide at most).
5. Output exactly one ```json fenced block and a one-line note telling the user to
   paste it into **import outline**.

## Voice & style (non-negotiable)

- **Everything lowercase.** Never capitalize — not sentence starts, not "i", not names.
  The app never auto-capitalizes; what you write is what shows.
- **One idea per slide.** Short. A slide is a breath, not a paragraph.
- **Line breaks are intentional** — use `\n` to control how lines stack. This is a
  poet's tool; break lines where you'd pause.
- Second person, calm, physiological, a little wonder. Naturalist field-journal tone.
  Think: the body already knows how to do this.
- The closing slide signs off `antara freediving · koh tao`.

## The schema

```json
{
  "title": "lowercase title — shown in the app, not on slides",
  "theme": "parchment",
  "slides": [ { "type": "...", ... } ]
}
```

`theme` is one of: `journal`, `openwater`, `linen`, `seachart`, `parchment`.

### Slide types and their fields

Every field is an optional string. Omit what you don't use. `\n` = line break.

| type      | fields (in render order)                          | use for |
|-----------|---------------------------------------------------|---------|
| `hook`    | `text` (headline), `sub` (kicker)                 | the cover. one bold line. `sub` empty → renders "keep reading →" |
| `text`    | `text`                                            | one plain thought |
| `fact`    | `stat` (big figure), `text` (body), `def` (margin note) | a number/claim + explanation |
| `quote`   | `text` (the quote), `attribution`                 | borrowed words, centered |
| `diagram` | `image` (asset name), `annotations` (one label per line), `text` (caption) | an image plate with hand annotations |
| `cta`     | `text` (the ask), `sub` (sign-off lines)          | closing slide; always inverted colors |

You may add **any** field to **any** type (e.g. a `stat` on a `text` slide, an
`attribution` anywhere). The builder shows whatever fields you fill.

### Inline emphasis marks (inside any text field)

- `*word*` → hand-drawn **pen circle** around the word(s)
- `_word_` → hand-drawn **underline**
- `==word==` → **highlighter** sweep

Use at most one mark per slide, on the single most important phrase. Don't mark
whole sentences — mark 1–3 words.

### Optional per-slide controls

- `"sizes": { "text": 64, "stat": 200 }` — pin a font size in px. Omit for auto
  (auto-fit shrinks long text to fit). Ranges: text 28–160, stat 80–380, sub 18–90,
  def 20–90, attribution 16–72, annotations 24–96. Only set a size if you have a
  reason (e.g. you want two slides to match, or a deliberately huge word).
- `"background": "parch3"` — pin a background plate (only for `seachart`/`parchment`).
  Omit to let slides auto-cycle through the set, which gives nice variety. ids:
  seachart → `chart1`..`chart5`; parchment → `parch1`..`parch6`.
- `"elements": ["text","stat"]` — override vertical stacking order. Rarely needed.

## Themes — when to use which

- **`parchment`** — soft aged paper, faint imagery only at the edges, clear centers.
  Best default for text-led carousels; the background never competes with words.
- **`journal`** — clean cream paper with a hairline frame. Crisp, editorial, neutral.
- **`openwater`** — deep-water blue ink on pale sea-foam; cta goes dark navy. Cooler,
  more clinical. Good for technique/physiology series.
- **`linen`** — warm white with a vermilion accent. Minimal, modern, gallery-like.
- **`seachart`** — busy antique nautical plates (squid, seahorse, ship). Characterful
  but the imagery is strong — use only when the visual texture is the point, and keep
  text short. For most posts prefer `parchment`.

## Images

The only built-in image is **`seal-plate.jpg`** (a vintage seal photograph). If you
use a `diagram` slide with any other `image` name, the user must upload a file with
that exact name in the app, or the slide shows a "missing image" warning. So:
prefer text/fact/quote slides; use `diagram` + `seal-plate.jpg` only when fitting, or
tell the user which image to upload.

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

After the block, tell the user: *paste this into the **import outline** box (top bar) and
hit "replace slides" — it loads the whole carousel. tweak anything in the editor, then
**save design** and **export pngs**.*
