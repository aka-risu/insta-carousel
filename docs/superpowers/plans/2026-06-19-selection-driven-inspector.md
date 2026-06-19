# Selection-driven Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the carousel editor's flat, everything-at-once right pane into a selection-driven inspector — click a slide or an element, see only its controls — with carousel-wide settings on a separate tab, a big clickable canvas, and a slide filmstrip.

**Architecture:** `App.tsx` keeps all state and mutation callbacks (unchanged) and passes them into focused new components under `src/editor/`. The right pane becomes an `Inspector` with **Slide** / **Carousel** tabs; the Slide tab shows slide-level controls when nothing is selected and one element's controls when an element is. The all-slides preview grid becomes a left **Filmstrip** plus a center **Canvas** that renders the single selected slide large and routes element clicks. No model or theming changes.

**Tech Stack:** React 19 + TypeScript + Vite. No test runner is configured — verification is `npx tsc -b` (typecheck), `npm run lint`, and manual checks against `npm run dev`.

## Global Constraints

- TypeScript strict build must pass: `npx tsc -b` with zero errors.
- Lint must pass: `npm run lint` with zero errors.
- The app stays runnable and visually correct after **every** task — no big-bang broken intermediate states.
- Do **not** change `src/model.ts`, `src/tokens.ts`, `src/exporter.ts`, or anything under `src/slides/` except where a task explicitly says so. The exported-PNG render path must stay byte-identical.
- All-lowercase UI copy, matching the existing voice (e.g. `slide`, `carousel`, `add slide`, `background`).
- New components live in `src/editor/`. Each receives state + callbacks as props; none owns project state except local UI state (e.g. which tab is active).

---

## File Structure

- Create `src/editor/Filmstrip.tsx` — vertical slide navigator (thumbnails + per-slide actions + add-slide).
- Create `src/editor/Canvas.tsx` — the single selected slide rendered large, with click-to-select and click-empty-to-deselect.
- Create `src/editor/Inspector.tsx` — owns Slide/Carousel tab state; routes to the panels.
- Create `src/editor/SlidePanel.tsx` — slide-level controls (type, background plate, background image, overlay).
- Create `src/editor/ElementPanel.tsx` — one element's Content + Style groups.
- Create `src/editor/CarouselPanel.tsx` — theme + text colors / custom theme + assets.
- Modify `src/App.tsx` — extract the inline JSX into the above, rewire the 3-column layout, measure live canvas scale for drag/resize.
- Modify `src/App.css` — new column template and the inspector/filmstrip/canvas styles.

Each task below moves an existing block of JSX into a component **verbatim where possible**, changing only how it reads state (props instead of closure). The exact source line ranges drift as edits land, so each task says *what* block to move by its anchor markers, not just line numbers — read the current file first.

---

### Task 1: Measure canvas scale live for drag/resize

**Why first:** the big Canvas (Task 7) renders at a larger scale than the `SCALE` constant (`340/1080 ≈ 0.315`). Free-layout drag and resize currently divide pixel deltas by that constant. Measuring the scale from the rendered element makes drag correct at any size and unblocks the canvas.

**Files:**
- Modify: `src/App.tsx` — `onElementPointerDown` (anchor: `const onElementPointerDown = useCallback(`) and `onElementResizeStart` (anchor: `const onElementResizeStart = useCallback(`).

**Interfaces:**
- Produces: drag/resize math keyed off a measured `scale` (number) instead of the module `SCALE` constant. No signature change to the callbacks.

- [ ] **Step 1: Read the two handlers**

Read `src/App.tsx` from the `onElementPointerDown` anchor through the end of `onElementResizeStart`. Note every use of the `SCALE` constant inside them (seeding positions, the move handler's `dxPx / SCALE`, and the resize handler's px→size conversion).

- [ ] **Step 2: Derive scale from the canvas rect in `onElementPointerDown`**

Inside `onElementPointerDown`, after `const canvas = wrapper.closest('[data-slide-canvas]') ...` and the `if (!canvas || !root) return`, compute:

