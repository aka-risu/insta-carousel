# Per-slide backgrounds, overlays & text plates

**Date:** 2026-06-19
**Status:** approved, implementing

## Goal

Make the carousel builder's backgrounds far more flexible:

1. **Different background images per slide** — on any theme, not just one image for the whole custom template.
2. **Reuse already-uploaded photos** — pick a slide background from images already uploaded.
3. **Overlay with settings** — a tint/scrim over the background image for legibility.
4. **Text backing plates** — colored shapes behind text so it reads on busy/colorful images. Four styles.

Scope decisions (from brainstorming):
- Applies to **all themes**, not only the custom template.
- Background source: **reuse uploaded images + per-slide upload**.
- Text plates: **all four styles** (box, pill, per-line highlight, full-width band), **per element**, color from **palette tokens + custom picker**.
- Overlay: **color + opacity + gradient presets** (even wash, fade-from-top, fade-from-bottom).
- Uploaded images are **persisted as data URLs** (survive reload, reusable everywhere).

## Data model (`model.ts`)

New optional fields on `SlideModel` (backward-compatible, no migration needed):

```ts
bgImage?: string        // image name; full-slide background, overrides the theme plate on ANY theme
overlay?: SlideOverlay  // tint/scrim over the background
textBg?: Partial<Record<ElementKey, TextBacking>>  // per-element legibility plate
```

```ts
export type OverlayMode = 'wash' | 'top' | 'bottom'
export interface SlideOverlay {
  color: string     // hex
  opacity: number   // 0..1
  mode: OverlayMode // even wash · fade from top · fade from bottom
}

export type TextBgStyle = 'box' | 'pill' | 'highlight' | 'band'
export interface TextBacking {
  style: TextBgStyle
  color: string     // hex OR palette token: 'paper' | 'fg' | 'dim' | 'accent'
  opacity?: number  // 0..1, default 1
}
```

Helper `resolveColor(color, palette, opacity?)` → `rgba()` string; maps palette tokens
(`paper`→bg, `fg`, `dim`, `accent`) to the live theme color so swatches track the theme.

## Persistent image store

Today `assets` is `Record<name, objectURL>` held in React state and **not** persisted; only
`custom.bg` is a data URL in localStorage. To satisfy "persist + reuse everywhere", uploads are
stored as **data URLs** and persisted:

- New localStorage key `antara-carousel-images` → `Record<name, dataURL>`.
- `addAsset` reads the file as a data URL (FileReader) instead of `createObjectURL`.
- The in-memory `assets` map merges built-ins + this persistent store.
- Save is wrapped in try/catch; on `QuotaExceededError` show a non-blocking warning and keep the
  image in memory for the session.
- Built-in example assets stay as bundled imports (not persisted).

This makes both image elements and slide backgrounds survive reload and reusable from one picker.

## Background image (all themes) — `Slide.tsx`

Background resolves as: **`slide.bgImage` (looked up in the image map) → else existing theme-plate
logic**. So any slide on any theme can carry its own full-bleed image, falling back to the theme's
look when unset. `referencedAssets()` includes `bgImage` so export bundles it and the missing-image
warning works.

## Overlay — `Slide.tsx`

An absolutely-positioned layer between the background `<img>` and the content, drawn only when
`slide.overlay` is set:
- `wash` → solid `rgba(color, opacity)`
- `top` → `linear-gradient(to bottom, rgba(color,opacity), transparent)`
- `bottom` → `linear-gradient(to top, rgba(color,opacity), transparent)`
- `pointer-events: none`

## Text backing plates — `slides/TextPlate.tsx` (new, shared)

Wraps each rendered element in `ContentSlide` and `DiagramSlide`:
- **box** — inline-block, padded, square corners
- **pill** — same with large border-radius
- **band** — bleeds horizontally to the frame edges behind the element
- **highlight** — inner inline span on the text with `box-decoration-break: clone` so the color
  hugs each wrapped line (marker effect)

Reads `slide.textBg?.[key]`; color via `resolveColor`. When unset, renders the element unchanged.

## Editor UI — `App.tsx` (+ extracted components)

To keep `App.tsx` (~1000 lines) lean, extract two components under `src/`:
- **`SlideBackgroundPanel`** (selected-slide controls): thumbnail picker of uploaded images +
  upload button (persists via `addAsset`) + "none (use theme)"; below it overlay controls
  (color, opacity slider, wash/top/bottom segmented).
- **`TextBackingControl`** (added to each text element's existing size/color row): style select
  (none/box/pill/highlight/band) + palette swatches/custom color + opacity slider.

## Import — `model.ts`

`importDesign()` parses `bgImage` (string), `overlay`, and `textBg` (validated objects) so the
antara-carousel skill's JSON can drive them.

## Verification

No test runner in the repo. Verify with:
- `tsc -b` and `eslint` clean.
- Manual `vite dev`: assign per-slide backgrounds, reload to confirm persistence, toggle each
  overlay mode, apply each of the four text-plate styles, reorder elements (plates follow), then
  export and confirm images inline into the zip.
