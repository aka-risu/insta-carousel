# Selection-driven inspector for the carousel editor

**Date:** 2026-06-19
**Status:** Approved design, ready for planning

## Problem

The editor (right pane in `src/App.tsx`) is one long flat scroll that mixes three
different scopes with no visual separation:

- **Carousel-wide** — theme text colors / custom theme
- **This slide** — slide type, background plate, background image, overlay
- **Each element** — and every element card stacks size + color + backing +
  opacity + placement at once
- **Assets** — the image library / upload, in the same pane

Because *every* element's full control set renders simultaneously, selecting a
slide produces a wall of controls. You cannot tell what a given control affects
("all in one place — bg, text, etc."), and the controls are far from the thing
they edit.

## Goal

A **selection-driven inspector** (the Figma/Canva model): click a thing, then see
only its options. General (carousel-wide) settings live on their own, separate
from per-slide and per-element editing.

## Layout: three columns

```
┌─ filmstrip ─┬──────── canvas ────────┬──── inspector ────┐
│ 01 ▢        │                        │ [ Slide │ Carousel ]
│ 02 ▢ ←sel   │     ┌────────────┐     │                    │
│ 03 ▢        │     │   Hook      │     │  (context-aware)   │
│ 04 ▢        │     │   [body]←clk│     │                    │
│  + add      │     │   CTA       │     │                    │
└─────────────┴────────────────────────┴────────────────────┘
```

- **Left — filmstrip (navigation only).** The existing slide thumbnails, turned
  into a vertical strip. Keeps reorder / duplicate / delete and "add slide".
  Selecting a thumbnail sets the current slide. (This is today's `preview-pane`
  grid + `list-pane` actions, consolidated.)
- **Center — canvas.** The selected slide rendered large via the existing
  `Slide` component. Clicking any element selects it (`onSelectElement`);
  clicking empty canvas space deselects back to slide-level. Element highlight
  reuses the existing `selectedElement` plumbing.
- **Right — inspector.** Shows controls for the current selection only.

## Inspector: two tabs

A segmented toggle at the top of the inspector: **Slide** | **Carousel**. This is
how general settings live separately.

### Slide tab (context-aware on selection)

- **No element selected** → slide-level controls:
  slide type · background plate · slide background image · overlay.
  The large background/overlay block appears *only here*, so it no longer pushes
  text editing down while you work on an element.
- **An element is selected** → that element's controls only, under a header
  naming it with a deselect affordance (`Hook ✕`; clicking empty canvas also
  deselects).

### Carousel tab (selection-independent, applies to all slides)

- theme picker + text colors / custom theme (today's "text colors" and
  "custom theme" blocks)
- assets — image library + upload (today's "assets" block)

## Inside an element: grouped, not collapsed

One element at a time already removes the bulk of the density, so element
controls are **shown in full**, grouped under two quiet subheaders rather than
hidden behind a disclosure (the knobs a designer reaches for shouldn't cost a
click):

- **Content** — the text/value field (textarea or input or asset select), size
  slider, and for the body element the emphasis marks (circle / underline /
  highlight).
- **Style** — per-element color, and backing plate. Backing's plate-token and
  opacity rows continue to appear only when a backing style is on (today's
  conditional), which keeps the deepest nesting in check.
- For the **image** element, placement (inline / top / bottom) and height live in
  the Content group (they are layout, not style); image has no color/backing.

## Components

To keep `App.tsx` from growing further, extract the inspector into focused pieces
under `src/editor/` (new directory), each with one responsibility:

- `Inspector.tsx` — owns the Slide/Carousel tab state; routes to the panels
  below. Receives the selected slide, selected element, theme, assets, and the
  mutation callbacks already defined in `App`.
- `SlidePanel.tsx` — slide-level controls (type, background plate, background
  image, overlay). Rendered when no element is selected.
- `ElementPanel.tsx` — one element's Content + Style groups. Rendered when an
  element is selected.
- `CarouselPanel.tsx` — theme + text colors / custom theme + assets.
- `Filmstrip.tsx` — the vertical thumbnail strip with slide actions and "add
  slide".
- `Canvas.tsx` — the large current-slide render with click-to-select wiring.

`App.tsx` keeps all state and the mutation callbacks (`updateSlide`, `setSize`,
`setElementColor`, `setOverlay`, `setTextBg`, `setProjectColor`, `addElement`,
`removeElement`, `moveElement`, asset handlers, etc.) and passes them down. No
state model changes — `SlideModel`, `Project`, and the `tokens` API are untouched.

## Data flow

- Selection state stays in `App`: `selectedId` (current slide), `selectedElement`
  (current element, or `null` for slide-level). Both already exist.
- Canvas click → `onSelectElement(key)` sets `selectedElement`; clicking empty
  canvas → `setSelectedElement(null)`.
- Inspector tab state (`'slide' | 'carousel'`) is local to `Inspector`.
- Switching the selected slide clears the element selection (existing effect).

## Out of scope / unchanged

- The model (`src/model.ts`) and theming (`src/tokens.ts`) are unchanged.
- Export, import, designs library, and the save/new flows are unchanged; their
  topbar buttons and overlays stay as-is.
- Free-layout drag-to-position on the canvas keeps working (it already operates
  on the rendered `Slide`); it now operates on the large canvas instead of a
  preview-grid card.

## Incidental fix

`src/App.tsx` currently declares `const [selectedElement, setSelectedElement]`
twice (≈ lines 160 and 165) — a duplicate that does not compile. Resolve to a
single declaration as part of this work.

## Testing

This is a UI restructure of an untested SPA; verification is manual:

- Selecting a slide shows slide-level controls; the background/overlay block is
  present and editing it updates the canvas.
- Clicking an element on the canvas opens its inspector; only that element's
  controls show; editing text/size/color/backing updates the canvas live.
- Clicking empty canvas returns to slide-level controls.
- The Carousel tab changes theme, text colors, and assets across all slides.
- Filmstrip reorder / duplicate / delete / add still work and keep selection
  sane.
- Export still produces the same PNGs (rendering path is untouched).
