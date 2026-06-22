# Manifesto theme — bold-headline style axis

**Date:** 2026-06-22
**Status:** approved design, pre-implementation

## Goal

Add a new carousel theme, **manifesto**, that reproduces the high-impact
"viral infographic" look from the reference screenshots: a pure-black canvas,
heavy uppercase sans type, a mint-green accent, a thin outlined eyebrow label,
and clean (not hand-drawn) emphasis marks. Generated and hand-built carousels
should be able to select it like any other theme.

The reference look is **not** just a palette — it is a different typographic
system from the app's serif/mono "field journal" lineage. So this work
introduces a **style axis** on themes rather than only new colors.

## Non-goals (v1)

- **Bar-chart comparison slide** (reference slide 3: labeled value bars with big
  numbers). This is a genuinely new element type and is **deferred** to a
  separate follow-up.
- The Instagram viewer chrome in the screenshots (page-counter pill `9/11`,
  speaker icon) is **not** part of the graphic and is ignored.
- No change to any existing theme's rendered output.

## Architecture

### 1. Style axis on `Theme` (`src/tokens.ts`)

Add one optional field:

```ts
style?: 'editorial' | 'bold'   // undefined ⇒ 'editorial'
```

- All 7 existing themes leave it unset and resolve to `'editorial'`. Their
  rendering is unchanged (regression bar: byte-identical output).
- The renderers (`Slide.tsx`, `ContentSlide.tsx`, `RichText.tsx`) read
  `theme.style` and branch. Default/fallback is always `'editorial'`.

A small helper keeps the check in one place:

```ts
export function themeStyle(t: Theme): 'editorial' | 'bold' {
  return t.style ?? 'editorial'
}
```

### 2. The `manifesto` theme (`src/tokens.ts`, appended to `THEMES`)

```ts
{
  id: 'manifesto',
  name: 'manifesto',
  style: 'bold',
  base: {
    bg: '#0A0A0A',
    fg: '#FFFFFF',
    dim: '#8A8A8A',      // gray supporting text
    accent: '#A8E6B0',   // mint — stat, underline, highlight, rules
    texture: 'none',
    mat: '#161616',      // image-plate mount
  },
  inverted: /* same palette — black stays black on the cta */,
  labels: {
    hook: () => 'the hook',
    section: () => 'the point',
    diagram: () => 'the figure',
    quote: 'the quote',
    cta: 'the takeaway',
  },
}
```

Eyebrow labels read as editorial section names ("THE TRUTH"-style) rather than
numbered observations, since per-slide overrides (below) carry the real wording.
Final label strings can be tuned during implementation.

### 3. Fonts (`src/main.tsx`, `src/tokens.ts`)

Self-hosted, no network calls (matches existing `@fontsource` setup so export
rasterization stays deterministic):

- Add deps `@fontsource/archivo` and `@fontsource/archivo-black`.
- Import the needed weights in `main.tsx` (Archivo 400/500/600; Archivo Black is
  a single 400-weight family).
- Add to `fonts` in `tokens.ts`:
  ```ts
  sans: `'Archivo', 'Helvetica Neue', Arial, sans-serif`,
  display: `'Archivo Black', 'Archivo', sans-serif`,
  ```

### 4. `'bold'` rendering rules

