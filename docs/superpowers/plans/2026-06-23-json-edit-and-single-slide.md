# JSON Edit & Single-Slide Insert/Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user hand-edit the whole project as JSON, and insert or replace a single slide from JSON, reusing one shared validation function.

**Architecture:** Extract the per-slide JSON→model mapping currently inlined in `importDesign` into a reusable `slideFromJSON`, add `slideToJSON`/`projectToJSON` serializers that emit compact JSON, then wire two new App mutations (`replaceSlide`, `insertSlideAfter`) and a single-slide JSON overlay reachable from the filmstrip and a "+ paste page" affordance. The project-level import overlay gains a "load current as JSON" button for round-trip editing.

**Tech Stack:** TypeScript, React 19, Vite. No test runner — verification is `npm run build` (runs `tsc -b`) plus the manual checks listed per task.

## Global Constraints

- No new dependencies.
- `slideFromJSON` is the single validation choke point: `importDesign` and single-slide insert must both go through it.
- `id` is omitted from all JSON output and regenerated on import (via `newSlide`/`slideFromJSON`), so hand-edited JSON never collides.
- Invalid input surfaces via `alert(...)` and leaves state unchanged (matches existing `runImport`).
- Match existing code style: lowercase UI copy, ghost-btn / export-btn classes, existing overlay markup.

---

### Task 1: Extract `slideFromJSON` and refactor `importDesign`

**Files:**
- Modify: `src/model.ts` (the per-slide block inside `importDesign`, ~lines 423–504)

**Interfaces:**
- Produces: `export function slideFromJSON(d: Record<string, unknown>): SlideModel` — maps one raw object to a valid `SlideModel` with a fresh id. Unknown `type` → `'text'`; unknown element keys and malformed nested objects are filtered out.
- `importDesign` is unchanged in observable behavior.

- [ ] **Step 1: Add `slideFromJSON` by lifting the existing per-slide mapping**

Move the body of `arr.map((d: Record<string, unknown>) => { ... })` (lines ~423–503 in `importDesign`) verbatim into a new exported function. Place it just above `importDesign`:

```ts
/** Map one raw JSON object to a valid SlideModel (fresh id). The single
 *  validation choke point shared by whole-project import and single-slide insert. */
export function slideFromJSON(d: Record<string, unknown>): SlideModel {
  const t = String(d.type ?? 'text') as SlideType
  const s = newSlide(SLIDE_TYPE_ORDER.includes(t) ? t : 'text')
  for (const k of CONTENT_KEYS) if (typeof d[k] === 'string') s[k] = d[k] as string
  if (typeof d.eyebrow === 'string') s.eyebrow = d.eyebrow

  if (Array.isArray(d.elements)) {
    s.elements = (d.elements as string[]).filter((k): k is ElementKey =>
      ELEMENT_ORDER.includes(k as ElementKey),
    )
  } else {
    for (const k of ELEMENT_ORDER) if (s[k] && !s.elements.includes(k)) s.elements.push(k)
  }

  if (d.sizes && typeof d.sizes === 'object') {
    s.sizes = {}
    for (const [k, v] of Object.entries(d.sizes as Record<string, unknown>))
      if (ELEMENT_ORDER.includes(k as ElementKey) && typeof v === 'number')
        s.sizes[k as ElementKey] = v
  }
  if (d.widths && typeof d.widths === 'object') {
    s.widths = {}
    for (const [k, v] of Object.entries(d.widths as Record<string, unknown>))
      if (ELEMENT_ORDER.includes(k as ElementKey) && typeof v === 'number')
        s.widths[k as ElementKey] = v
  }
  if (d.colors && typeof d.colors === 'object') {
    s.colors = {}
    for (const [k, v] of Object.entries(d.colors as Record<string, unknown>))
      if (ELEMENT_ORDER.includes(k as ElementKey) && typeof v === 'string')
        s.colors[k as ElementKey] = v
  }
  if (d.imageMode === 'top' || d.imageMode === 'bottom' || d.imageMode === 'inline')
    s.imageMode = d.imageMode
  if (typeof d.imageFrac === 'number') s.imageFrac = d.imageFrac
  if (typeof d.background === 'string') s.background = d.background
  if (typeof d.bgImage === 'string') s.bgImage = d.bgImage

  const ov = d.overlay as Record<string, unknown> | undefined
  if (ov && typeof ov === 'object' && typeof ov.color === 'string') {
    const mode = ov.mode === 'top' || ov.mode === 'bottom' ? ov.mode : 'wash'
    s.overlay = {
      color: ov.color,
      opacity: typeof ov.opacity === 'number' ? ov.opacity : 0.4,
      mode,
    }
  }

  if (d.textBg && typeof d.textBg === 'object') {
    const out: Partial<Record<ElementKey, TextBacking>> = {}
    for (const [k, v] of Object.entries(d.textBg as Record<string, unknown>)) {
      if (!ELEMENT_ORDER.includes(k as ElementKey)) continue
      const tb = v as Record<string, unknown>
      if (!tb || typeof tb !== 'object' || typeof tb.color !== 'string') continue
      const style = (['box', 'pill', 'highlight', 'band'] as const).includes(
        tb.style as TextBgStyle,
      )
        ? (tb.style as TextBgStyle)
        : 'box'
      out[k as ElementKey] = {
        style,
        color: tb.color,
        ...(typeof tb.opacity === 'number' ? { opacity: tb.opacity } : {}),
      }
    }
    if (Object.keys(out).length) s.textBg = out
  }

  if (d.free === true) s.free = true
  if (d.positions && typeof d.positions === 'object') {
    const out: Partial<Record<ElementKey, { x: number; y: number }>> = {}
    for (const [k, v] of Object.entries(d.positions as Record<string, unknown>)) {
      if (!ELEMENT_ORDER.includes(k as ElementKey)) continue
      const pos = v as Record<string, unknown>
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number')
        out[k as ElementKey] = { x: pos.x, y: pos.y }
    }
    if (Object.keys(out).length) s.positions = out
  }
  return s
}
```

