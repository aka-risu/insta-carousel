// the structured content model behind the constructor

import { parseCarousel } from './parser'
import type { Theme } from './tokens'

export type SlideType = 'hook' | 'text' | 'fact' | 'quote' | 'diagram' | 'cta'

export type ElementKey =
  | 'stat'
  | 'text'
  | 'sub'
  | 'image'
  | 'annotations'
  | 'def'
  | 'attribution'

export interface SlideModel {
  id: string
  type: SlideType
  /** which elements this slide shows, in render order (user-editable, draggable) */
  elements: ElementKey[]
  text: string
  sub: string
  stat: string
  def: string
  attribution: string
  image: string // asset name
  annotations: string // one per line
  /** manual px size per element; missing key = use that element's auto size */
  sizes?: Partial<Record<ElementKey, number>>
  /** background-plate id for image-backed themes; undefined = cycle by position */
  background?: string
}

export interface Project {
  title: string
  themeId: string
  slides: SlideModel[]
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// canonical render + editor order
export const ELEMENT_ORDER: ElementKey[] = [
  'stat',
  'text',
  'sub',
  'image',
  'annotations',
  'def',
  'attribution',
]

export const SLIDE_TYPES: Record<SlideType, { name: string; about: string }> = {
  hook: { name: 'hook', about: 'the cover — one big line that earns the swipe' },
  text: { name: 'text', about: 'a plain thought — one idea per slide' },
  fact: { name: 'fact', about: 'a number or claim with supporting text' },
  quote: { name: 'quote', about: 'borrowed words, centered' },
  diagram: { name: 'diagram', about: 'an image plate with hand annotations' },
  cta: { name: 'cta', about: 'the closing slide — inverted colors, always' },
}

export const SLIDE_TYPE_ORDER: SlideType[] = ['hook', 'text', 'fact', 'quote', 'diagram', 'cta']

// elements a fresh slide of each type starts with
const DEFAULT_ELEMENTS: Record<SlideType, ElementKey[]> = {
  hook: ['text', 'sub'],
  text: ['text'],
  fact: ['stat', 'text', 'def'],
  quote: ['text', 'attribution'],
  diagram: ['image', 'annotations', 'text'],
  cta: ['text', 'sub'],
}

// every element any slide type may add
export const AVAILABLE_ELEMENTS: Record<SlideType, ElementKey[]> = {
  hook: ['stat', 'text', 'sub', 'image', 'def', 'attribution'],
  text: ['stat', 'text', 'sub', 'image', 'def', 'attribution'],
  fact: ['stat', 'text', 'sub', 'image', 'def', 'attribution'],
  quote: ['stat', 'text', 'sub', 'image', 'def', 'attribution'],
  diagram: ['image', 'annotations', 'text', 'sub', 'def', 'attribution'],
  cta: ['stat', 'text', 'sub', 'image', 'def', 'attribution'],
}

// ── element definitions (what to put where) ──────────────────

export interface ElementDef {
  label: string
  hint: string
  multiline?: boolean
  asset?: boolean
}

const ELEMENT_DEFS: Record<ElementKey, ElementDef> = {
  stat: { label: 'big figure', hint: 'e.g. −25% — rendered huge' },
  text: {
    label: 'body',
    hint: 'line breaks are kept. select words and use the marks below, or type *circle* _underline_ ==highlight==',
    multiline: true,
  },
  sub: { label: 'small line', hint: 'small mono line(s) under the body', multiline: true },
  image: { label: 'image', hint: 'pick from the asset drawer below', asset: true },
  annotations: {
    label: 'annotations',
    hint: 'one label per line — they alternate around the plate',
    multiline: true,
  },
  def: { label: 'margin note', hint: 'italic note with a side rule, e.g. a definition' },
  attribution: { label: 'attribution', hint: 'who said it. no dash needed' },
}

// per-type wording overrides so each editor still explains itself
const ELEMENT_OVERRIDES: Partial<
  Record<SlideType, Partial<Record<ElementKey, Partial<ElementDef>>>>
> = {
  hook: {
    text: { label: 'headline', hint: 'short and bold. line breaks are respected' },
    sub: { label: 'kicker', hint: 'mono line under the headline. empty = “keep reading →”' },
  },
  fact: {
    text: { label: 'body', hint: 'the explanation under the figure' },
  },
  quote: {
    text: { label: 'quote', hint: 'italic, centered' },
  },
  diagram: {
    text: { label: 'caption', hint: 'mono caption under the plate' },
  },
  cta: {
    text: { label: 'main line', hint: 'the ask' },
    sub: { label: 'sign-off', hint: 'small mono lines, e.g. antara freediving · koh tao' },
  },
}

export function elementDef(type: SlideType, key: ElementKey): ElementDef {
  return { ...ELEMENT_DEFS[key], ...ELEMENT_OVERRIDES[type]?.[key] }
}

// ── slide construction ───────────────────────────────────────

export function newSlide(type: SlideType): SlideModel {
  return {
    id: newId(),
    type,
    elements: [...DEFAULT_ELEMENTS[type]],
    text: '',
    sub: '',
    stat: '',
    def: '',
    attribution: '',
    image: '',
    annotations: '',
  }
}

/** build a slide ensuring every populated field is in `elements` */
export function slideOf(type: SlideType, fields: Partial<SlideModel>): SlideModel {
  const s = { ...newSlide(type), ...fields, id: newId(), type }
  s.elements = withPopulated(s)
  return s
}

function withPopulated(s: SlideModel): ElementKey[] {
  const set = new Set<ElementKey>(s.elements)
  for (const key of ELEMENT_ORDER) if (s[key] && key !== 'text') set.add(key)
  if (s.text) set.add('text')
  return ELEMENT_ORDER.filter((k) => set.has(k))
}

/** migration for projects saved before elements / unified sizes existed */
export function ensureElements(s: SlideModel): SlideModel {
  // fold legacy per-field sizes into the unified sizes map
  const legacy = s as SlideModel & { textSize?: number; statSize?: number }
  let sizes = s.sizes
  if (legacy.textSize != null || legacy.statSize != null) {
    sizes = {
      ...sizes,
      ...(legacy.textSize != null ? { text: legacy.textSize } : {}),
      ...(legacy.statSize != null ? { stat: legacy.statSize } : {}),
    }
  }
  const elements =
    Array.isArray(s.elements) && s.elements.length > 0
      ? s.elements.filter((k) => ELEMENT_ORDER.includes(k)) // keep user order
      : withPopulated({ ...s, elements: DEFAULT_ELEMENTS[s.type] })
  const { textSize: _t, statSize: _u, ...rest } = legacy
  void _t
  void _u
  return { ...rest, sizes, elements }
}

/** change a slide's type, refreshing defaults but keeping populated content */
export function retype(s: SlideModel, type: SlideType): SlideModel {
  const next = { ...s, type, elements: [...DEFAULT_ELEMENTS[type]] }
  next.elements = withPopulated(next)
  return next
}

// ── chrome micro-labels ──────────────────────────────────────

const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx']

export function roman(n: number): string {
  return ROMAN[n] ?? String(n)
}

// deterministic "entry number" derived from the title
export function entryNumber(title: string): number {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return (h % 89) + 11
}

export function microLabels(project: Project, theme: Theme): string[] {
  let sections = 0
  let diagrams = 0
  const no = entryNumber(project.title || 'untitled')
  return project.slides.map((s) => {
    switch (s.type) {
      case 'hook':
        return theme.labels.hook(no)
      case 'text':
      case 'fact':
        return theme.labels.section(roman(++sections))
      case 'diagram':
        return theme.labels.diagram(roman(++diagrams))
      case 'quote':
        return theme.labels.quote
      case 'cta':
        return theme.labels.cta
    }
  })
}

// ── auto-fit type scale ──────────────────────────────────────
// per-type [base, min] body sizes — single source for the renderer and the
// editor's size slider so the "auto" readout matches what's drawn
export const BODY_BASE: Record<SlideType, [number, number]> = {
  hook: [104, 56],
  text: [72, 46],
  fact: [58, 42],
  quote: [76, 50],
  diagram: [34, 28],
  cta: [100, 56],
}

export function autoBodySize(s: SlideModel): number {
  const [base, min] = BODY_BASE[s.type]
  return fitSize(s.text, base, min)
}

// the big-figure (stat) auto size, shared by renderer and editor slider
export const STAT_BASE: [number, number] = [260, 120]
export function autoStatSize(s: SlideModel): number {
  return fitSize(s.stat, STAT_BASE[0], STAT_BASE[1])
}

// default px for every element, by slide type — the size used when the user
// hasn't pinned one. text/stat auto-fit to length; the rest are fixed.
export function autoSize(s: SlideModel, key: ElementKey): number {
  switch (key) {
    case 'text':
      return autoBodySize(s)
    case 'stat':
      return autoStatSize(s)
    case 'sub':
      return s.type === 'cta' ? 40 : s.type === 'diagram' ? 30 : 38
    case 'def':
      return s.type === 'diagram' ? 38 : 44
    case 'attribution':
      return s.type === 'diagram' ? 30 : 36
    case 'annotations':
      return 50
    case 'image':
      return 0
  }
}

// the size to render an element at: manual override, else the auto default
export function sizeFor(s: SlideModel, key: ElementKey): number {
  return s.sizes?.[key] ?? autoSize(s, key)
}

// editor slider bounds per element
export const SIZE_RANGE: Record<ElementKey, { min: number; max: number; step: number }> = {
  text: { min: 28, max: 160, step: 2 },
  stat: { min: 80, max: 380, step: 4 },
  sub: { min: 18, max: 90, step: 2 },
  def: { min: 20, max: 90, step: 2 },
  attribution: { min: 16, max: 72, step: 2 },
  annotations: { min: 24, max: 96, step: 2 },
  image: { min: 0, max: 0, step: 1 },
}

// long text shrinks gracefully instead of overflowing the canvas
export function fitSize(text: string, base: number, min: number): number {
  const len = text.replace(/\s+/g, ' ').trim().length
  let size = base
  if (len > 60) size = base * 0.84
  if (len > 120) size = base * 0.7
  if (len > 220) size = base * 0.58
  if (len > 340) size = base * 0.5
  return Math.max(min, Math.round(size))
}

// ── outline import ───────────────────────────────────────────
// accepts the loose format:
//   why you sigh when you're stressed        ← title (before first marker)
//   Slide 1 — some text…
// or, with no "Slide N" markers, blank-line-separated paragraphs.
// first slide → hook, last → cta (when 3+), everything else → text.
export function importOutline(raw: string): { title: string; slides: SlideModel[] } {
  const markerRe = /^slide\s*\d+\s*[—–:.-]+\s*/i
  const lines = raw.split(/\r?\n/)
  const titleLines: string[] = []
  const chunks: string[][] = []
  let sawMarker = false

  for (const line of lines) {
    if (markerRe.test(line.trim())) {
      sawMarker = true
      chunks.push([line.trim().replace(markerRe, '')])
    } else if (!sawMarker) {
      if (line.trim()) titleLines.push(line.trim())
    } else if (chunks.length) {
      chunks[chunks.length - 1].push(line)
    }
  }

  let parts: string[]
  let title = titleLines.join(' ')
  if (sawMarker) {
    parts = chunks.map((c) => c.join('\n').trim()).filter(Boolean)
  } else {
    // no markers: paragraphs are slides; a lone short first paragraph is the title
    const paras = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    if (paras.length > 1 && !paras[0].includes('\n') && paras[0].length < 90) {
      title = paras[0]
      parts = paras.slice(1)
    } else {
      parts = paras
    }
  }

  const slides = parts.map((part, i) => {
    const isFirst = i === 0
    const isLast = i === parts.length - 1 && parts.length >= 3
    if (!isFirst && !isLast) return slideOf('text', { text: part })
    if (isFirst) return slideOf('hook', { text: part })

    // closing slide: a trailing "— brand" becomes the sign-off
    const ls = part.split('\n')
    const sub: string[] = []
    const main: string[] = []
    for (const l of ls) {
      if (/^[—–-]\s*\S/.test(l.trim())) sub.push(l.trim().replace(/^[—–-]\s*/, ''))
      else main.push(l)
    }
    if (sub.length === 0 && / — /.test(main.join(' '))) {
      const joined = main.join('\n')
      const idx = joined.lastIndexOf(' — ')
      return slideOf('cta', { text: joined.slice(0, idx).trim(), sub: joined.slice(idx + 3).trim() })
    }
    return slideOf('cta', { text: main.join('\n').trim(), sub: sub.join('\n') })
  })

  return { title, slides }
}

// ── legacy markdown migration ────────────────────────────────
export function fromLegacyMarkdown(md: string): Project {
  const doc = parseCarousel(md)
  const slides = doc.slides.map((old) => {
    const type: SlideType = old.archetype === 'fact' ? 'fact' : old.archetype
    const body = old.lines
      .filter((l) => l.kind === 'body')
      .map((l) => l.text)
      .join('\n')
    const fields: Partial<SlideModel> = {
      stat: old.lines.find((l) => l.kind === 'stat')?.text ?? '',
      def: old.lines.find((l) => l.kind === 'def')?.text ?? '',
      attribution: old.lines.find((l) => l.kind === 'attribution')?.text ?? '',
      image: old.lines.find((l) => l.kind === 'image')?.name ?? '',
      annotations: old.lines
        .filter((l) => l.kind === 'annotation')
        .map((l) => l.text)
        .join('\n'),
    }
    if (type === 'cta') {
      const [lead, ...rest] = body.split('\n')
      fields.text = lead ?? ''
      fields.sub = rest.filter(Boolean).join('\n')
    } else {
      fields.text = body
    }
    return slideOf(type, fields)
  })
  return { title: doc.title, themeId: 'journal', slides }
}

// ── plain-text outline for caption.txt ───────────────────────
export function projectToText(p: Project): string {
  const parts = p.slides.map((s, i) => {
    const bits = [
      s.stat,
      s.text,
      s.sub,
      s.def,
      s.attribution ? `— ${s.attribution}` : '',
      s.image ? `[image: ${s.image}]` : '',
      s.annotations,
    ].filter(Boolean)
    return `slide ${i + 1} (${s.type})\n${bits.join('\n')}`
  })
  return [p.title || 'untitled carousel', '', ...parts].join('\n\n')
}

export function referencedAssets(p: Project): string[] {
  return [
    ...new Set(
      p.slides
        .filter((s) => s.elements.includes('image'))
        .map((s) => s.image)
        .filter(Boolean),
    ),
  ]
}