`Slide.tsx`:
- root `fontFamily` → `fonts.sans` (was `fonts.serif`).
- **Eyebrow label**: render the micro-label inside a thin `1.5px solid p.dim`
  box (padding ~`10px 18px`), uppercase, `fonts.sans`, letter-spaced, `p.dim`.
  (Editorial keeps today's plain letter-spaced mono label.)
- **Inner hairline frame**: suppressed (`themeStyle === 'bold'` ⇒ don't render
  the inset border).
- **Footer**: kept (per decision). Antara wordmark bottom-left + `n / total`
  bottom-right, recolored to the palette (`p.dim`); the `n/total` counter
  switches to `fonts.sans` non-italic in bold style.

`ContentSlide.tsx` — a `'bold'` preset variant per element:
| element | bold-style treatment |
|---|---|
| `text` (headline) | `fonts.display`, UPPERCASE, `p.fg` (white), line-height ~1.05, letter-spacing ~`-0.01em` |
| `stat` | `fonts.display`, `p.accent` (mint), huge (existing auto size) |
| `sub` | `fonts.sans` 600, UPPERCASE, `p.dim`, normal tracking, emphasis-aware |
| `def` | `fonts.sans` 500, UPPERCASE, `p.dim` (no italic, no left rule), emphasis-aware |
| `attribution` | `fonts.sans` 600, UPPERCASE, `p.dim` |

Uppercasing is done with `textTransform: 'uppercase'` so stored content stays
mixed-case (the generator can write normal sentences).

### 5. `RichText.tsx` — clean emphasis variant

`RichText` takes the active style (via a prop or `p`-adjacent flag). In `'bold'`
mode the same markup renders cleanly instead of hand-drawn:

| markup | editorial (now) | bold (new) |
|---|---|---|
| `*word*` | pen-circle SVG loop | **bold run**, `fontWeight: 700`, color `p.fg` (white) |
| `_word_` | wobbly SVG underline | **straight** underline, `2px solid p.accent`, slight offset |
| `==word==` | 46% accent wash | solid-ish accent highlight (`~70%` mint), dark text for contrast |

Editorial behavior is untouched. This keeps generated/legacy carousels valid —
only the ink changes with the theme.

### 6. Editable eyebrow (`src/model.ts`, inspector, `Slide.tsx`, `importDesign`)

- Add optional `eyebrow?: string` to `SlideModel`.
- `Slide.tsx`: the chrome label uses `slide.eyebrow?.trim() || microLabel`.
- Inspector: one text input ("eyebrow") on every slide; empty ⇒ shows the auto
  micro-label as placeholder so the auto behavior is discoverable.
- `importDesign`: accept a string `eyebrow` field on each slide so the
  generator can emit `"THE TRUTH"`, `"THE PARADOX"`, etc.
- `projectToText`/caption export: unaffected (eyebrow is chrome, not content).

### 7. `antara-carousel` skill (`.claude/skills/antara-carousel/SKILL.md`)

Document the new theme so generated carousels can opt in:
- `theme: "manifesto"` selectable.
- per-slide `eyebrow` field (short uppercase kicker).
- emphasis guidance for bold style: `*word*` = bold-white key term,
  `_word_` = mint underline for the punchline, `==word==` = mint highlight.
- note bar-chart comparison is not yet available.

## Data flow

No new flow. `theme.style` is read at render time only. `eyebrow` rides the
existing `SlideModel` → inspector → render → import/export paths. Nothing is
persisted differently beyond one new optional string per slide and one optional
field per theme (both backward-compatible; old saved projects load unchanged).

## Testing / verification

- **Regression**: existing themes render identically (visual check of journal +
  one image-backed theme; the `style` default must be `'editorial'`).
- **New theme**: build a carousel from the reference outline, select
  `manifesto`, confirm: black bg, Archivo Black uppercase headline, mint stat,
  boxed eyebrow, gray body with bold-white + mint-underline emphasis, no inner
  frame, footer present.
- **Eyebrow**: set a custom eyebrow → it overrides the auto label; clear it →
  auto label returns.
- **Export**: run the image exporter; fonts must be embedded (Archivo +
  Archivo Black present in the `@font-face` embed) so rasterized text doesn't
  fall back to serif.
- **Import**: a design JSON with `theme: "manifesto"` and per-slide `eyebrow`
  round-trips.

## Risks

- **Font embedding on export**: `exporter.tsx` waits on `document.fonts.ready`
  and embeds `@font-face` CSS. Archivo Black must be in the embed set or exports
  fall back. Verify during implementation.
- **Uppercase + auto-fit**: `fitSize` measures raw character count, which is
  case-insensitive, so `textTransform` doesn't change fit math. Low risk.