- [ ] **Step 2: Replace the inlined `.map` body in `importDesign` with a call**

```ts
const slides = arr.map((d) => slideFromJSON(d as Record<string, unknown>))
```

Leave the rest of `importDesign` (colors, ratio, chrome, return) untouched.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Manual regression — full import still works**

Run `npm run dev`, open the import overlay, paste a known design JSON (e.g. from the antara-carousel skill output), apply. Expected: project loads exactly as before this change.

- [ ] **Step 5: Commit**

```bash
git add src/model.ts
git commit -m "Extract slideFromJSON from importDesign"
```

---

### Task 2: Add `slideToJSON` and `projectToJSON` serializers

**Files:**
- Modify: `src/model.ts` (add near `projectToText`, ~line 633)

**Interfaces:**
- Consumes: `SlideModel`, `Project` types; `CONTENT_KEYS`.
- Produces:
  - `export function slideToJSON(s: SlideModel): Record<string, unknown>`
  - `export function projectToJSON(p: Project): Record<string, unknown>`
- Both omit empty/undefined fields and never emit `id`. `projectToJSON` uses key `theme` (not `themeId`), matching `importDesign`'s read of `data.theme ?? data.themeId`.

- [ ] **Step 1: Add the serializers**

```ts
/** Serialize one slide to compact JSON for hand-editing. Omits empty content,
 *  absent optionals, and `id` (regenerated on import). */
export function slideToJSON(s: SlideModel): Record<string, unknown> {
  const out: Record<string, unknown> = { type: s.type, elements: s.elements }
  for (const k of CONTENT_KEYS) if (s[k]) out[k] = s[k]
  if (s.eyebrow) out.eyebrow = s.eyebrow
  if (s.sizes && Object.keys(s.sizes).length) out.sizes = s.sizes
  if (s.widths && Object.keys(s.widths).length) out.widths = s.widths
  if (s.colors && Object.keys(s.colors).length) out.colors = s.colors
  if (s.imageMode) out.imageMode = s.imageMode
  if (typeof s.imageFrac === 'number') out.imageFrac = s.imageFrac
  if (s.background) out.background = s.background
  if (s.bgImage) out.bgImage = s.bgImage
  if (s.overlay) out.overlay = s.overlay
  if (s.textBg && Object.keys(s.textBg).length) out.textBg = s.textBg
  if (s.free) out.free = true
  if (s.positions && Object.keys(s.positions).length) out.positions = s.positions
  return out
}

/** Serialize the whole project to compact JSON for hand-editing. */
export function projectToJSON(p: Project): Record<string, unknown> {
  const out: Record<string, unknown> = { title: p.title, theme: p.themeId }
  if (p.ratio) out.ratio = p.ratio
  if (p.colors && Object.keys(p.colors).length) out.colors = p.colors
  if (p.chrome && Object.keys(p.chrome).length) out.chrome = p.chrome
  out.slides = p.slides.map(slideToJSON)
  return out
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/model.ts
git commit -m "Add slideToJSON and projectToJSON serializers"
```

