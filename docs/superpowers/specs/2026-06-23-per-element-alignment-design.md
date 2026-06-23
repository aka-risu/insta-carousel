# Per-element text alignment

## Goal

Let the user override the horizontal alignment of any text element on a content
slide, choosing `left`, `center`, `right`, or `spread` (justify). Today
alignment is fixed per slide type by a preset; this makes it an editable,
per-element override that mirrors the existing size / width / color controls.

## Non-goals

- Alignment controls for the `image` element (no text to align).
- Alignment on diagram slides — `DiagramSlide` has its own fixed layout, so the
  override would be a no-op there and the control is hidden.
- Any change to slide-level framing (root padding, vertical centering).

## Model (`src/model.ts`)

- New type: `export type Align = 'left' | 'center' | 'right' | 'spread'`.
- New optional field on `SlideModel`:
  `aligns?: Partial<Record<ElementKey, Align>>`. Absent key = the slide type's
  default. Mirrors `sizes` / `widths` / `colors` exactly.
- The slide-type default is the existing `PRESETS[type].align` value
  (`left` for hook/text/fact, `center` for quote/cta). Expose it so renderer and
  editor agree:

  ```ts
  // default alignment for an element, by slide type (matches the renderer preset)
  export function defaultAlign(type: SlideType, key: ElementKey): Align
  export function alignFor(slide: SlideModel, key: ElementKey): Align
  ```

  `alignFor` returns `slide.aligns?.[key] ?? defaultAlign(slide.type, key)`.
  The default lookup reuses the same source of truth as `ContentSlide`'s
  `PRESETS` — to avoid duplicating that table, move the per-type default align
  into a small map in `model.ts` (or export it) that `ContentSlide` then reads,
  keeping one source of truth.

- JSON round-trip:
  - `slideFromJSON`: read `d.aligns` like `sizes`/`widths`/`colors` — validate
    each key is in `ELEMENT_ORDER` and each value is one of the four `Align`
    strings; drop anything else.
  - `slideToJSON`: emit `aligns` when non-empty.

## Rendering (`src/slides/`)

Each `Align` maps to two CSS facts:

| align  | block self-placement (`alignSelf`) | `textAlign` |
| ------ | ---------------------------------- | ----------- |
| left   | `flex-start`                       | `left`      |
| center | `center`                           | `center`    |
| right  | `flex-end`                         | `right`     |
| spread | `stretch`                          | `justify`   |

A shared helper (e.g. in `Selectable.tsx` or `model.ts`) converts an `Align`
into `{ alignSelf, textAlign }` so the three call sites stay consistent.

- **`ContentSlide.tsx`**: per element, compute `align = alignFor(slide, key)`.
  - Pass that element's `align` to its `Selectable` wrapper and to `blockPlate`
    (instead of the single `preset.align`).
  - Set the element's own `textAlign` from `align` (currently inherited from the
    root). Apply on the element's style object.
  - The root container keeps `alignItems` / `textAlign` from the preset default
    as the fallback; per-element `alignSelf` overrides it. `padX` continues to
    key off the slide preset (slide-level framing, unchanged).
- **`Selectable.tsx`**: widen the `align` prop union from `'left' | 'center'`
  to `Align` (all four). `alignSelf` mapping: add `right → flex-end` and
  `spread → stretch`. When `stretch` is already set for `band` text backings,
  `spread` is compatible (both stretch).
- **`TextPlate.tsx`**: widen `blockPlate`'s `align` param to `Align`; add the
  `right` and `spread` cases to its `textAlign` / `alignSelf` logic.

## Editor (`src/editor/`, `src/App.tsx`)

- **`ElementPanel.tsx`**: new "align" button row, styled like the existing
  `placement` / `backing` rows (`size-row` + `size-auto` buttons):
  - `auto` — clears the override (`setAlign(id, key, undefined)`), highlighted
    when `slide.aligns?.[key] == null`.
  - `left` · `center` · `right` · `spread` — each sets that value; highlighted
    when it matches `alignFor(slide, key)`.
  - Rendered only for `key !== 'image'` and `slide.type !== 'diagram'`.
- **`App.tsx`**: new handler
  `setAlign(id, key, value: Align | undefined)` that patches
  `slide.aligns`, deleting the key when `value` is `undefined` (same shape as
  `setSize` / `setElementColor`). Thread it through `Inspector` props into
  `ElementPanel`.
- **`Inspector.tsx`**: add `setAlign` to `InspectorProps` and pass it to
  `ElementPanel`.

## Edge cases

- `spread`/justify only visibly differs on multi-line wrapped text; a single
  line renders identically to `left`. Expected, no special-casing.
- Existing saved projects have no `aligns`, so `alignFor` falls back to the
  preset default — pixel-identical to today.
- Free-layout (absolute) elements: `alignSelf` is irrelevant when positioned
  absolutely, but `textAlign` still applies, so justify/right still work inside
  the element's box.

## Testing

- Manual: on a text slide, set body to each of the four aligns; confirm
  left/center/right move the block and justify stretches a wrapped paragraph
  edge-to-edge. Confirm `auto` returns to the type default.
- JSON round-trip: export a slide with a non-default align, re-import, confirm
  the value survives; confirm an invalid align value is dropped.
- Regression: a project saved before this change renders identically.
