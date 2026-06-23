import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  Align,
  DragKey,
  ElementKey,
  Project,
  SlideModel,
  SlideOverlay,
  SlideType,
  TextBacking,
} from './model'
import {
  baseKey,
  DEFAULT_FREE_POS,
  SIZE_RANGE,
  ensureElements,
  fromLegacyMarkdown,
  importDesign,
  importOutline,
  microLabels,
  newSlide,
  projectToJSON,
  referencedAssets,
  sizeFor,
  slideFromJSON,
  slideToJSON,
} from './model'
import {
  THEMES,
  themeById,
  layout,
  buildCustomTheme,
  sampleTheme,
  DEFAULT_CUSTOM,
  applyColorOverrides,
  RATIOS,
  slideHeightFor,
} from './tokens'
import type { CustomThemeData, ColorOverrides, Ratio } from './tokens'
import { exportCarousel } from './exporter'
import { Inspector } from './editor/Inspector'
import { Filmstrip } from './editor/Filmstrip'
import { Canvas } from './editor/Canvas'
import { computeSnap } from './editor/snapGuides'
import type { Box, Guide } from './editor/snapGuides'
import { SEED_PROJECT, templateProject } from './seed'
import sealPlateUrl from './assets/seal-plate.jpg'
import './App.css'

// example assets that ship with the app — always available, not removable
const BUILTIN_ASSETS: Record<string, string> = {
  'seal-plate.jpg': sealPlateUrl,
}

const PROJECT_KEY = 'antara-carousel-project' // the live working draft
const BASELINE_KEY = 'antara-carousel-baseline' // snapshot of the last import/load/save, for "reset"
const DESIGNS_KEY = 'antara-carousel-designs' // the saved library
const CURRENT_KEY = 'antara-carousel-current' // id of the loaded saved design
const CUSTOM_KEY = 'antara-carousel-custom' // the user's custom theme (image + colors)
const IMAGES_KEY = 'antara-carousel-images' // user-uploaded images, as data urls (persisted)
const LEGACY_KEY = 'antara-carousel-draft'
// a saved carousel in the library — content + theme only (uploaded image bytes
// stay session-only, same as the working draft)
interface SavedDesign {
  id: string
  name: string
  savedAt: number
  project: Project
}

const cloneProject = (p: Project): Project => JSON.parse(JSON.stringify(p))

function loadDesigns(): SavedDesign[] {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as SavedDesign[]
    return Array.isArray(arr)
      ? arr.map((d) => ({ ...d, project: { ...d.project, slides: d.project.slides.map(ensureElements) } }))
      : []
  } catch {
    return []
  }
}

const timeAgo = (ms: number): string => {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function loadCustom(): CustomThemeData {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (raw) return { ...DEFAULT_CUSTOM, ...(JSON.parse(raw) as Partial<CustomThemeData>) }
  } catch {
    // corrupted — fall back to the default custom theme
  }
  return DEFAULT_CUSTOM
}

// user-uploaded images, persisted as data urls so they survive a reload and can
// be reused as slide backgrounds. built-in example assets are bundled separately.
function loadImages(): Record<string, string> {
  try {
    const raw = localStorage.getItem(IMAGES_KEY)
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>
      if (obj && typeof obj === 'object') return obj
    }
  } catch {
    // corrupted — start empty
  }
  return {}
}

// read an image File as a data url (so it can be persisted)
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('could not read file'))
    reader.readAsDataURL(file)
  })
}

// the carousel canvas is 1080px wide; uploads bigger than this only waste
// localStorage quota. downscale to fit MAX_DIM on the longest side and re-encode
// as JPEG so full-res photos don't blow the ~5MB budget. falls back to the raw
// data url if the image can't be decoded (e.g. SVG, or a load error).
const MAX_DIM = 1440 // a little above 1080 so backgrounds stay crisp when scaled
const JPEG_QUALITY = 0.82
async function compressImage(file: File): Promise<string> {
  const raw = await fileToDataUrl(file)
  // SVGs and gifs don't benefit from canvas re-encoding (and gifs lose animation)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return raw
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = raw
    })
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
    // already small and not worth re-encoding — keep the original bytes
    if (scale === 1 && raw.length < 500_000) return raw
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return raw
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    // keep whichever is smaller (tiny PNGs can beat JPEG)
    return out.length < raw.length ? out : raw
  } catch {
    return raw
  }
}

function loadProject(): Project {
  try {
    const raw = localStorage.getItem(PROJECT_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Project
      if (Array.isArray(p.slides))
        return { ...p, slides: p.slides.map(ensureElements) }
    }
    // migrate the old markdown draft if one exists
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const p = fromLegacyMarkdown(legacy)
      if (p.slides.length > 0) return p
    }
  } catch {
    // corrupted draft — fall through to the seed
  }
  return SEED_PROJECT
}

// the snapshot "reset" reverts to: the project as it was at the last import,
// design load, or save. persisted so it survives a reload (otherwise it would
// re-seed from the already-edited draft). falls back to the current project.
function loadBaseline(): Project {
  try {
    const raw = localStorage.getItem(BASELINE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Project
      if (Array.isArray(p.slides)) return { ...p, slides: p.slides.map(ensureElements) }
    }
  } catch {
    // corrupted — fall back to the working draft
  }
  return loadProject()
}