```ts
// the slide may render at any size (small filmstrip thumb or big canvas);
// derive the live scale from the rendered width instead of a fixed constant
const scale = canvas.getBoundingClientRect().width / layout.slideW
```

Replace every `SCALE` used in this handler (seed measurement `... / SCALE`, and the `onMove` deltas `dxPx / scale`, `dyPx / scale`) with this local `scale`. Capture `scale` in the `dragRef.current` object (add a `scale: number` field) so the `onMove` closure uses the value measured at pointer-down.

- [ ] **Step 3: Derive scale the same way in `onElementResizeStart`**

In `onElementResizeStart`, locate where it reads the element/canvas geometry. Compute the same `scale` from the `[data-slide-canvas]` rect (or the element's own rect ÷ its canvas-space size) and replace the `SCALE` constant uses there with it. If the handler does not currently reach the canvas element, get it via the event target's `closest('[data-slide-canvas]')`, mirroring `onElementPointerDown`.

- [ ] **Step 4: Leave the `SCALE`/`PREVIEW_W` constants in place**

They are still used by the preview grid (until Task 7). Do not delete them yet.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: zero errors.

- [ ] **Step 6: Manual verify**

Run `npm run dev`. Select a slide, drag an element on a preview thumbnail to free-position it, then drag the corner handle to resize. Both should track the cursor as before (the preview still renders at the old scale, so behavior is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Measure slide scale live for free-layout drag/resize"
```

---

### Task 2: Extract `CarouselPanel`

**Files:**
- Create: `src/editor/CarouselPanel.tsx`
- Modify: `src/App.tsx` — replace the two inline theme blocks and the assets block with `<CarouselPanel .../>`.

**Interfaces:**
- Consumes (props): everything the moved JSX reads from `App`'s closure.
- Produces: `export function CarouselPanel(props: CarouselPanelProps)` with:

```ts
export interface CarouselPanelProps {
  project: Project
  theme: Theme
  custom: CustomThemeData
  setCustom: React.Dispatch<React.SetStateAction<CustomThemeData>>
  setCustomBg: (file: File) => void
  autoColors: () => void
  setProjectColor: (key: keyof ColorOverrides, value: string | undefined) => void
  // assets
  assets: Record<string, string>
  builtinAssets: Record<string, string>
  userImages: Record<string, string>
  missing: string[]
  dragging: boolean
  setDragging: (v: boolean) => void
  storageFull: boolean
  addFiles: (files: FileList | File[], onAdded?: (names: string[]) => void) => void | Promise<void>
  removeAsset: (name: string) => void
}
```

- [ ] **Step 1: Create the component file**

Create `src/editor/CarouselPanel.tsx`. Import the types (`Project`, `Theme`, `CustomThemeData`, `ColorOverrides`) from `../model` / `../tokens` as appropriate. Define `CarouselPanelProps` exactly as above. The component body is the JSX moved in Step 2. It needs its own `useRef<HTMLInputElement>(null)` for the custom-bg picker and the assets file input (those refs were in `App`; move the two refs that are only used by this JSX — `customBgInput` and `fileInput` — into this component).

- [ ] **Step 2: Move the JSX**

From `src/App.tsx`, cut these three blocks (read the file for current bounds):
1. The `project.themeId === 'custom'` custom-theme block (anchor: `{project.themeId === 'custom' && (` … its matching close, the `custom-theme` div).
2. The `project.themeId !== 'custom'` text-colors block (anchor: `{project.themeId !== 'custom' && (`).
3. The assets block — the `assets` `pane-label`, the `storageFull` warning, the `asset-drop` dropzone, and the `asset-chips` list (anchor: `<label className="pane-label">assets</label>` through the end of the `asset-chips` block).

Paste them into `CarouselPanel`'s return, wrapped in a single `<>...</>`. Rewrite closure references to props: `project`→`props.project`, `theme`→`props.theme`, `custom`/`setCustom`/`setCustomBg`/`autoColors`→props, `setProjectColor`→props, `assets`/`userImages`/`missing`/`dragging`/`setDragging`/`storageFull`/`addFiles`/`removeAsset`→props, and `BUILTIN_ASSETS`→`props.builtinAssets`. Keep all `className`s identical.

- [ ] **Step 3: Render it in `App`**

In `App.tsx`, at the spot where the custom-theme block used to begin (top of the `editor-pane` content), render:

```tsx
<CarouselPanel
  project={project}
  theme={theme}
  custom={custom}
  setCustom={setCustom}
  setCustomBg={setCustomBg}
  autoColors={autoColors}
  setProjectColor={setProjectColor}
  assets={assets}
  builtinAssets={BUILTIN_ASSETS}
  userImages={userImages}
  missing={missing}
  dragging={dragging}
  setDragging={setDragging}
  storageFull={storageFull}
  addFiles={addFiles}
  removeAsset={removeAsset}
/>
```

Add `import { CarouselPanel } from './editor/CarouselPanel'`. Delete the now-unused `customBgInput` and `fileInput` refs from `App` (they moved into the panel). Leave the assets block's old position empty for now (it will be reordered in Task 5).

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: zero errors. (If `Theme`/`CustomThemeData`/`ColorOverrides` import paths are wrong, fix them — they live in `src/tokens.ts`.)

- [ ] **Step 5: Manual verify**

`npm run dev`: switching theme to/from custom shows the right block; editing text colors and the custom palette updates the previews; dropping/removing an image in the assets dropzone works.

- [ ] **Step 6: Commit**

```bash
git add src/editor/CarouselPanel.tsx src/App.tsx
git commit -m "Extract CarouselPanel (theme, colors, assets)"
```

---

### Task 3: Extract `SlidePanel`

**Files:**
- Create: `src/editor/SlidePanel.tsx`
- Modify: `src/App.tsx` — replace the slide-type + background-plate + slide-background + overlay blocks with `<SlidePanel .../>`.

**Interfaces:**
- Produces: `export function SlidePanel(props: SlidePanelProps)` with:

```ts
export interface SlidePanelProps {
  slide: SlideModel
  theme: Theme
  assets: Record<string, string>
  patch: (fn: (p: Project) => Project) => void
  updateSlide: (id: string, changes: Partial<SlideModel>) => void
  setOverlay: (id: string, value: SlideOverlay | undefined) => void
  addFiles: (files: FileList | File[], onAdded?: (names: string[]) => void) => void | Promise<void>
}
```

- [ ] **Step 1: Create the file**

Create `src/editor/SlidePanel.tsx`. Import `SlideModel`, `Project`, `SlideType`, `SlideOverlay`, `SLIDE_TYPE_ORDER`, `SLIDE_TYPES`, `retype` from `../model`; `Theme` from `../tokens`. Define `SlidePanelProps` as above. Move the `bgInput` ref (used only by the slide-background uploader) into this component.

- [ ] **Step 2: Move the JSX**

From `App.tsx`, cut, in order:
1. The `editing · {SLIDE_TYPES[selected.type].name}` `pane-label` and the `type-about` `<p>`.
2. The **slide type** `field` (`<select>` calling `retype`).
3. The **background plate** `field` (guarded by `theme.backgrounds`).
4. The **slide background** `field` — bg-image `<select>`, the `+ upload image` chip and its hidden input, and the **overlay** rows (off / wash / top / bottom, plus tint + opacity when `selected.overlay`).

Paste into `SlidePanel` wrapped in `<>`. Rewrite `selected`→`props.slide`, and `patch`/`updateSlide`/`setOverlay`/`addFiles`/`theme`/`assets`→props. Keep classNames identical.

- [ ] **Step 3: Render it in `App`**

Where those blocks were (inside the `selected ? (...)` branch), render `<SlidePanel slide={selected} theme={theme} assets={assets} patch={patch} updateSlide={updateSlide} setOverlay={setOverlay} addFiles={addFiles} />`. Add the import. Remove the `bgInput` ref from `App`.

- [ ] **Step 4: Typecheck, lint, verify**

`npx tsc -b && npm run lint` → zero errors. `npm run dev`: changing slide type, background plate, slide background image + upload, and overlay all still update the canvas.

- [ ] **Step 5: Commit**

```bash
git add src/editor/SlidePanel.tsx src/App.tsx
git commit -m "Extract SlidePanel (type, background, overlay)"
```

---

### Task 4: Extract `ElementPanel` and make the editor show one element at a time

This delivers the core selection-driven behavior: when an element is selected, show only its controls; otherwise show the slide panel.

**Files:**
- Create: `src/editor/ElementPanel.tsx`
- Modify: `src/App.tsx` — replace the `selected.elements.map(...)` element-cards loop with conditional rendering.

**Interfaces:**
- Produces: `export function ElementPanel(props: ElementPanelProps)`:

```ts
export interface ElementPanelProps {
  slide: SlideModel
  elementKey: ElementKey
  theme: Theme
  assets: Record<string, string>
  bodyRef: React.RefObject<HTMLTextAreaElement | null>
  updateSlide: (id: string, changes: Partial<SlideModel>) => void
  removeElement: (id: string, key: ElementKey) => void
  setSize: (id: string, key: ElementKey, value: number | undefined) => void
  setElementColor: (id: string, key: ElementKey, value: string | undefined) => void
  setTextBg: (id: string, key: ElementKey, value: TextBacking | undefined) => void
  wrapSelection: (open: string, close: string) => void
  onClose: () => void  // deselect → back to slide-level
}
```

- [ ] **Step 1: Create the file**

Create `src/editor/ElementPanel.tsx`. Import `SlideModel`, `ElementKey`, `ImageMode`, `TextBacking`, `TextBgStyle`, `elementDef`, `autoSize`, `SIZE_RANGE`, `DEFAULT_IMAGE_FRAC`, `IMAGE_FRAC_RANGE` from `../model`; `Theme` from `../tokens`. Define `ElementPanelProps` as above. Keep the local helper `const hasSizeControl = (k: ElementKey) => k !== 'image'` (move it here from `App`).

- [ ] **Step 2: Move the per-element JSX for ONE element**

From `App.tsx`, the body of the `selected.elements.map((key, idx) => { ... })` callback renders one element card (label + drag handle + remove ×, the field input/textarea/select, the hint, the marks row for `text`, the size row, the color row, the backing rows, and the image placement rows). Move that single-element JSX into `ElementPanel`, using `props.elementKey` for `key` and `props.slide` for `selected`. **Drop** the drag-handle / `draggable` / `onDragOver` / `onDrop` reorder wiring and the `idx`/`dragEl`/`dragOverIdx` references — element reordering moves to the filmstrip/canvas later and is out of scope here; the panel shows exactly one element.

Group the controls under two subheaders (new, lowercase, using the existing `field-label`/`pane-label` styling — reuse `className="size-label"` row labels):

```tsx
<div className="field selected-el">
  <span className="field-label">
    {def.label}
    <button className="field-remove" title={`remove ${def.label}`} onClick={props.onClose === undefined ? undefined : () => props.removeElement(slide.id, key)}>×</button>
  </span>

  {/* ── content ── */}
  <span className="group-label">content</span>
  {/* field input/textarea/select + hint + (text-only) marks row + size row */}

  {/* ── style ── (omit entirely for image; image shows placement under content) */}
  <span className="group-label">style</span>
  {/* color row + backing rows */}
</div>
```

For the **image** element: put the placement + height rows under **content** and render no **style** group (image has no color/backing — matches the current `key !== 'image'` guards). Keep all existing conditional logic (`hasSizeControl`, `key === 'text'` marks, backing sub-rows only when `tb` set) intact.

- [ ] **Step 3: Conditional render in `App`**

Replace the whole `<span className="field-hint drag-hint">…</span>` + `selected.elements.map(...)` + `add element` region inside the `selected ? (...)` branch with:

```tsx
{activeElement ? (
  <ElementPanel
    slide={selected}
    elementKey={activeElement}
    theme={theme}
    assets={assets}
    bodyRef={bodyRef}
    updateSlide={updateSlide}
    removeElement={removeElement}
    setSize={setSize}
    setElementColor={setElementColor}
    setTextBg={setTextBg}
    wrapSelection={wrapSelection}
    onClose={() => setSelectedElement(null)}
  />
) : (
  <>
    <SlidePanel … />
    {/* add element chips stay here, at slide level */}
    {AVAILABLE_ELEMENTS[selected.type].filter((k) => !selected.elements.includes(k)).length > 0 && (
      /* the existing add-element field block */
    )}
  </>
)}
```

Move the `<SlidePanel/>` render (from Task 3) into the `else` branch so slide-level controls show only when no element is selected. The `add element` chips also belong in the `else` branch. Add `import { ElementPanel } from './editor/ElementPanel'`.

- [ ] **Step 4: Remove now-dead reorder state if unused**

If `dragEl` / `dragOverIdx` / `moveElement` are no longer referenced anywhere after this task, leave them for now (the filmstrip may reuse `moveSlide`, not these). Only remove `dragEl`/`dragOverIdx` if grep shows zero remaining uses. Run `grep -n "dragEl\|dragOverIdx" src/App.tsx` and delete the `useState` lines only if there are no other hits.

- [ ] **Step 5: Typecheck, lint, verify**

`npx tsc -b && npm run lint` → zero errors. `npm run dev`: click an element on a preview → the editor shows only that element's content + style groups; the × removes it and returns to slide view; click empty/another slide → slide-level controls + add-element chips return; editing text/size/color/backing updates live.

- [ ] **Step 6: Commit**

```bash
git add src/editor/ElementPanel.tsx src/App.tsx
git commit -m "Show one element's controls at a time (ElementPanel)"
```

---

### Task 5: Wrap the editor in an `Inspector` with Slide / Carousel tabs

**Files:**
- Create: `src/editor/Inspector.tsx`
- Modify: `src/App.tsx` — replace the editor-pane inner content with `<Inspector .../>`.
- Modify: `src/App.css` — add `.inspector-tabs` / `.group-label` styles.

**Interfaces:**
- Produces: `export function Inspector(props: InspectorProps)` that owns `const [tab, setTab] = useState<'slide' | 'carousel'>('slide')`, renders a segmented control, and shows `CarouselPanel` under `carousel`, else (`slide`) shows `ElementPanel` when `activeElement` else `SlidePanel` + add-element chips.

```ts
export interface InspectorProps {
  selected: SlideModel | null
  activeElement: ElementKey | null
  // all props CarouselPanel, SlidePanel, ElementPanel need, threaded through
  // (project, theme, custom + setters, assets bundle, the slide/element callbacks,
  //  bodyRef, AVAILABLE_ELEMENTS add-element handler addElement, elementDef)
}
```

- [ ] **Step 1: Create `Inspector.tsx`**

Move the tab-routing logic here. Render:

```tsx
<div className="inspector">
  <div className="inspector-tabs">
    <button className={tab === 'slide' ? 'on' : ''} onClick={() => setTab('slide')}>slide</button>
    <button className={tab === 'carousel' ? 'on' : ''} onClick={() => setTab('carousel')}>carousel</button>
  </div>
  {tab === 'carousel' ? (
    <CarouselPanel {...} />
  ) : selected ? (
    activeElement ? <ElementPanel {...} /> : (
      <>
        <SlidePanel {...} />
        {/* add-element chips */}
      </>
    )
  ) : (
    <p className="empty-note">add a slide to start</p>
  )}
</div>
```

Thread every prop the three panels need through `InspectorProps` (spell them out explicitly — do not use `any`). Import the three panels.

- [ ] **Step 2: Render `<Inspector/>` in `App`**

Replace the entire `editor-pane` inner JSX (everything between `<section className="editor-pane">` and its `</section>`) with `<section className="editor-pane"><Inspector …all props… /></section>`. Remove the now-duplicated panel renders from `App` (they live in `Inspector` now). Keep `CarouselPanel`/`SlidePanel`/`ElementPanel` imports only if still referenced in `App`; otherwise move the imports to `Inspector` and import only `Inspector` in `App`.

- [ ] **Step 3: Add CSS**

In `src/App.css`, add:

```css
.inspector-tabs { display: flex; gap: 4px; margin: 16px 0 4px; }
.inspector-tabs button {
  flex: 1; font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em;
  padding: 8px; border: 1px solid var(--rule); background: transparent;
  color: var(--faded); cursor: pointer; border-radius: 6px; text-transform: lowercase;
}
.inspector-tabs button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.group-label {
  display: block; font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em;
  color: var(--faded); margin: 16px 0 6px;
}
```

(If `--ink` / `--paper` / `--rule` / `--faded` aren't the actual variable names, read the `:root` block at the top of `App.css` and use the real ones.)

- [ ] **Step 4: Typecheck, lint, verify**

`npx tsc -b && npm run lint` → zero. `npm run dev`: a **slide** / **carousel** toggle appears at the top of the right pane. Carousel tab shows theme + colors + assets and applies across all slides. Slide tab shows slide controls, and an element's controls when one is selected.

- [ ] **Step 5: Commit**

```bash
git add src/editor/Inspector.tsx src/App.tsx src/App.css
git commit -m "Add Slide/Carousel inspector tabs"
```

---

### Task 6: Convert the left pane into a `Filmstrip`

**Files:**
- Create: `src/editor/Filmstrip.tsx`
- Modify: `src/App.tsx` — replace `list-pane` contents with `<Filmstrip .../>`.
- Modify: `src/App.css` — filmstrip thumbnail styles.

**Interfaces:**
- Produces: `export function Filmstrip(props: FilmstripProps)`:

```ts
export interface FilmstripProps {
  slides: SlideModel[]
  selectedId: string | null
  labels: string[]
  theme: Theme
  assets: Record<string, string>
  onSelect: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onAdd: (type: SlideType) => void
}
```

- [ ] **Step 1: Create `Filmstrip.tsx`**

Render a vertical list. Each row is a small `Slide` thumbnail (reuse the existing scaled-`Slide` pattern from the preview grid — a `PREVIEW_W`-wide frame with `transform: scale(SCALE)`, **read-only**: pass `selectedElement={null}` and no click/drag handlers, so the thumbnail is just a picture) plus the slide number, type caption, and the per-slide action buttons (↑ ↓ ⧉ ×) that call `onMove`/`onDuplicate`/`onRemove`. Clicking the thumbnail calls `onSelect(id)`. Below the list, the `add slide` chips calling `onAdd(type)` for each `SLIDE_TYPE_ORDER`. Define a module-local `const PREVIEW_W = 150` (smaller than the old 340; this is a strip) and `const SCALE = PREVIEW_W / layout.slideW`; import `layout` from `../tokens`.

- [ ] **Step 2: Render in `App`**

Replace the `list-pane` inner JSX (the `slides` label + `slide-list` + `add slide` row) with `<Filmstrip slides={project.slides} selectedId={selectedId} labels={labels} theme={theme} assets={assets} onSelect={(id) => { setSelectedId(id); setSelectedElement(null) }} onMove={moveSlide} onDuplicate={duplicateSlide} onRemove={removeSlide} onAdd={addSlide} />`. Add the import.

- [ ] **Step 3: CSS**

Add filmstrip thumbnail styles (rounded frame, `selected` ring reusing the existing selected treatment, action buttons revealed on row hover). Reuse `.preview-frame` sizing semantics. Keep it scrollable: `.list-pane { overflow-y: auto; }` if not already.

- [ ] **Step 4: Typecheck, lint, verify**

`npx tsc -b && npm run lint` → zero. `npm run dev`: left column shows stacked thumbnails; clicking one selects it; ↑↓⧉× and add-slide work; the selected thumbnail is ringed.

- [ ] **Step 5: Commit**

```bash
git add src/editor/Filmstrip.tsx src/App.tsx src/App.css
git commit -m "Turn the left pane into a slide filmstrip"
```

---

### Task 7: Replace the preview grid with a single big `Canvas`

**Files:**
- Create: `src/editor/Canvas.tsx`
- Modify: `src/App.tsx` — replace `preview-pane` grid with `<Canvas .../>`; update the column grid.
- Modify: `src/App.css` — `.workspace` columns + `.canvas-*` styles; the old `.preview-*` rules can stay unused or be removed.

**Interfaces:**
- Produces: `export function Canvas(props: CanvasProps)`:

```ts
export interface CanvasProps {
  slide: SlideModel | null
  index: number
  total: number
  microLabel: string
  theme: Theme
  assets: Record<string, string>
  selectedElement: ElementKey | null
  onSelectElement: (key: ElementKey) => void
  onDeselect: () => void
  onElementPointerDown: (e: React.PointerEvent, key: ElementKey) => void
  onResizePointerDown: (e: React.PointerEvent, key: ElementKey) => void
}
```

- [ ] **Step 1: Create `Canvas.tsx`**

Render the single selected slide large and centered. Compute scale to fit the column responsively: wrap the scaled `Slide` in a frame. Use a fixed comfortable canvas width — read the available width is overkill; render at a larger fixed `CANVAS_W` (e.g. `520`) with `SCALE = CANVAS_W / layout.slideW`, centered with `margin: auto`. The outer wrapper has `onClick={props.onDeselect}` (clicking the matting deselects); the scaled `Slide` element clicks call `onSelectElement` and `stopPropagation` already happens inside `Selectable` (verified: `Selectable`'s onClick calls `e.stopPropagation()`), so element clicks won't bubble to the deselect handler. Pass `onElementPointerDown` / `onResizePointerDown` straight through. The scaled wrapper **must** keep the `data-slide-canvas` attribute (Task 1's scale measurement and the drag seed depend on it).

```tsx
export function Canvas(props: CanvasProps) {
  const CANVAS_W = 520
  const SCALE = CANVAS_W / layout.slideW
  if (!props.slide) return <p className="empty-note">no slide selected</p>
  return (
    <div className="canvas-mat" onClick={props.onDeselect}>
      <div className="canvas-frame" style={{ width: CANVAS_W, height: Math.round(layout.slideH * SCALE) }}>
        <div data-slide-canvas style={{ width: layout.slideW, height: layout.slideH, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
          <Slide
            slide={props.slide}
            microLabel={props.microLabel}
            index={props.index}
            total={props.total}
            theme={props.theme}
            assets={props.assets}
            selectedElement={props.selectedElement}
            onSelectElement={props.onSelectElement}
            onElementPointerDown={props.onElementPointerDown}
            onResizePointerDown={props.onResizePointerDown}
          />
        </div>
      </div>
    </div>
  )
}
```

Import `Slide` from `../slides/Slide` and `layout` from `../tokens`.

- [ ] **Step 2: Render in `App`**

Replace the `preview-pane` grid block with:

```tsx
<section className="preview-pane">
  <Canvas
    slide={selected}
    index={selected ? project.slides.findIndex((s) => s.id === selected.id) : 0}
    total={project.slides.length}
    microLabel={selected ? labels[project.slides.findIndex((s) => s.id === selected.id)] : ''}
    theme={theme}
    assets={assets}
    selectedElement={activeElement}
    onSelectElement={(key) => setSelectedElement(key)}
    onDeselect={() => setSelectedElement(null)}
    onElementPointerDown={onElementPointerDown}
    onResizePointerDown={onElementResizeStart}
  />
</section>
```

Add the import.

- [ ] **Step 3: Update the column template**

In `src/App.css`, change `.workspace { grid-template-columns: 300px 400px 1fr; }` to `grid-template-columns: 200px 1fr 380px;` (filmstrip | canvas | inspector). Add:

```css
.canvas-mat { height: 100%; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 24px; }
.canvas-frame { overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.18); border-radius: 6px; }
```

Note the column ORDER in the JSX is currently list-pane, editor-pane, preview-pane → that maps to filmstrip(200) | inspector(400→ now editor) | canvas(1fr). **The grid order must end up filmstrip | canvas | inspector.** Reorder the three `<section>`s in `App`'s `<main>` so the DOM order is `list-pane` (filmstrip), then `preview-pane` (canvas), then `editor-pane` (inspector), and set columns `200px 1fr 380px`.

- [ ] **Step 4: Remove the now-dead `PREVIEW_W`/`SCALE` module constants in `App.tsx`**

After Tasks 6–7, `App.tsx` no longer renders scaled previews itself (Filmstrip and Canvas own their own scale constants). Run `grep -n "PREVIEW_W\|SCALE" src/App.tsx`; if the only hits are the two `const` definitions, delete them. If anything else references them, leave them.

- [ ] **Step 5: Typecheck, lint, verify**

`npx tsc -b && npm run lint` → zero. `npm run dev`: layout is filmstrip (left) · big canvas (center) · inspector (right). Clicking an element on the big canvas selects it and opens its panel; clicking the matting deselects. Free-layout **drag and resize on the big canvas track the cursor correctly** (this is the Task 1 payoff — verify a drag lands where you drop it, not offset). Reordering via filmstrip and the inspector tabs all still work.

- [ ] **Step 6: Full regression + export check**

Export PNGs (`export pngs` button) and confirm slides render identically to before this whole effort (open one PNG). Import an outline and a design JSON to confirm those flows are untouched.

- [ ] **Step 7: Commit**

```bash
git add src/editor/Canvas.tsx src/App.tsx src/App.css
git commit -m "Replace preview grid with a single large canvas (filmstrip | canvas | inspector)"
```

---

## Self-Review

**Spec coverage:**
- 3-column layout (filmstrip | canvas | inspector) → Tasks 6, 7. ✓
- Click big canvas to select element; empty click to deselect → Task 7 (uses `Selectable`'s existing `stopPropagation`). ✓
- Inspector Slide/Carousel tabs → Task 5. ✓
- Slide tab contextual (slide vs element) → Task 4. ✓
- Carousel tab = theme + colors + assets, applies to all → Task 2 + Task 5. ✓
- Element grouped Content/Style, not collapsed; image placement under Content → Task 4. ✓
- Components under `src/editor/`, state stays in `App` → all tasks. ✓
- Model/tokens/export untouched → Global Constraints + Task 7 Step 6 regression. ✓
- Free-layout drag keeps working on the new canvas → Task 1 (dynamic scale) + Task 7. ✓
- Incidental duplicate-declaration fix → **removed**: verified the real file declares `selectedElement` once (line 164); no such bug exists.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Component bodies are described as verbatim moves of named, anchored existing blocks with the exact prop rewrites listed; new/tricky code (scale measurement, tab routing, canvas, CSS) is given in full.

**Type consistency:** Prop interface names (`updateSlide`, `setOverlay`, `setTextBg`, `setElementColor`, `setProjectColor`, `addFiles`, `removeAsset`, `moveSlide`, `duplicateSlide`, `removeSlide`, `addSlide`, `addElement`, `onElementPointerDown`, `onElementResizeStart`) match the callbacks defined in `App.tsx`. `Canvas` consumes `onResizePointerDown` and `App` passes `onElementResizeStart` into it — the prop name on `Canvas`/`Slide` is `onResizePointerDown` (matches `ElementSelection`), the App-side handler is `onElementResizeStart`; wiring is explicit in Task 7 Step 2.
