# Design spec: hand-edit JSON & single-slide insert/replace

Date: 2026-06-23

## Problem

The carousel builder can import a full design JSON (replaces the whole project) or
a plain outline (replaces all slides). There is no way to:

1. Edit the **current** project's JSON by hand (round-trip: dump → edit → apply).
2. Add or replace **a single slide** from JSON without touching the rest of the deck.

This spec adds both, reusing the existing schema-validation logic so there is one
source of truth for what a slide JSON may contain.

## Goals

- Hand-edit the whole project as JSON and apply it back.
- Paste a single-slide JSON object and either **insert it after** the selected slide
  (new slide, fresh id) or **replace** the selected slide in place.
- Dump the current project / a single slide to **clean, compact** JSON (no walls of
  empty fields), suitable for hand-editing.

## Non-goals

- No live two-way JSON binding (edits in the JSON box don't update as you click around).
- No JSON schema autocomplete or validation UI beyond the existing inline `alert`.
- No per-element JSON editing.

## Architecture

### 1. `model.ts` — new pure functions

These are additive; existing `importDesign` / `importOutline` behavior is unchanged
(beyond `importDesign` being refactored to call the extracted helper).

- **`slideFromJSON(d: Record<string, unknown>): SlideModel`** — the per-slide mapping
  currently inlined in `importDesign` (lines ~423–503): type resolution, `CONTENT_KEYS`,
  `elements` filter, `sizes` / `widths` / `colors`, `eyebrow`, `imageMode`, `imageFrac`,
  `background`, `bgImage`, `overlay`, `textBg`, `free` / `positions`. Always returns a
  valid `SlideModel` with a fresh id (via `newSlide`). `importDesign` is refactored to
  `arr.map((d) => slideFromJSON(d as Record<string, unknown>))` — identical output.

- **`slideToJSON(s: SlideModel): Record<string, unknown>`** — serialize one slide for
  editing. Rules:
  - Always include `type` and `elements`.
  - Include each content key only if non-empty (`text`, `sub`, `stat`, `def`,
    `attribution`, `image`, `annotations`).
  - Include optionals only if present/meaningful: `eyebrow`, `sizes`, `widths`,
    `colors`, `imageMode`, `imageFrac`, `background`, `bgImage`, `overlay`, `textBg`,
    `free`, `positions`.
  - **Omit `id`** — it is regenerated on import, so hand-edited JSON never collides.

- **`projectToJSON(p: Project): Record<string, unknown>`** — `{ title, theme, ratio?,
  colors?, chrome?, slides: p.slides.map(slideToJSON) }`. `theme` mirrors the import
  key (`importDesign` reads `data.theme ?? data.themeId`). Omit `ratio` / `colors` /
  `chrome` when absent. No top-level `id`.

JSON shown in the UI is pretty-printed with `JSON.stringify(obj, null, 2)`.

### 2. Project-level edit — extend the existing import overlay

In the import overlay (`App.tsx`, `importing` block):

- Add a **"load current as JSON"** ghost button. On click it sets
  `importText = JSON.stringify(projectToJSON(project), null, 2)`.
- The existing `runImport` already routes a `{`/`[`-prefixed payload through
  `importDesign`, which replaces the project. No new apply logic is needed.
- The apply button keeps its current label behavior (outline → "replace slides";
  the JSON path still replaces the project). No label change required for correctness;
  optional cosmetic tweak only.

### 3. Single-slide insert / edit — new overlay + filmstrip action

New overlay driven by App state:

```ts
// id === null  → insert-only mode (brand-new page, no source slide)
// id === <id>  → opened from a specific slide; text pre-filled from it
const [slideJson, setSlideJson] = useState<{ id: string | null; text: string } | null>(null)
```

Entry points:
- **Filmstrip row action `{ }`** — opens the overlay with
  `{ id: slide.id, text: JSON.stringify(slideToJSON(slide), null, 2) }`.
- **"+ paste page"** affordance near the "add slide" chips — opens with
  `{ id: null, text: '' }` for inserting a fresh page (works even on an empty deck;
  inserts at the end when there is no selected slide).

The overlay contains an editable textarea and two apply buttons:
- **"replace this slide"** (shown only when `slideJson.id` is non-null and that slide
  still exists) — `replaceSlide(id, slideFromJSON(parse(text)))`.
- **"insert after"** — `insertSlideAfter(slideJson.id, slideFromJSON(parse(text)))`;
  with a null id (or missing slide) it appends to the end.

Parsing: `JSON.parse` then `slideFromJSON`. A single object is expected; if the user
pastes a `{ slides: [...] }` or an array, take the first element so a copied
project-slide still works. On any error, `alert(...)` with the message — the same
pattern as `runImport` today. On success, close the overlay, select the affected
slide, and clear the text.

### 4. App.tsx mutations

Alongside the existing slide mutations:

- **`replaceSlide(id, model)`** — map slides, swapping the matched slide for `model`
  while **keeping `model`'s fresh id** (so React keys and selection stay coherent);
  set `selectedId` to the new id, clear `selectedElement`.
- **`insertSlideAfter(id, model)`** — find index of `id` (or `-1` → append at end),
  splice `model` in at `idx + 1`, set `selectedId` to `model.id`.

Filmstrip gets one new prop: `onEditJson(id: string)`.

## Data flow

```
dump:   project/slide ── slideToJSON/projectToJSON ──▶ pretty JSON in textarea
apply:  textarea text ── JSON.parse ──▶ slideFromJSON / importDesign ──▶ SlideModel(s)
        ──▶ replaceSlide / insertSlideAfter / setProject ──▶ React state ──▶ localStorage
```

`slideFromJSON` is the single validation choke point: both whole-project import and
single-slide insert go through it, so they can never diverge.

## Error handling

- Invalid JSON or non-object slide → `alert` with the parse error; overlay stays open,
  text preserved (matches `runImport`).
- Unknown `type` → falls back to `'text'` (existing `slideFromJSON` behavior).
- Unknown element keys / malformed nested objects → filtered out silently (existing
  per-field guards in the extracted logic).

## Testing

Manual verification (the project has no test harness):
1. Import overlay → "load current as JSON" fills the box; edit a `text` field; apply →
   project updates, slide count unchanged.
2. Filmstrip `{ }` on a slide → edit → "replace this slide" → that slide changes in
   place, deck order unchanged.
3. Filmstrip `{ }` → "insert after" → a new slide appears right after, original intact.
4. "+ paste page" on an empty/non-empty deck → new slide appended/inserted.
5. Paste malformed JSON → alert, overlay stays open, no state change.
6. Round-trip: dump project JSON, apply unchanged → deck is visually identical.
