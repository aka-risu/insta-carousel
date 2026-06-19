import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  ElementKey,
  Project,
  SlideModel,
  SlideOverlay,
  SlideType,
  TextBacking,
} from './model'
import {
  AVAILABLE_ELEMENTS,
  DEFAULT_FREE_POS,
  SIZE_RANGE,
  SLIDE_TYPES,
  SLIDE_TYPE_ORDER,
  elementDef,
  ensureElements,
  fromLegacyMarkdown,
  importDesign,
  importOutline,
  microLabels,
  newSlide,
  referencedAssets,
  sizeFor,
} from './model'
import {
  THEMES,
  themeById,
  layout,
  buildCustomTheme,
  sampleTheme,
  DEFAULT_CUSTOM,
  applyColorOverrides,
} from './tokens'
import type { CustomThemeData, ColorOverrides } from './tokens'
import { Slide } from './slides/Slide'
import { exportCarousel } from './exporter'
import { CarouselPanel } from './editor/CarouselPanel'
import { SlidePanel } from './editor/SlidePanel'
import { ElementPanel } from './editor/ElementPanel'
import { SEED_PROJECT, templateProject } from './seed'
import sealPlateUrl from './assets/seal-plate.jpg'
import './App.css'

// example assets that ship with the app — always available, not removable
const BUILTIN_ASSETS: Record<string, string> = {
  'seal-plate.jpg': sealPlateUrl,
}

const PROJECT_KEY = 'antara-carousel-project' // the live working draft
const DESIGNS_KEY = 'antara-carousel-designs' // the saved library
const CURRENT_KEY = 'antara-carousel-current' // id of the loaded saved design
const CUSTOM_KEY = 'antara-carousel-custom' // the user's custom theme (image + colors)
const IMAGES_KEY = 'antara-carousel-images' // user-uploaded images, as data urls (persisted)
const LEGACY_KEY = 'antara-carousel-draft'
const PREVIEW_W = 340
const SCALE = PREVIEW_W / layout.slideW

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