export default function App() {
  const [project, setProject] = useState<Project>(loadProject)
  // snapshot to restore on "reset" — updated at each import/load/save checkpoint
  const [baseline, setBaseline] = useState<Project>(loadBaseline)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadProject().slides[0]?.id ?? null,
  )
  // a copied free-layout (element positions) ready to paste onto another slide
  const [layoutClip, setLayoutClip] = useState<SlideModel['positions'] | null>(null)
  // which element on the selected slide is highlighted (synced between the
  // editor cards and the slide previews). null = whole slide, no element.
  const [selectedElement, setSelectedElement] = useState<DragKey | null>(null)
  // alignment guides shown over the canvas during a free-layout drag; cleared on
  // drop. set whenever the dragged element snaps onto another element's or the
  // canvas's edge/center.
  const [dragGuides, setDragGuides] = useState<Guide[]>([])
  // the slide id whose background is in reposition (crop-pan) mode, if any.
  // tied to an id so switching slides leaves the mode automatically.
  const [bgPanId, setBgPanId] = useState<string | null>(null)
  const [userImages, setUserImages] = useState<Record<string, string>>(loadImages)
  const [storageFull, setStorageFull] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  // single-slide JSON editor. id null = insert a brand-new page; id set = opened
  // from that slide (pre-filled, can replace in place or insert after).
  const [slideJson, setSlideJson] = useState<{ id: string | null; text: string } | null>(null)
  const [designs, setDesigns] = useState<SavedDesign[]>(loadDesigns)
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_KEY),
  )
  const [showDesigns, setShowDesigns] = useState(false)
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [custom, setCustom] = useState<CustomThemeData>(loadCustom)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // mobile: the inspector rides in a bottom sheet instead of a side pane
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches,
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project))
  }, [project])

  useEffect(() => {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline))
  }, [baseline])

  useEffect(() => {
    localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs))
  }, [designs])

  useEffect(() => {
    if (currentDesignId) localStorage.setItem(CURRENT_KEY, currentDesignId)
    else localStorage.removeItem(CURRENT_KEY)
  }, [currentDesignId])

  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom))
  }, [custom])

  // the full image lookup the renderer sees: bundled examples + user uploads
  const assets = useMemo(() => ({ ...BUILTIN_ASSETS, ...userImages }), [userImages])

  // persist images as data urls. localStorage is ~5MB; many full-res images can
  // blow the quota, so we keep them in memory for the session and warn instead.
  const saveImages = useCallback((images: Record<string, string>) => {
    try {
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images))
      setStorageFull(false)
    } catch {
      setStorageFull(true)
    }
  }, [])

  const theme = useMemo(() => {
    const base =
      project.themeId === 'custom' ? buildCustomTheme(custom) : themeById(project.themeId)
    return applyColorOverrides(base, project.colors)
  }, [project.themeId, project.colors, custom])
  const labels = useMemo(() => microLabels(project, theme), [project, theme])
  const refs = useMemo(() => referencedAssets(project), [project])
  const missing = refs.filter((name) => !assets[name])
  const slideH = slideHeightFor(project.ratio)

  const selected = project.slides.find((s) => s.id === selectedId) ?? null

  // the highlighted element only counts while it still lives on the selected
  // slide — so switching slides clears a stale highlight automatically. an
  // annotation line ("annotations#2") validates against its base element.
  const activeDragKey: DragKey | null =
    selected && selectedElement && selected.elements.includes(baseKey(selectedElement))
      ? selectedElement
      : null
  // the canvas highlights the exact drag key (one annotation line); the
  // inspector edits the underlying element, so it sees the base key
  const activeElement: ElementKey | null = activeDragKey ? baseKey(activeDragKey) : null

  // ── project mutations ──────────────────────────────────────
  const patch = useCallback((fn: (p: Project) => Project) => {
    setProject((p) => fn(p))
  }, [])

  const updateSlide = useCallback(
    (id: string, changes: Partial<SlideModel>) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => (s.id === id ? { ...s, ...changes } : s)),
      })),
    [patch],
  )

  // switch output ratio. width is unchanged; only height shifts, so we just
  // keep any freely-placed element from falling off the bottom of a shorter slide.
  const setRatio = useCallback(
    (ratio: Ratio) =>
      patch((p) => {
        const h = slideHeightFor(ratio)
        const slides = p.slides.map((s) => {
          if (!s.free || !s.positions) return s
          const positions = Object.fromEntries(
            Object.entries(s.positions)
              .filter(([, pos]) => pos)
              .map(([k, pos]) => [k, { x: pos!.x, y: Math.min(pos!.y, h - 80) }]),
          ) as NonNullable<SlideModel['positions']>
          return { ...s, positions }
        })
        return { ...p, ratio, slides }
      }),
    [patch],
  )

  const addElement = useCallback(
    (id: string, key: ElementKey) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) =>
          s.id === id && !s.elements.includes(key)
            ? { ...s, elements: [...s.elements, key] } // append; order is user-controlled
            : s,
        ),
      })),
    [patch],
  )

  const removeElement = useCallback(
    (id: string, key: ElementKey) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) =>
          s.id === id
            ? { ...s, elements: s.elements.filter((k) => k !== key), [key]: '' }
            : s,
        ),
      })),
    [patch],
  )

  // set (or clear, when value is undefined → auto) an element's manual size
  const setSize = useCallback(
    (id: string, key: ElementKey, value: number | undefined) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => {
          if (s.id !== id) return s
          const sizes = { ...(s.sizes ?? {}) }
          if (value == null) delete sizes[key]
          else sizes[key] = value
          return { ...s, sizes }
        }),
      })),
    [patch],
  )

  // set (or clear, when value is undefined → auto) an element's manual width
  const setWidth = useCallback(
    (id: string, key: ElementKey, value: number | undefined) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => {
          if (s.id !== id) return s
          const widths = { ...(s.widths ?? {}) }
          if (value == null) delete widths[key]
          else widths[key] = value
          return { ...s, widths }
        }),
      })),
    [patch],
  )

  // set (or clear, when value is undefined) a single element's color override
  const setElementColor = useCallback(
    (id: string, key: ElementKey, value: string | undefined) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => {
          if (s.id !== id) return s
          const colors = { ...(s.colors ?? {}) }
          if (value == null) delete colors[key]
          else colors[key] = value
          return { ...s, colors }
        }),
      })),
    [patch],
  )

  // set (or clear, when value is undefined → type default) an element's align
  const setAlign = useCallback(
    (id: string, key: ElementKey, value: Align | undefined) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => {
          if (s.id !== id) return s
          const aligns = { ...(s.aligns ?? {}) }
          if (value == null) delete aligns[key]
          else aligns[key] = value
          return { ...s, aligns }
        }),
      })),
    [patch],
  )

  // set (or clear) the per-slide background overlay
  const setOverlay = useCallback(
    (id: string, value: SlideOverlay | undefined) =>
      updateSlide(id, { overlay: value }),
    [updateSlide],
  )

  // set (or clear, when value is undefined) a single element's text backing plate
  const setTextBg = useCallback(
    (id: string, key: ElementKey, value: TextBacking | undefined) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => {
          if (s.id !== id) return s
          const textBg = { ...(s.textBg ?? {}) }
          if (value == null) delete textBg[key]
          else textBg[key] = value
          return { ...s, textBg }
        }),
      })),
    [patch],
  )

  // patch the project-wide chrome settings (labels / page numbers / wordmark /
  // entry-no override). a key set to undefined is dropped → back to auto/on.
  const setChrome = useCallback(
    (changes: Partial<NonNullable<Project['chrome']>>) =>
      patch((p) => {
        const chrome = { ...(p.chrome ?? {}) }
        for (const [k, v] of Object.entries(changes)) {
          if (v === undefined) delete chrome[k as keyof typeof chrome]
          else (chrome as Record<string, unknown>)[k] = v
        }
        // empty → back to the all-on default (undefined drops from saved JSON)
        if (Object.keys(chrome).length === 0) return { ...p, chrome: undefined }
        return { ...p, chrome }
      }),
    [patch],
  )

  // set (or clear) a theme-wide text-color override on the project
  const setProjectColor = useCallback(
    (key: keyof ColorOverrides, value: string | undefined) =>
      patch((p) => {
        const colors = { ...(p.colors ?? {}) }
        if (value == null) delete colors[key]
        else colors[key] = value
        return { ...p, colors }
      }),
    [patch],
  )

  // ── free-layout drag ───────────────────────────────────────
  // dragging an element on the preview places it freely. the slide flips into
  // free mode with each element's position seeded from where auto-layout draws
  // it, so the switch is seamless. positions are canvas coords (1080×1350), so
  // they render identically in the scaled preview and the full-size export.
  const dragRef = useRef<{
    id: string
    key: DragKey
    startX: number
    startY: number
    seed: NonNullable<SlideModel['positions']>
    origX: number
    origY: number
    moved: boolean
    scale: number
    // every element's box in canvas coords, for alignment snapping
    boxes: Record<string, Box>
    canvasH: number
  } | null>(null)

  const onElementPointerDown = useCallback(
    (e: ReactPointerEvent, key: DragKey) => {
      const slide = selected
      if (!slide) return
      const wrapper = e.currentTarget as HTMLElement
      const canvas = wrapper.closest('[data-slide-canvas]') as HTMLElement | null
      const root = wrapper.closest('[data-content-root]') as HTMLElement | null
      if (!canvas || !root) return
      const rootRect = root.getBoundingClientRect()
      // the slide may render at any size (small filmstrip thumb or big canvas);
      // derive the live scale from the rendered width instead of a fixed constant
      const scale = canvas.getBoundingClientRect().width / layout.slideW

      // measure every element's box (in canvas coords) for both seeding free
      // positions and computing alignment guides while dragging
      const boxes: Record<string, Box> = {}
      canvas.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => {
        const k = el.dataset.el as DragKey
        const r = el.getBoundingClientRect()
        boxes[k] = {
          x: Math.round((r.left - rootRect.left) / scale),
          y: Math.round((r.top - rootRect.top) / scale),
          w: Math.round(r.width / scale),
          h: Math.round(r.height / scale),
        }
      })

      // seed every element: keep any already-pinned positions, fall back to the
      // measured on-screen spot for the rest
      const seed: NonNullable<SlideModel['positions']> = { ...(slide.free ? slide.positions : {}) }
      for (const [k, b] of Object.entries(boxes)) {
        if (!seed[k as DragKey]) seed[k as DragKey] = { x: b.x, y: b.y }
      }

      // fixed chrome (wordmark, eyebrow label, page number) are snap *targets*
      // only — measured as reference boxes but never seeded or draggable. keyed
      // off [data-guide] so they can't collide with a draggable element's key.
      canvas.querySelectorAll<HTMLElement>('[data-guide]').forEach((el) => {
        const r = el.getBoundingClientRect()
        boxes[`guide:${el.dataset.guide}`] = {
          x: Math.round((r.left - rootRect.left) / scale),
          y: Math.round((r.top - rootRect.top) / scale),
          w: Math.round(r.width / scale),
          h: Math.round(r.height / scale),
        }
      })

      const start = seed[key] ?? { ...DEFAULT_FREE_POS }
      dragRef.current = {
        id: slide.id,
        key,
        startX: e.clientX,
        startY: e.clientY,
        seed,
        origX: start.x,
        origY: start.y,
        moved: false,
        scale,
        boxes,
        canvasH: slideH,
      }
      setSelectedElement(key)

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current
        if (!d) return
        const dxPx = ev.clientX - d.startX
        const dyPx = ev.clientY - d.startY
        // a small threshold keeps a plain click (to select) from nudging things
        if (!d.moved && Math.hypot(dxPx, dyPx) < 4) return
        d.moved = true
        ev.preventDefault()
        const proposed = { x: d.origX + dxPx / d.scale, y: d.origY + dyPx / d.scale }
        const self = d.boxes[d.key]
        const others = Object.entries(d.boxes)
          .filter(([k]) => k !== d.key)
          .map(([, b]) => b)
        const snapped = self
          ? computeSnap(proposed, { w: self.w, h: self.h }, others, {
              w: layout.slideW,
              h: d.canvasH,
            })
          : { x: Math.round(proposed.x), y: Math.round(proposed.y), guides: [] as Guide[] }
        setDragGuides(snapped.guides)
        updateSlide(d.id, {
          free: true,
          positions: { ...d.seed, [d.key]: { x: snapped.x, y: snapped.y } },
        })
      }
      const onUp = () => {
        dragRef.current = null
        setDragGuides([])
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [selected, updateSlide, slideH],
  )

  // ── image crop-pan (object-position) ───────────────────────
  // dragging a cover-fit image slides which part of it shows. focus is stored as
  // {x,y} fractions in [0,1]; we map the pointer delta to a fraction via the
  // cover overflow (how much of the image is cropped on each axis), so the image
  // tracks the cursor 1:1 along whichever axis actually overflows.
  const startImgPan = useCallback(
    (
      e: ReactPointerEvent,
      img: HTMLImageElement,
      field: 'imageFocus' | 'bgFocus',
      // the un-zoomed display box (defaults to the image's own rect) and any
      // extra zoom applied on top of cover — both needed so a zoomed background
      // still tracks the cursor 1:1
      opts: { box?: DOMRect; zoom?: number } = {},
    ) => {
      const slide = selected
      if (!slide) return
      e.preventDefault() // suppress native image drag / text selection
      const box = opts.box ?? img.getBoundingClientRect()
      const zoom = opts.zoom ?? 1
      const { naturalWidth: nw, naturalHeight: nh } = img
      if (!nw || !nh || !box.width || !box.height) return
      const cover = Math.max(box.width / nw, box.height / nh)
      // screen px of crop overflow the focus spans, magnified by any extra zoom
      const overflowX = (nw * cover - box.width) * zoom
      const overflowY = (nh * cover - box.height) * zoom
      const cur = slide[field] ?? { x: 0.5, y: 0.5 }
      const id = slide.id
      const startX = e.clientX
      const startY = e.clientY
      let moved = false
      const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!moved && Math.hypot(dx, dy) < 4) return
        moved = true
        ev.preventDefault()
        updateSlide(id, {
          [field]: {
            x: overflowX > 0 ? clamp01(cur.x - dx / overflowX) : cur.x,
            y: overflowY > 0 ? clamp01(cur.y - dy / overflowY) : cur.y,
          },
        })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [selected, updateSlide],
  )

  const onBandPointerDown = useCallback(
    (e: ReactPointerEvent) => startImgPan(e, e.currentTarget as HTMLImageElement, 'imageFocus'),
    [startImgPan],
  )

  const onBgPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const canvas = (e.currentTarget as HTMLElement).closest('[data-slide-canvas]')
      const img = canvas?.querySelector('[data-bg-image]') as HTMLImageElement | null
      if (!img || !canvas) return
      // the bg img carries the zoom transform, so its own rect is scaled; use the
      // canvas (un-zoomed) box and pass the zoom factor separately
      startImgPan(e, img, 'bgFocus', {
        box: canvas.getBoundingClientRect(),
        zoom: selected?.bgScale ?? 1,
      })
    },
    [startImgPan, selected],
  )

  const toggleBgPan = useCallback(() => {
    setBgPanId((cur) => (cur === selectedId ? null : selectedId))
  }, [selectedId])

  const setBgScale = useCallback(
    (z: number) => {
      if (selected) updateSlide(selected.id, { bgScale: z })
    },
    [selected, updateSlide],
  )

  // bg-reposition mode applies only while its slide stays selected
  const bgPanning = bgPanId !== null && bgPanId === selectedId
  // esc / enter leaves background-reposition mode
  useEffect(() => {
    if (!bgPanning) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') setBgPanId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bgPanning])

  // dragging the corner handle scales the element's font size. the ratio of the
  // pointer's distance from the (anchored) top-left corner drives the new size,
  // clamped to the element's slider range — so resize and the slider stay in sync.
  const onElementResizeStart = useCallback(
    (e: ReactPointerEvent, key: DragKey) => {
      const slide = selected
      // font-size lives on the base element (annotation lines share one size)
      const base = baseKey(key)
      if (!slide || base === 'image') return
      const wrapper = (e.currentTarget as HTMLElement).closest('[data-el]') as HTMLElement | null
      if (!wrapper) return
      const rect = wrapper.getBoundingClientRect()
      const origSize = sizeFor(slide, base)
      const startDist = Math.hypot(e.clientX - rect.left, e.clientY - rect.top) || 1
      const range = SIZE_RANGE[base]
      setSelectedElement(key)

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault()
        const dist = Math.hypot(ev.clientX - rect.left, ev.clientY - rect.top)
        const next = Math.round(origSize * (dist / startDist))
        setSize(slide.id, base, Math.max(range.min, Math.min(range.max, next)))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [selected, setSize],
  )

  // reset a slide to automatic stacking, dropping all free positions
  const resetLayout = useCallback(
    (id: string) => updateSlide(id, { free: false, positions: undefined }),
    [updateSlide],
  )
  // stash the selected slide's layout so it can be pasted onto another slide
  const copyLayout = useCallback(() => {
    if (selected?.positions) setLayoutClip({ ...selected.positions })
  }, [selected])
  // apply the copied layout — only elements the target also has are affected
  const pasteLayout = useCallback(
    (id: string) => {
      if (layoutClip) updateSlide(id, { free: true, positions: { ...layoutClip } })
    },
    [layoutClip, updateSlide],
  )
  // push the selected slide's layout onto every other (non-diagram) slide
  const applyLayoutToAll = useCallback(() => {
    if (!selected?.positions) return
    const positions = { ...selected.positions }
    patch((p) => ({
      ...p,
      slides: p.slides.map((s) =>
        s.type === 'diagram' ? s : { ...s, free: true, positions: { ...positions } },
      ),
    }))
  }, [selected, patch])

  // wrap the current body-text selection in emphasis markers (circle/underline/
  // highlight). no-op if nothing is selected.
  const wrapSelection = useCallback(
    (open: string, close: string) => {
      const ta = bodyRef.current
      if (!ta || !selected) return
      const a = ta.selectionStart
      const b = ta.selectionEnd
      if (a === b) return
      const v = ta.value
      const next = v.slice(0, a) + open + v.slice(a, b) + close + v.slice(b)
      updateSlide(selected.id, { text: next })
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(a, b + open.length + close.length)
      })
    },
    [selected, updateSlide],
  )

  const addSlide = useCallback(
    (type: SlideType) => {
      const slide = newSlide(type)
      patch((p) => ({ ...p, slides: [...p.slides, slide] }))
      setSelectedId(slide.id)
    },
    [patch],
  )

  const removeSlide = useCallback(
    (id: string) =>
      patch((p) => {
        const idx = p.slides.findIndex((s) => s.id === id)
        const slides = p.slides.filter((s) => s.id !== id)
        if (id === selectedId)
          setSelectedId(slides[Math.min(idx, slides.length - 1)]?.id ?? null)
        return { ...p, slides }
      }),
    [patch, selectedId],
  )

  const duplicateSlide = useCallback(
    (id: string) =>
      patch((p) => {
        const idx = p.slides.findIndex((s) => s.id === id)
        if (idx < 0) return p
        const copy = { ...p.slides[idx], id: newSlide('text').id }
        const slides = [...p.slides]
        slides.splice(idx + 1, 0, copy)
        setSelectedId(copy.id)
        return { ...p, slides }
      }),
    [patch],
  )

  const moveSlide = useCallback(
    (id: string, dir: -1 | 1) =>
      patch((p) => {
        const idx = p.slides.findIndex((s) => s.id === id)
        const to = idx + dir
        if (idx < 0 || to < 0 || to >= p.slides.length) return p
        const slides = [...p.slides]
        ;[slides[idx], slides[to]] = [slides[to], slides[idx]]
        return { ...p, slides }
      }),
    [patch],
  )

  // swap the slide at `id` for a model built from JSON (keeps the model's fresh id)
  const replaceSlide = useCallback(
    (id: string, model: SlideModel) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => (s.id === id ? model : s)),
      })),
    [patch],
  )

  // splice a model in right after `id` (append when id is null or not found)
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

  // open the single-slide editor pre-filled from a slide
  const openSlideJson = useCallback(
    (id: string) => {
      const s = project.slides.find((x) => x.id === id)
      setSlideJson({ id, text: s ? JSON.stringify(slideToJSON(s), null, 2) : '' })
    },
    [project.slides],
  )

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

  // ── assets ─────────────────────────────────────────────────
  // read uploads as data urls (persisted), then report the names added so a
  // caller (e.g. the slide-background picker) can assign the freshly added image.
  const addFiles = useCallback(
    async (files: FileList | File[], onAdded?: (names: string[]) => void) => {
      const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
      const entries = await Promise.all(
        images.map(async (f) => [f.name, await compressImage(f)] as const),
      )
      if (!entries.length) return
      const next = { ...userImages, ...Object.fromEntries(entries) }
      setUserImages(next)
      saveImages(next)
      onAdded?.(entries.map(([name]) => name))
    },
    [userImages, saveImages],
  )

  const removeAsset = useCallback(
    (name: string) => {
      const next = { ...userImages }
      delete next[name]
      setUserImages(next)
      saveImages(next)
    },
    [userImages, saveImages],
  )

  // drop every uploaded image no slide references, freeing localStorage in one
  // click. images still in use are kept. returns how many were removed.
  const clearUnusedImages = useCallback((): number => {
    const used = new Set(refs)
    const next: Record<string, string> = {}
    let removed = 0
    for (const [name, url] of Object.entries(userImages)) {
      if (used.has(name)) next[name] = url
      else removed++
    }
    if (removed > 0) {
      setUserImages(next)
      saveImages(next)
    }
    return removed
  }, [userImages, refs, saveImages])

  // ── custom theme ───────────────────────────────────────────
  // store the background as a data url (not an object url) so it survives a
  // reload, then sample it to pre-fill the text colors.
  const setCustomBg = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async () => {
      const url = String(reader.result)
      let sampled: Partial<CustomThemeData> = {}
      try {
        sampled = await sampleTheme(url)
      } catch {
        // sampling failed — keep the current colors, just set the image
      }
      setCustom((c) => ({ ...c, ...sampled, bg: url }))
    }
    reader.readAsDataURL(file)
  }, [])

  const autoColors = useCallback(async () => {
    if (!custom.bg) return
    try {
      const sampled = await sampleTheme(custom.bg)
      setCustom((c) => ({ ...c, ...sampled }))
    } catch {
      alert('could not read colors from that image')
    }
  }, [custom.bg])

  // ── import / export ────────────────────────────────────────
  const runImport = useCallback(() => {
    const text = importText.trim()
    // a generated design schema (JSON) replaces the whole project; a plain
    // outline just replaces the slides
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const p = importDesign(importText)
        setProject(p)
        setBaseline(cloneProject(p))
        setSelectedId(p.slides[0]?.id ?? null)
        setCurrentDesignId(null)
        setImporting(false)
        setImportText('')
      } catch (err) {
        alert('could not read design json: ' + (err instanceof Error ? err.message : String(err)))
      }
      return
    }
    const { title, slides } = importOutline(importText)
    if (slides.length === 0) return
    setProject((p) => {
      const next = { ...p, title: title || p.title, slides }
      setBaseline(cloneProject(next))
      return next
    })
    setSelectedId(slides[0].id)
    setImporting(false)
    setImportText('')
  }, [importText])

  const handleExport = useCallback(async () => {
    setExporting('preparing…')
    try {
      await exportCarousel(project, assets, (done, total) =>
        setExporting(`rendering ${done} / ${total}`),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(null)
    }
  }, [project, assets])

  // ── saved designs library ──────────────────────────────────
  const flashSaved = useCallback(() => {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1400)
  }, [])

  // save the working draft into the library — update the loaded design, or
  // create a new entry if none is loaded
  const saveDesign = useCallback(() => {
    const name = project.title.trim() || 'untitled carousel'
    const snapshot = cloneProject(project)
    setBaseline(cloneProject(project)) // saving makes this the new "original" to reset to
    setDesigns((list) => {
      const existing = currentDesignId && list.some((d) => d.id === currentDesignId)
      if (existing) {
        return list.map((d) =>
          d.id === currentDesignId ? { ...d, name, savedAt: Date.now(), project: snapshot } : d,
        )
      }
      const id = newSlide('text').id // reuse the random id generator
      setCurrentDesignId(id)
      return [{ id, name, savedAt: Date.now(), project: snapshot }, ...list]
    })
    flashSaved()
  }, [project, currentDesignId, flashSaved])

  const saveAsNew = useCallback(() => {
    const name = (project.title.trim() || 'untitled carousel') + ' (copy)'
    const id = newSlide('text').id
    setBaseline(cloneProject(project)) // saving makes this the new "original" to reset to
    setDesigns((list) => [
      { id, name, savedAt: Date.now(), project: cloneProject(project) },
      ...list,
    ])
    setCurrentDesignId(id)
    flashSaved()
  }, [project, flashSaved])

  const loadDesign = useCallback((d: SavedDesign) => {
    const p = cloneProject(d.project)
    setProject(p)
    setBaseline(cloneProject(p))
    setSelectedId(p.slides[0]?.id ?? null)
    setCurrentDesignId(d.id)
    setShowDesigns(false)
  }, [])

  const deleteDesign = useCallback(
    (id: string) => {
      setDesigns((list) => list.filter((d) => d.id !== id))
      if (id === currentDesignId) setCurrentDesignId(null)
    },
    [currentDesignId],
  )

  const renameDesign = useCallback((id: string, name: string) => {
    setDesigns((list) => list.map((d) => (d.id === id ? { ...d, name } : d)))
  }, [])

  // load a fresh placeholder carousel, discarding the current one
  const loadTemplate = useCallback(() => {
    const fresh = templateProject(project.themeId)
    setProject(fresh)
    setBaseline(cloneProject(fresh))
    setSelectedId(fresh.slides[0].id)
    setCurrentDesignId(null)
    setShowDesigns(false)
    setShowNewPrompt(false)
  }, [project.themeId])

  // does the live carousel have unsaved work worth a prompt before discarding?
  const isDirty = useCallback(() => {
    if (currentDesignId) {
      const saved = designs.find((d) => d.id === currentDesignId)
      return !saved || JSON.stringify(saved.project) !== JSON.stringify(project)
    }
    return project.slides.some((s) =>
      [s.text, s.sub, s.stat, s.def, s.attribution, s.annotations, s.image].some(Boolean),
    )
  }, [project, currentDesignId, designs])

  // "new carousel": prompt to save first if there's anything to lose
  const newDesign = useCallback(() => {
    setShowDesigns(false)
    if (isDirty()) setShowNewPrompt(true)
    else loadTemplate()
  }, [isDirty, loadTemplate])

  // "reset": discard edits made since the last import/load/save and restore that snapshot
  const canReset = useMemo(
    () => JSON.stringify(project) !== JSON.stringify(baseline),
    [project, baseline],
  )
  const resetToOriginal = useCallback(() => {
    if (!canReset) return
    if (!window.confirm('Discard all changes and return to the last imported/saved version?')) return
    const p = cloneProject(baseline)
    setProject(p)
    setSelectedId(p.slides[0]?.id ?? null)
    setSelectedElement(null)
  }, [baseline, canReset])

  const currentName = designs.find((d) => d.id === currentDesignId)?.name ?? null

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-brand">antara</span>
        <input
          className="title-input"
          value={project.title}
          placeholder="untitled carousel"
          onChange={(e) => patch((p) => ({ ...p, title: e.target.value }))}
        />
        <select
          className="theme-select"
          value={project.themeId}
          onChange={(e) => patch((p) => ({ ...p, themeId: e.target.value }))}
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              theme · {t.name}
            </option>
          ))}
          <option value="custom">theme · custom</option>
        </select>
        <select
          className="theme-select"
          value={project.ratio ?? '4:5'}
          onChange={(e) => setRatio(e.target.value as Ratio)}
          title="output aspect ratio"
        >
          {RATIOS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          className="export-btn"
          onClick={handleExport}
          disabled={exporting !== null || project.slides.length === 0}
        >
          {exporting ?? 'export pngs'}
        </button>
      </header>

      <main className="workspace">
        {/* ── slide list ── */}
        <section className="list-pane">
          <Filmstrip
            slides={project.slides}
            selectedId={selectedId}
            labels={labels}
            theme={theme}
            assets={assets}
            onSelect={(id) => { setSelectedId(id); setSelectedElement(null) }}
            onMove={moveSlide}
            onDuplicate={duplicateSlide}
            onRemove={removeSlide}
            onAdd={addSlide}
            onEditJson={openSlideJson}
            onPastePage={() => setSlideJson({ id: null, text: '' })}
            slideH={slideH}
            showPageNumber={project.chrome?.pageNumbers !== false}
            showWordmark={project.chrome?.wordmark !== false}
          />
        </section>

        {/* ── canvas ── */}
        <section className="preview-pane">
          <Canvas
            slide={selected}
            index={selected ? project.slides.findIndex((s) => s.id === selected.id) : 0}
            total={project.slides.length}
            microLabel={selected ? labels[project.slides.findIndex((s) => s.id === selected.id)] : ''}
            theme={theme}
            assets={assets}
            slideH={slideH}
            showPageNumber={project.chrome?.pageNumbers !== false}
            showWordmark={project.chrome?.wordmark !== false}
            selectedElement={activeDragKey}
            onSelectElement={(key) => { setSelectedElement(key); if (isMobile) setSheetOpen(true) }}
            onDeselect={() => { setSelectedElement(null); setBgPanId(null) }}
            onElementPointerDown={onElementPointerDown}
            onResizePointerDown={onElementResizeStart}
            guides={dragGuides}
            onBandPointerDown={onBandPointerDown}
            onBgPointerDown={onBgPointerDown}
            onRequestBgPan={() => selected && setBgPanId(selected.id)}
            onToggleBgPan={toggleBgPan}
            onSetBgScale={setBgScale}
            bgPanning={bgPanning}
          />
        </section>

        {/* mobile-only: backdrop + handle for the inspector bottom sheet */}
        {isMobile && sheetOpen && (
          <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
        )}

        {/* ── editor ── */}
        <section className={`editor-pane${isMobile ? ' editor-pane--sheet' : ''}${isMobile && sheetOpen ? ' open' : ''}`}>
          {isMobile && (
            <div className="sheet-handle">
              <button className="ghost-btn sheet-close" onClick={() => setSheetOpen(false)}>
                done
              </button>
            </div>
          )}
          <Inspector
            selected={selected}
            activeElement={activeElement}
            project={project}
            theme={theme}
            custom={custom}
            setCustom={setCustom}
            setCustomBg={setCustomBg}
            autoColors={autoColors}
            setProjectColor={setProjectColor}
            setChrome={setChrome}
            assets={assets}
            builtinAssets={BUILTIN_ASSETS}
            userImages={userImages}
            missing={missing}
            dragging={dragging}
            setDragging={setDragging}
            storageFull={storageFull}
            addFiles={addFiles}
            removeAsset={removeAsset}
            clearUnusedImages={clearUnusedImages}
            patch={patch}
            updateSlide={updateSlide}
            setOverlay={setOverlay}
            layoutClip={layoutClip}
            resetLayout={resetLayout}
            copyLayout={copyLayout}
            pasteLayout={pasteLayout}
            applyLayoutToAll={applyLayoutToAll}
            bodyRef={bodyRef}
            removeElement={removeElement}
            setSize={setSize}
            setWidth={setWidth}
            setElementColor={setElementColor}
            setAlign={setAlign}
            setTextBg={setTextBg}
            wrapSelection={wrapSelection}
            onCloseElement={() => setSelectedElement(null)}
            addElement={addElement}
            selectElement={(key) => { setSelectedElement(key); if (isMobile) setSheetOpen(true) }}
          />
        </section>
      </main>

      <footer className="bottombar">
        <button className="ghost-btn" onClick={() => setShowDesigns(true)}>
          designs{designs.length ? ` (${designs.length})` : ''}
        </button>
        <button className="ghost-btn" onClick={() => setImporting(true)}>
          import outline
        </button>
        <button className="ghost-btn" onClick={newDesign} title="start a fresh carousel from a template">
          new carousel
        </button>
        <span className="bottombar-spacer" />
        <button
          className="ghost-btn"
          onClick={resetToOriginal}
          disabled={!canReset}
          title="discard changes and return to the last imported/saved version"
        >
          reset
        </button>
        <button className="ghost-btn" onClick={saveDesign} title={currentName ? `update “${currentName}”` : 'save to your designs'}>
          {savedFlash ? 'saved ✓' : currentName ? 'save' : 'save design'}
        </button>
      </footer>

      {/* mobile-only: open the inspector sheet */}
      {isMobile && !sheetOpen && (
        <button className="sheet-toggle" onClick={() => setSheetOpen(true)} aria-label="edit">
          edit ✎
        </button>
      )}

      {/* ── import overlay ── */}
      {/* ── save-before-new prompt ── */}
      {showNewPrompt && (
        <div className="overlay" onClick={() => setShowNewPrompt(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <label className="pane-label">start a new carousel?</label>
            <p className="type-about">
              this will replace the carousel you're working on with a fresh
              template. save your current work first?
            </p>
            <div className="overlay-actions">
              <button className="ghost-btn" onClick={() => setShowNewPrompt(false)}>
                cancel
              </button>
              <button className="ghost-btn" onClick={loadTemplate}>
                don't save
              </button>
              <button
                className="export-btn"
                onClick={() => {
                  saveDesign()
                  loadTemplate()
                }}
              >
                save &amp; new
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div className="overlay" onClick={() => setImporting(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <label className="pane-label">paste outline or design json</label>
            <p className="type-about">
              plain outline («Slide 1 — …» lines or blank-line paragraphs) builds
              hook → text → cta. or paste a generated design json (starts with
              {'{'}) to drop in a full carousel — theme, slide types, sizes and all.
            </p>
            <textarea
              autoFocus
              rows={14}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'why you sigh when you\'re stressed\nSlide 1 — Why you sigh when you\'re stressed.\nSlide 2 — When you\'re tense, your breathing goes shallow…'}
            />
            <div className="overlay-actions">
              <button className="ghost-btn" onClick={() => setImporting(false)}>
                cancel
              </button>
              <button
                className="ghost-btn"
                onClick={() => setImportText(JSON.stringify(projectToJSON(project), null, 2))}
                title="dump the current carousel as editable json"
              >
                load current as json
              </button>
              <button
                className="export-btn"
                disabled={!importText.trim()}
                onClick={runImport}
              >
                replace slides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── single-slide json editor ── */}
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
                <button
                  className="ghost-btn"
                  disabled={!slideJson.text.trim()}
                  onClick={applySlideReplace}
                >
                  replace this slide
                </button>
              )}
              <button
                className="export-btn"
                disabled={!slideJson.text.trim()}
                onClick={applySlideInsert}
              >
                insert after
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── designs library ── */}
      {showDesigns && (
        <div className="overlay" onClick={() => setShowDesigns(false)}>
          <div className="overlay-card designs-card" onClick={(e) => e.stopPropagation()}>
            <div className="designs-head">
              <label className="pane-label" style={{ margin: 0 }}>
                your designs
              </label>
              <div className="overlay-actions" style={{ margin: 0 }}>
                <button className="ghost-btn" onClick={newDesign}>
                  + new
                </button>
                <button className="export-btn" onClick={saveDesign}>
                  {currentName ? 'update current' : 'save current'}
                </button>
                {currentName && (
                  <button className="ghost-btn" onClick={saveAsNew}>
                    save as copy
                  </button>
                )}
              </div>
            </div>

            {designs.length === 0 ? (
              <p className="type-about">
                no saved designs yet. “save current” keeps this carousel so you can
                come back to it later.
              </p>
            ) : (
              <div className="design-list">
                {designs.map((d) => (
                  <div
                    key={d.id}
                    className={`design-row ${d.id === currentDesignId ? 'current' : ''}`}
                  >
                    <input
                      className="design-name"
                      value={d.name}
                      onChange={(e) => renameDesign(d.id, e.target.value)}
                    />
                    <span className="design-meta">
                      {d.project.slides.length} slides · {timeAgo(d.savedAt)}
                    </span>
                    <span className="design-actions">
                      <button onClick={() => loadDesign(d)}>open</button>
                      <button
                        onClick={() => {
                          const id = newSlide('text').id
                          setDesigns((list) => [
                            { id, name: d.name + ' (copy)', savedAt: Date.now(), project: cloneProject(d.project) },
                            ...list,
                          ])
                        }}
                      >
                        duplicate
                      </button>
                      <button
                        className="design-del"
                        onClick={() => {
                          if (confirm(`delete “${d.name}”?`)) deleteDesign(d.id)
                        }}
                      >
                        delete
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="overlay-actions">
              <button className="ghost-btn" onClick={() => setShowDesigns(false)}>
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
