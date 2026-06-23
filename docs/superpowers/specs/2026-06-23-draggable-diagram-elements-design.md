# Draggable diagram elements — design

**Date:** 2026-06-23
**Status:** approved for planning

## Goal

On **diagram slides**, nothing can be dragged today — the caption block and the
small annotation lines are stuck in their preset positions. Make diagram
elements draggable using the same free-layout engine that content slides already
use, and make each annotation line independently positionable while keeping its
dashed leader line.

This is scoped to diagram slides only. Chrome (eyebrow/wordmark/page number) and
the full-bleed image band are **out of scope** — an earlier draft of this spec
covered them; that scope was dropped.

## Background — the engine that already exists

Content slides already drag:

- A slide carries `free: boolean` and `positions: Partial<Record<ElementKey, {x,y}>>`
  (`model.ts`). Positions are canvas coords (1080×1350), so preview and export
  render identically.
- The first drag flips the slide to `free` and **seeds every element's position**
  by measuring its on-screen spot relative to `[data-content-root]`, divided
  back out of the live preview scale (`App.tsx` `onElementPointerDown`). The seed
  loop reads any `[data-el]` node generically.
- `Selectable` (`slides/Selectable.tsx`) renders a `free` element as
  `position:absolute` at its `pos`, with a corner resize handle (font size).
- `ContentSlide` wraps each block in `Selectable` with `free`/`pos`, inside a
  `data-content-root` that is the positioning context.

### Why diagrams are excluded today

- `Slide.tsx` `renderType` does not pass the drag handlers to `DiagramSlide`, and
  `App.tsx` `onElementPointerDown` returns early for `slide.type === 'diagram'`.
- `DiagramSlide` has **no `data-content-root`**, so even with handlers the seed
  measurement would bail.
- Annotations render as *N* separate leader-line callouts that all share
  `el="annotations"` — a single position key cannot address N boxes
  independently.

## Decisions (locked)

- **Diagram caption + image are draggable** in free mode via the existing
  single-key machinery (text / sub / def / attribution / image).
- **Each annotation line is independently draggable** and keeps its dashed leader
  line; the line re-aims toward the image plate as the annotation moves.
- **Auto (non-free) mode is unchanged** — centered plate, alternating
  leader-line annotations, caption column. The first drag seeds from this layout
  so the flip is seamless. Export of an un-dragged diagram is byte-identical.

## Component-level design

### `model.ts`

- Add a per-line annotation drag key: `DragKey = ElementKey | \`annotations#${number}\``.
  `positions` is keyed by `DragKey`; selection state and the drag handler
  signatures use `DragKey`.
- A small helper `baseKey(k: DragKey): ElementKey` strips the `#index` suffix
  (`annotations#2` → `annotations`) so styling/inspector logic keyed by
  `ElementKey` still resolves.
- `ElementKey` and all content maps (`ELEMENT_ORDER`, `ELEMENT_DEFS`,
  `AVAILABLE_ELEMENTS`, `sizes`/`widths`/`colors`, the `elements` array) are
  unchanged — annotations remain one styling element; only their *positions* are
  per-line.
- Parser: widen the `positions` key whitelist so `annotations#N` keys survive
  import (validate the base key is in `ELEMENT_ORDER` and the suffix is numeric).
- The bottom-clamp effect in `App.tsx` iterates `positions` generically and
  needs no key-specific change.

### `App.tsx`

- Remove the `slide.type === 'diagram'` early return in `onElementPointerDown`.
- Widen the drag-handler / selection types from `ElementKey` to `DragKey`. The
  seed loop and drag math are otherwise unchanged (already generic over
  `data-el`).
- Inspector wiring maps the selected `DragKey` through `baseKey` so styling
  controls target the `annotations` element regardless of which line is selected.

### `slides/Slide.tsx`

- In `renderType`, pass `onElementPointerDown` / `onResizePointerDown` through to
  `DiagramSlide` (drop the diagram-specific handler bail).

### `slides/DiagramSlide.tsx`

- Accept `onElementPointerDown` / `onResizePointerDown`; add a `data-content-root`
  wrapper (the existing `inset:0` container) so seed measurement and absolute
  positioning share one origin.
- **Auto mode (`!free`):** unchanged — current centered plate, caption column,
  and alternating annotation callouts with leader lines.
- **Free mode:** render each element through `Selectable` with `free`/`pos`,
  absolutely positioned in the content root:
  - image, text, sub, def, attribution: single-key, mirroring `ContentSlide`.
  - annotations: render one `Selectable` per line with `el="annotations#${i}"`,
    each seeded from its auto position. Each line keeps a dashed leader line whose
    far endpoint aims at the image plate's current center (derived from the
    image element's position/size), so the line follows as the annotation moves.

### `slides/Selectable.tsx`

- Widen the `el` prop type to `DragKey`. No structural change otherwise.

### `editor/Inspector.tsx` / `editor/ElementPanel.tsx`

- The active-element styling panel resolves through `baseKey`, so selecting any
  annotation line shows the single `annotations` size/width/color controls.
  Selecting an annotation line must not crash or render a broken panel.

## Out of scope

- Dragging chrome (eyebrow / wordmark / page number).
- Detaching / repositioning the full-bleed image band on non-diagram slides.
- Per-line annotation styling (size/color stays shared across lines).
- Snapping / alignment guides.

## Testing / verification

- An un-dragged diagram slide renders and exports identically to before.
- Drag the caption on a diagram → slide flips to free, caption moves, other
  elements hold their seeded positions; image stays put.
- Drag one annotation line → only that line moves; its leader line re-aims at the
  plate; the other annotation lines stay put.
- Selecting an annotation line shows the `annotations` styling controls in the
  inspector (size/width/color), not a broken/empty panel.
- "Auto" clears positions and returns the diagram to its preset centered layout
  with alternating leader-line annotations.
- Import a JSON outline whose `positions` includes `annotations#N` keys → they
  survive the parser.