export default function App() {
  const [project, setProject] = useState<Project>(loadProject)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadProject().slides[0]?.id ?? null,
  )
  // a copied free-layout (element positions) ready to paste onto another slide
  const [layoutClip, setLayoutClip] = useState<SlideModel['positions'] | null>(null)
  // which element on the selected slide is highlighted (synced between the
  // editor cards and the slide previews). null = whole slide, no element.
  const [selectedElement, setSelectedElement] = useState<ElementKey | null>(null)
  const [userImages, setUserImages] = useState<Record<string, string>>(loadImages)
  const [storageFull, setStorageFull] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [designs, setDesigns] = useState<SavedDesign[]>(loadDesigns)
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_KEY),
  )
  const [showDesigns, setShowDesigns] = useState(false)
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [custom, setCustom] = useState<CustomThemeData>(loadCustom)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project))
  }, [project])

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

  const selected = project.slides.find((s) => s.id === selectedId) ?? null

  // the highlighted element only counts while it still lives on the selected
  // slide — so switching slides clears a stale highlight automatically
  const activeElement =
    selected && selectedElement && selected.elements.includes(selectedElement)
      ? selectedElement
      : null

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
    key: ElementKey
    startX: number
    startY: number
    seed: NonNullable<SlideModel['positions']>
    origX: number
    origY: number
    moved: boolean
    scale: number
  } | null>(null)

  const onElementPointerDown = useCallback(
    (e: ReactPointerEvent, key: ElementKey) => {
      const slide = selected
      if (!slide || slide.type === 'diagram') return
      const wrapper = e.currentTarget as HTMLElement
      const canvas = wrapper.closest('[data-slide-canvas]') as HTMLElement | null
      const root = wrapper.closest('[data-content-root]') as HTMLElement | null
      if (!canvas || !root) return
      const rootRect = root.getBoundingClientRect()
      // the slide may render at any size (small filmstrip thumb or big canvas);
      // derive the live scale from the rendered width instead of a fixed constant
      const scale = canvas.getBoundingClientRect().width / layout.slideW

      // seed every element: keep any already-pinned positions, measure the rest
      // from their current on-screen spot (divided back out of the preview scale)
      const seed: NonNullable<SlideModel['positions']> = { ...(slide.free ? slide.positions : {}) }
      canvas.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => {
        const k = el.dataset.el as ElementKey
        if (seed[k]) return
        const r = el.getBoundingClientRect()
        seed[k] = {
          x: Math.round((r.left - rootRect.left) / scale),
          y: Math.round((r.top - rootRect.top) / scale),
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
        updateSlide(d.id, {
          free: true,
          positions: {
            ...d.seed,
            [d.key]: {
              x: Math.round(d.origX + dxPx / d.scale),
              y: Math.round(d.origY + dyPx / d.scale),
            },
          },
        })
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [selected, updateSlide],
  )

  // dragging the corner handle scales the element's font size. the ratio of the
  // pointer's distance from the (anchored) top-left corner drives the new size,
  // clamped to the element's slider range — so resize and the slider stay in sync.
  const onElementResizeStart = useCallback(
    (e: ReactPointerEvent, key: ElementKey) => {
      const slide = selected
      if (!slide || key === 'image') return
      const wrapper = (e.currentTarget as HTMLElement).closest('[data-el]') as HTMLElement | null
      if (!wrapper) return
      const rect = wrapper.getBoundingClientRect()
      const origSize = sizeFor(slide, key)
      const startDist = Math.hypot(e.clientX - rect.left, e.clientY - rect.top) || 1
      const range = SIZE_RANGE[key]
      setSelectedElement(key)

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault()
        const dist = Math.hypot(ev.clientX - rect.left, ev.clientY - rect.top)
        const next = Math.round(origSize * (dist / startDist))
        setSize(slide.id, key, Math.max(range.min, Math.min(range.max, next)))
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

  // ── assets ─────────────────────────────────────────────────
  // read uploads as data urls (persisted), then report the names added so a
  // caller (e.g. the slide-background picker) can assign the freshly added image.
  const addFiles = useCallback(
    async (files: FileList | File[], onAdded?: (names: string[]) => void) => {
      const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
      const entries = await Promise.all(
        images.map(async (f) => [f.name, await fileToDataUrl(f)] as const),
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
    setProject((p) => ({ ...p, title: title || p.title, slides }))
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
        <button className="ghost-btn" onClick={() => setShowDesigns(true)}>
          designs{designs.length ? ` (${designs.length})` : ''}
        </button>
        <button className="ghost-btn" onClick={() => setImporting(true)}>
          import outline
        </button>
        <button className="ghost-btn" onClick={newDesign} title="start a fresh carousel from a template">
          new carousel
        </button>
        <button className="ghost-btn" onClick={saveDesign} title={currentName ? `update “${currentName}”` : 'save to your designs'}>
          {savedFlash ? 'saved ✓' : currentName ? 'save' : 'save design'}
        </button>
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
          <label className="pane-label">slides</label>
          <div className="slide-list">
            {project.slides.map((s, i) => (
              <div
                key={s.id}
                className={`slide-row ${s.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="slide-row-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="slide-row-type">{SLIDE_TYPES[s.type].name}</span>
                <span className="slide-row-peek">
                  {(s.text || s.stat || s.image || '…').split('\n')[0]}
                </span>
                <span className="slide-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button title="move up" disabled={i === 0} onClick={() => moveSlide(s.id, -1)}>↑</button>
                  <button title="move down" disabled={i === project.slides.length - 1} onClick={() => moveSlide(s.id, 1)}>↓</button>
                  <button title="duplicate" onClick={() => duplicateSlide(s.id)}>⧉</button>
                  <button title="delete" onClick={() => removeSlide(s.id)}>×</button>
                </span>
              </div>
            ))}
          </div>

          <label className="pane-label">add slide</label>
          <div className="add-row">
            {SLIDE_TYPE_ORDER.map((t) => (
              <button key={t} className="add-chip" onClick={() => addSlide(t)} title={SLIDE_TYPES[t].about}>
                + {t}
              </button>
            ))}
          </div>
        </section>

        {/* ── editor ── */}
        <section className="editor-pane">
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
          {selected ? (
            <>
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
                  <SlidePanel
                    slide={selected}
                    theme={theme}
                    assets={assets}
                    patch={patch}
                    updateSlide={updateSlide}
                    setOverlay={setOverlay}
                    addFiles={addFiles}
                  />

                  {selected.type !== 'diagram' && (
                    <div className="field">
                      <span className="field-label">layout</span>
                      <div className="size-row">
                        <button
                          className={`size-auto ${!selected.free ? 'on' : ''}`}
                          onClick={() => resetLayout(selected.id)}
                          title="auto-stack the elements (clears free positions)"
                        >
                          auto
                        </button>
                        <button
                          className="mark-btn"
                          onClick={copyLayout}
                          disabled={!selected.free}
                          title="copy this slide's element positions"
                        >
                          copy
                        </button>
                        <button
                          className="mark-btn"
                          onClick={() => pasteLayout(selected.id)}
                          disabled={!layoutClip}
                          title="paste the copied positions onto this slide"
                        >
                          paste
                        </button>
                        <button
                          className="mark-btn"
                          onClick={applyLayoutToAll}
                          disabled={!selected.free}
                          title="apply this slide's layout to every other slide"
                        >
                          apply to all
                        </button>
                      </div>
                      <span className="field-hint">
                        drag any element on the slide preview to place it freely. "auto" returns to
                        automatic stacking.
                      </span>
                    </div>
                  )}

                  {AVAILABLE_ELEMENTS[selected.type].filter((k) => !selected.elements.includes(k))
                    .length > 0 && (
                    <div className="field">
                      <span className="field-label">add element</span>
                      <div className="add-row">
                        {AVAILABLE_ELEMENTS[selected.type]
                          .filter((k) => !selected.elements.includes(k))
                          .map((k) => (
                            <button
                              key={k}
                              className="add-chip"
                              title={elementDef(selected.type, k).hint}
                              onClick={() => addElement(selected.id, k)}
                            >
                              + {elementDef(selected.type, k).label}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="empty-note">add a slide to start</p>
          )}

        </section>

        {/* ── previews ── */}
        <section className="preview-pane">
          {project.slides.length === 0 && (
            <p className="empty-note">no slides yet — add one on the left</p>
          )}
          <div className="preview-grid">
            {project.slides.map((slide, i) => (
              <figure
                key={slide.id}
                className={`preview-card ${slide.id === selectedId ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedId(slide.id)
                  setSelectedElement(null)
                }}
              >
                <div
                  className="preview-frame"
                  style={{ width: PREVIEW_W, height: Math.round(layout.slideH * SCALE) }}
                >
                  {/* full-size slide, scaled down — same component as export */}
                  <div
                    data-slide-canvas
                    style={{
                      width: layout.slideW,
                      height: layout.slideH,
                      transform: `scale(${SCALE})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <Slide
                      slide={slide}
                      microLabel={labels[i]}
                      index={i}
                      total={project.slides.length}
                      theme={theme}
                      assets={assets}
                      selectedElement={slide.id === selectedId ? activeElement : null}
                      onSelectElement={(key) => {
                        setSelectedId(slide.id)
                        setSelectedElement(key)
                      }}
                      // drag-to-position / resize are wired only for the selected slide
                      onElementPointerDown={
                        slide.id === selectedId ? onElementPointerDown : undefined
                      }
                      onResizePointerDown={
                        slide.id === selectedId ? onElementResizeStart : undefined
                      }
                    />
                  </div>
                </div>
                <figcaption>
                  {String(i + 1).padStart(2, '0')} · {slide.type}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>

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
