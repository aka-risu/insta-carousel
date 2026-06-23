# All elements draggable — design

**Date:** 2026-06-23
**Status:** approved for planning

## Goal

Make every visible thing on a slide draggable in the editor preview, not just
content text/image elements. Specifically, extend the existing free-layout drag
engine to cover:

1. **Chrome** — the eyebrow/micro-label, the Antara wordmark, and the page number.
2. **Diagram slides** — currently excluded from dragging entirely.
3. **The full-bleed image band** — which today is pinned to the top/bottom edge.

## Background — the engine that already exists

The builder already has a generic free-layout drag system:

- A slide carries `free: boolean` and `positions: Partial<Record<ElementKey, {x,y}>>`
  (`model.ts`). Positions are in canvas coordinates (1080×1350), so the scaled
  preview and the full-size export render identically.
- The first drag on any element flips the slide into `free` mode, **seeds every
  element's position** by measuring its current on-screen spot (divided back out
  of the live preview scale), then moves the dragged element (`App.tsx`
  `onElementPointerDown`). The seed loop measures *any* `[data-el]` node — it is
  already element-agnostic.
- `Selectable` (`slides/Selectable.tsx`) renders a `free` element as
  `position:absolute` at its `pos`, and shows a corner resize handle that scales
  font size.

So this work is **not** "build dragging." It is "make the three excluded groups
participate in the engine that already exists," plus the type-system plumbing to
let chrome keys flow through it.

### Why each group is excluded today

- **Chrome** is rendered straight into the slide frame (`Slide.tsx`), outside the
  content root, with no `data-el` and no `Selectable` wrapper.
- **Diagrams** are hard-bailed: `Slide.tsx` `renderType` skips the drag handlers
  for `slide.type === 'diagram'`, and `App.tsx` `onElementPointerDown` returns
  early for diagrams. Diagram annotations also render as *N* separate
  leader-line callouts that all share `el="annotations"`, so a single position
  key cannot address them individually.
- **Band image** is drawn full-bleed and pinned to an edge in `Slide.tsx`,
  deliberately separate from the content `image` element.

## Approach — one unified free-layer (chosen)

When a slide is in `free` mode, render **all** positionable things — content
elements, chrome, and the (now detached) image — as absolutely-positioned
children of a single full-slide positioning layer, seeded and dragged by the
existing engine.

**Auto (non-free) mode stays byte-for-byte identical to today.** The first drag
seeds from the current auto layout, so the flip to free is seamless — exactly as
it works now. Export fidelity is preserved because free positions are canvas
coords and auto mode is unchanged.

### Alternatives considered and rejected

- **Separate chrome-positioning system** — duplicates the seed/drag/clamp logic
  for no benefit.
- **Per-renderer ad-hoc drag** — three diverging copies of drag handling, with a
  real risk of editor/export pixel drift.

## Decisions (locked)

- **Diagram annotations in free mode:** collapse into a single draggable text
  block; the dashed leader lines are dropped. Auto-mode diagrams keep their
  current alternating leader-line layout untouched. Image / caption / text / sub
  / def become individually draggable in free mode.
- **Chrome is drag-only:** chrome elements can be selected and moved but have no
  resize handle (no new size ranges, no inspector size/color controls). Resize
  can be added later if wanted.
- **Band image when free:** detaches from the edge and becomes a free, draggable
  box rendered via the content `image` element. In auto mode it still bleeds to
  the edge.

## Component-level design

### `model.ts`

- Add `export type DragKey = ElementKey | 'eyebrow' | 'wordmark' | 'pageNumber'`.
- `positions` becomes `Partial<Record<DragKey, {x,y}>>`.
- Selection state and the drag handler signatures use `DragKey`.
- `ElementKey` and all content-element maps (`ELEMENT_ORDER`, `ELEMENT_DEFS`,
  `AVAILABLE_ELEMENTS`, `sizes`/`widths`/`colors`, the `elements` array) stay
  unchanged — chrome is always-present chrome, never addable content.
- Parser: widen the `positions` key whitelist so the three chrome keys survive
  import; everything else in the parser is unchanged.
- The bottom-clamp logic that keeps freed elements on-slide (`App.tsx` effect)
  already iterates `positions` generically and needs no key-specific change.

### `slides/Selectable.tsx`

- No structural change. It already renders `free` + `pos` and a conditional
  resize handle. Chrome elements simply pass no `onResizePointerDown`, so they
  get drag + select but no resize handle. Widen its `el` prop type to `DragKey`.

### `slides/Slide.tsx`

- Wrap eyebrow/label, wordmark, and page number in `Selectable` with their
  `data-el` keys, passing `free`/`pos` from the slide and the drag handler, but
  **not** the resize handler.
- When `free`, render the content root and the chrome into a single full-slide
  positioning layer (`position:absolute; inset:0`) so all `data-el` nodes share
  one coordinate origin matching the seed measurement origin. When not `free`,
  preserve today's exact frame layout (chrome pinned, content root inset by the
  band).
- When `free`, do not draw the edge-pinned band; the image element renders as a
  free box instead (see `ContentSlide`/`DiagramSlide` image handling).
- Remove the `slide.type === 'diagram'` drag-handler bail in `renderType`; pass
  the handlers through to `DiagramSlide`.

### `slides/DiagramSlide.tsx`

- Accept `onElementPointerDown` / `onResizePointerDown` and forward them to each
  `Selectable`.
- In `free` mode: render every element draggable in the shared layer; render
  annotations as one collapsed draggable text block (no alternating callouts, no
  leader lines). In auto mode: unchanged — centered plate, alternating
  leader-line annotations.
- Image: in free mode renders as a free, draggable box like other elements.

### `App.tsx`

- Remove the `slide.type === 'diagram'` early return in `onElementPointerDown`.
- Widen the drag handler / selection types from `ElementKey` to `DragKey`.
- The seed loop and drag math are otherwise unchanged (already generic).

### `editor/Inspector.tsx`

- When the active selected key is a chrome key (`eyebrow`/`wordmark`/`pageNumber`),
  show a minimal state: no size/width/color/text-backing controls (those are
  content-only). Selecting chrome must not crash or render a broken panel. The
  existing free-layout controls (auto/copy/paste/clear positions) remain.

## Out of scope

- Resizing chrome elements (font/height).
- Reordering chrome in the element list (chrome is not part of the `elements`
  array).
- Snapping/alignment guides.

## Testing / verification

- Auto-mode rendering and export are unchanged: a slide that has never been
  dragged exports identical pixels to before this change (manual visual check on
  a content slide, a diagram slide, and a banded slide).
- Drag a chrome element → slide flips to free, chrome moves, other elements hold
  their seeded positions.
- Drag on a diagram slide → annotations collapse to one block, image/caption
  draggable, leader lines gone in free mode only.
- Drag the image on a banded slide → image detaches into a free box.
- Import a JSON outline whose `positions` includes chrome keys → positions
  survive the parser.
- "Auto" button clears positions and returns every group (content + chrome +
  band) to its original auto layout.
