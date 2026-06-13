import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ElementKey, Project, SlideModel, SlideType } from './model'
import {
  AVAILABLE_ELEMENTS,
  SIZE_RANGE,
  SLIDE_TYPES,
  SLIDE_TYPE_ORDER,
  autoSize,
  elementDef,
  ensureElements,
  fromLegacyMarkdown,
  importDesign,
  importOutline,
  microLabels,
  newSlide,
  referencedAssets,
  retype,
} from './model'
import { THEMES, themeById, layout, buildCustomTheme, sampleTheme, DEFAULT_CUSTOM } from './tokens'
import type { CustomThemeData } from './tokens'
import { Slide } from './slides/Slide'
import { exportCarousel } from './exporter'
import { SEED_PROJECT } from './seed'
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
const LEGACY_KEY = 'antara-carousel-draft'
const PREVIEW_W = 340
const SCALE = PREVIEW_W / layout.slideW

// every element except the image plate gets a manual size slider
const hasSizeControl = (k: ElementKey): boolean => k !== 'image'

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
  const [assets, setAssets] = useState<Record<string, string>>(BUILTIN_ASSETS)
  const [dragging, setDragging] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [dragEl, setDragEl] = useState<{ id: string; idx: number } | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [designs, setDesigns] = useState<SavedDesign[]>(loadDesigns)
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_KEY),
  )
  const [showDesigns, setShowDesigns] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [custom, setCustom] = useState<CustomThemeData>(loadCustom)
  const fileInput = useRef<HTMLInputElement>(null)
  const customBgInput = useRef<HTMLInputElement>(null)
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

  const theme = useMemo(
    () => (project.themeId === 'custom' ? buildCustomTheme(custom) : themeById(project.themeId)),
    [project.themeId, custom],
  )
  const labels = useMemo(() => microLabels(project, theme), [project, theme])
  const refs = useMemo(() => referencedAssets(project), [project])
  const missing = refs.filter((name) => !assets[name])

  const selected = project.slides.find((s) => s.id === selectedId) ?? null

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

  // drag-reorder an element within a slide's stack
  const moveElement = useCallback(
    (id: string, from: number, to: number) =>
      patch((p) => ({
        ...p,
        slides: p.slides.map((s) => {
          if (s.id !== id || from === to || to < 0 || to >= s.elements.length) return s
          const elements = [...s.elements]
          const [moved] = elements.splice(from, 1)
          elements.splice(to, 0, moved)
          return { ...s, elements }
        }),
      })),
    [patch],
  )

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
  const addFiles = useCallback((files: FileList | File[]) => {
    setAssets((prev) => {
      const next = { ...prev }
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        if (next[file.name]) URL.revokeObjectURL(next[file.name])
        next[file.name] = URL.createObjectURL(file)
      }
      return next
    })
  }, [])

  const removeAsset = useCallback((name: string) => {
    setAssets((prev) => {
      const next = { ...prev }
      URL.revokeObjectURL(next[name])
      delete next[name]
      return next
    })
  }, [])

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

  const newDesign = useCallback(() => {
    const blank: Project = {
      title: '',
      themeId: project.themeId,
      slides: [newSlide('hook')],
    }
    setProject(blank)
    setSelectedId(blank.slides[0].id)
    setCurrentDesignId(null)
    setShowDesigns(false)
  }, [project.themeId])

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
          {project.themeId === 'custom' && (
            <div className="custom-theme">
              <label className="pane-label">custom theme</label>
              <div
                className="asset-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files[0]) setCustomBg(e.dataTransfer.files[0])
                }}
                onClick={() => customBgInput.current?.click()}
              >
                {custom.bg ? 'drop a new background, or click to replace' : 'drop a background image, or click to pick'}
                <input
                  ref={customBgInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) setCustomBg(e.target.files[0])
                    e.target.value = ''
                  }}
                />
              </div>

              {custom.bg && (
                <div className="custom-bg-row">
                  <img className="custom-bg-preview" src={custom.bg} alt="custom background" />
                  <button className="ghost-btn" onClick={autoColors}>
                    auto colors from image
                  </button>
                  <button className="ghost-btn" onClick={() => setCustom((c) => ({ ...c, bg: '' }))}>
                    remove image
                  </button>
                </div>
              )}

              <div className="color-rows">
                {([
                  ['fg', 'text'],
                  ['dim', 'secondary'],
                  ['accent', 'accent'],
                  ['paper', 'paper'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="color-row">
                    <input
                      type="color"
                      value={custom[key]}
                      onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
                    />
                    <span>{label}</span>
                    <code>{custom[key]}</code>
                  </label>
                ))}
              </div>
              <span className="field-hint">
                upload an image and colors auto-fill for contrast — nudge any of them. with no image,
                this is just a colored paper theme. saved across reloads.
              </span>
            </div>
          )}
          {selected ? (
            <>
              <label className="pane-label">
                editing · {SLIDE_TYPES[selected.type].name}
              </label>
              <p className="type-about">{SLIDE_TYPES[selected.type].about}</p>

              <div className="field">
                <span className="field-label">slide type</span>
                <select
                  value={selected.type}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      slides: p.slides.map((s) =>
                        s.id === selected.id ? retype(s, e.target.value as SlideType) : s,
                      ),
                    }))
                  }
                >
                  {SLIDE_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {t} — {SLIDE_TYPES[t].about}
                    </option>
                  ))}
                </select>
              </div>

              {theme.backgrounds && (
                <div className="field">
                  <span className="field-label">background plate</span>
                  <select
                    value={selected.background ?? ''}
                    onChange={(e) =>
                      updateSlide(selected.id, { background: e.target.value || undefined })
                    }
                  >
                    <option value="">auto (by position)</option>
                    {theme.backgrounds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    each slide cycles through the chart plates unless you pin one here
                  </span>
                </div>
              )}

              <span className="field-hint drag-hint">drag the ⠿ handle to reorder elements on the slide</span>
              {selected.elements.map((key, idx) => {
                const def = elementDef(selected.type, key)
                return (
                  <div
                    className={`field draggable ${dragEl?.id === selected.id && dragEl.idx === idx ? 'dragging-el' : ''} ${dragOverIdx === idx ? 'drag-over' : ''}`}
                    key={key}
                    // only the handle starts a drag; the card is just the drop target,
                    // so the slider / textarea inside stay fully interactive
                    onDragOver={(e) => {
                      if (!dragEl) return
                      e.preventDefault()
                      setDragOverIdx(idx)
                    }}
                    onDrop={() => {
                      if (dragEl && dragEl.id === selected.id) moveElement(selected.id, dragEl.idx, idx)
                      setDragEl(null)
                      setDragOverIdx(null)
                    }}
                  >
                    <span className="field-label">
                      <span
                        className="drag-handle"
                        title="drag to reorder"
                        draggable
                        onDragStart={() => setDragEl({ id: selected.id, idx })}
                        onDragEnd={() => {
                          setDragEl(null)
                          setDragOverIdx(null)
                        }}
                      >
                        ⠿
                      </span>
                      {def.label}
                      <button
                        className="field-remove"
                        title={`remove ${def.label} from this slide`}
                        onClick={() => removeElement(selected.id, key)}
                      >
                        ×
                      </button>
                    </span>
                    {def.asset ? (
                      <select
                        value={selected[key]}
                        onChange={(e) => updateSlide(selected.id, { [key]: e.target.value })}
                      >
                        <option value="">( none )</option>
                        {Object.keys(assets).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        {selected[key] && !assets[selected[key]] && (
                          <option value={selected[key]}>⚠ {selected[key]} (missing)</option>
                        )}
                      </select>
                    ) : def.multiline ? (
                      <textarea
                        ref={key === 'text' ? bodyRef : undefined}
                        rows={3}
                        value={selected[key]}
                        onChange={(e) => updateSlide(selected.id, { [key]: e.target.value })}
                      />
                    ) : (
                      <input
                        value={selected[key]}
                        onChange={(e) => updateSlide(selected.id, { [key]: e.target.value })}
                      />
                    )}
                    <span className="field-hint">{def.hint}</span>

                    {/* emphasis marks — select a word in the body, then click */}
                    {key === 'text' && (
                      <div className="marks-row">
                        <span className="size-label">mark selection</span>
                        <button className="mark-btn" title="pen circle around the selected words" onClick={() => wrapSelection('*', '*')}>
                          ◯ circle
                        </button>
                        <button className="mark-btn" title="underline the selected words" onClick={() => wrapSelection('_', '_')}>
                          <u>underline</u>
                        </button>
                        <button className="mark-btn" title="highlighter over the selected words" onClick={() => wrapSelection('==', '==')}>
                          <span className="mark-hl">highlight</span>
                        </button>
                      </div>
                    )}

                    {/* manual size control — available on every text element */}
                    {hasSizeControl(key) &&
                      (() => {
                        const range = SIZE_RANGE[key]
                        const current = selected.sizes?.[key] ?? autoSize(selected, key)
                        const isAuto = selected.sizes?.[key] == null
                        return (
                          <div className="size-row">
                            <span className="size-label">size</span>
                            <button
                              className={`size-auto ${isAuto ? 'on' : ''}`}
                              onClick={() => setSize(selected.id, key, undefined)}
                              title="automatic size"
                            >
                              auto
                            </button>
                            <input
                              type="range"
                              min={range.min}
                              max={range.max}
                              step={range.step}
                              value={current}
                              onChange={(e) => setSize(selected.id, key, Number(e.target.value))}
                            />
                            <span className="size-val">{current}px</span>
                          </div>
                        )
                      })()}
                  </div>
                )
              })}

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
          ) : (
            <p className="empty-note">add a slide to start</p>
          )}

          <label className="pane-label">assets</label>
          <div
            className={`asset-drop ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInput.current?.click()}
          >
            drop images here, or click to pick
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {(Object.keys(assets).length > 0 || missing.length > 0) && (
            <div className="asset-chips">
              {Object.entries(assets).map(([name, url]) => (
                <span key={name} className="chip" title={name}>
                  <img src={url} alt="" />
                  {name}
                  {!BUILTIN_ASSETS[name] && (
                    <button className="chip-x" onClick={() => removeAsset(name)} aria-label={`remove ${name}`}>
                      ×
                    </button>
                  )}
                </span>
              ))}
              {missing.map((name) => (
                <span key={name} className="chip chip-missing" title={`${name} not uploaded`}>
                  ⚠ {name}
                </span>
              ))}
            </div>
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
                onClick={() => setSelectedId(slide.id)}
              >
                <div
                  className="preview-frame"
                  style={{ width: PREVIEW_W, height: Math.round(layout.slideH * SCALE) }}
                >
                  {/* full-size slide, scaled down — same component as export */}
                  <div
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