---

### Task 3: App mutations + single-slide JSON overlay

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `slideFromJSON`, `slideToJSON`, `projectToJSON` from `./model`.
- Produces:
  - `replaceSlide(id: string, model: SlideModel): void` — swaps the slide at `id` for `model` (keeping `model`'s fresh id); selects it, clears `selectedElement`.
  - `insertSlideAfter(id: string | null, model: SlideModel): void` — splices `model` after `id` (append if `id` null or not found); selects it.
  - `openSlideJson(id: string)` opens the overlay pre-filled; `slideJson` state drives it.

- [ ] **Step 1: Add imports**

In the `from './model'` import block, add `slideFromJSON`, `slideToJSON`, `projectToJSON`.

- [ ] **Step 2: Add overlay state**

Near the other `useState` calls (after `importText`):

```tsx
// single-slide JSON editor. id null = insert a brand-new page; id set = opened
// from that slide (pre-filled, can replace in place or insert after).
const [slideJson, setSlideJson] = useState<{ id: string | null; text: string } | null>(null)
```

- [ ] **Step 3: Add the mutations**

Place after `duplicateSlide` / `moveSlide`:

```tsx
const replaceSlide = useCallback(
  (id: string, model: SlideModel) =>
    patch((p) => ({
      ...p,
      slides: p.slides.map((s) => (s.id === id ? model : s)),
    })),
  [patch],
)

const insertSlideAfter = useCallback(
  (id: string | null, model: SlideModel) =>
    patch((p) => {
      const idx = id ? p.slides.findIndex((s) => s.id === id) : -1
      const slides = [...p.slides]
      slides.splice(idx < 0 ? slides.length : idx + 1, 0, model)
      return { ...p, slides }
    }),
  [patch],
)
```

- [ ] **Step 4: Add the apply handlers**

Place near `runImport`:

```tsx
// open the single-slide editor pre-filled from a slide
const openSlideJson = useCallback((id: string) => {
  const s = project.slides.find((x) => x.id === id)
  setSlideJson({ id, text: s ? JSON.stringify(slideToJSON(s), null, 2) : '' })
}, [project.slides])

// parse the textarea into one SlideModel; tolerate a pasted project or array
const parseSlideJson = (text: string): SlideModel => {
  const data = JSON.parse(text)
  const obj = Array.isArray(data) ? data[0] : (data?.slides?.[0] ?? data)
  if (!obj || typeof obj !== 'object') throw new Error('expected a slide object')
  return slideFromJSON(obj as Record<string, unknown>)
}

const applySlideReplace = useCallback(() => {
  if (!slideJson?.id) return
  try {
    const model = parseSlideJson(slideJson.text)
    replaceSlide(slideJson.id, model)
    setSelectedId(model.id)
    setSelectedElement(null)
    setSlideJson(null)
  } catch (err) {
    alert('could not read slide json: ' + (err instanceof Error ? err.message : String(err)))
  }
}, [slideJson, replaceSlide])

const applySlideInsert = useCallback(() => {
  if (!slideJson) return
  try {
    const model = parseSlideJson(slideJson.text)
    insertSlideAfter(slideJson.id ?? selectedId, model)
    setSelectedId(model.id)
    setSelectedElement(null)
    setSlideJson(null)
  } catch (err) {
    alert('could not read slide json: ' + (err instanceof Error ? err.message : String(err)))
  }
}, [slideJson, selectedId, insertSlideAfter])
```

- [ ] **Step 5: Render the overlay**

After the `importing && (...)` overlay block, add:

```tsx
{slideJson && (
  <div className="overlay" onClick={() => setSlideJson(null)}>
    <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
      <label className="pane-label">
        {slideJson.id ? 'edit slide json' : 'paste a slide'}
      </label>
      <p className="type-about">
        one slide object — type, elements and any content fields. “insert after”
        adds it as a new slide; “replace this slide” swaps the one you opened.
      </p>
      <textarea
        autoFocus
        rows={16}
        value={slideJson.text}
        onChange={(e) => setSlideJson((s) => (s ? { ...s, text: e.target.value } : s))}
        placeholder={'{\n  "type": "text",\n  "elements": ["text"],\n  "text": "one idea per slide"\n}'}
      />
      <div className="overlay-actions">
        <button className="ghost-btn" onClick={() => setSlideJson(null)}>
          cancel
        </button>
        {slideJson.id && (
          <button className="ghost-btn" disabled={!slideJson.text.trim()} onClick={applySlideReplace}>
            replace this slide
          </button>
        )}
        <button className="export-btn" disabled={!slideJson.text.trim()} onClick={applySlideInsert}>
          insert after
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds. (Filmstrip wiring in Task 4 supplies the open trigger; the overlay is reachable after Task 4. `openSlideJson` may be flagged unused until Task 4 — if `tsc` errors on that, complete Step 1 of Task 4 in the same commit.)

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Add slide replace/insert mutations and single-slide JSON overlay"
```

---

### Task 4: Wire entry points — filmstrip `{ }` button, "+ paste page", import "load current as JSON"

**Files:**
- Modify: `src/editor/Filmstrip.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `openSlideJson`, `setSlideJson`, `projectToJSON` (App); new `onEditJson` prop (Filmstrip).
- Produces: complete user-reachable feature.

- [ ] **Step 1: Add `onEditJson` to Filmstrip props and the row actions**

In `FilmstripProps` add:

```ts
  onEditJson: (id: string) => void
```

Add it to the destructured params, then add a button in the `filmstrip-actions` span, before the delete button:

```tsx
<button title="edit / insert as json" onClick={() => onEditJson(slide.id)}>
  {'{ }'}
</button>
```

- [ ] **Step 2: Add a "+ paste page" chip in the add-slide row**

After the `SLIDE_TYPE_ORDER.map(...)` chips inside `.add-row`, add a chip that opens the insert-only editor. It needs a handler — reuse `onEditJson` is slide-specific, so add a second prop `onPastePage: () => void` to `FilmstripProps`, destructure it, and render:

```tsx
<button className="add-chip" onClick={onPastePage} title="paste a slide as json">
  + paste page
</button>
```

- [ ] **Step 3: Pass the new props from App**

In the `<Filmstrip ... />` usage in `App.tsx`, add:

```tsx
onEditJson={openSlideJson}
onPastePage={() => setSlideJson({ id: null, text: '' })}
```

- [ ] **Step 4: Add "load current as JSON" to the import overlay**

Inside the `importing && (...)` overlay, in its `.overlay-actions`, add a ghost button before "cancel":

```tsx
<button
  className="ghost-btn"
  onClick={() => setImportText(JSON.stringify(projectToJSON(project), null, 2))}
  title="dump the current carousel as editable json"
>
  load current as json
</button>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds, no unused-symbol errors.

- [ ] **Step 6: Manual verification (full spec checklist)**

Run `npm run dev` and confirm:
1. Import overlay → "load current as json" fills the box; edit a `text` value; "replace slides" → project updates, slide count unchanged.
2. Filmstrip `{ }` on a slide → edit a field → "replace this slide" → that slide changes in place, deck order unchanged.
3. Filmstrip `{ }` → "insert after" → a new slide appears right after; original intact.
4. "+ paste page" → paste a slide object → new slide inserted after the selected one (or appended when none selected).
5. Paste malformed JSON → `alert`, overlay stays open, no state change.
6. Round-trip: "load current as json", apply unchanged → deck visually identical.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/editor/Filmstrip.tsx
git commit -m "Wire JSON edit entry points: filmstrip button, paste page, load-current"
```
