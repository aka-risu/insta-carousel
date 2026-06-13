// small custom parser for the carousel markdown content model.
// deliberately not a generic markdown renderer — line breaks are intentional,
// this is a poet's tool.

export type Archetype = 'hook' | 'fact' | 'diagram' | 'quote' | 'cta'

export type SlideLine =
  | { kind: 'body'; text: string }
  | { kind: 'stat'; text: string }
  | { kind: 'def'; text: string }
  | { kind: 'image'; name: string }
  | { kind: 'annotation'; text: string }
  | { kind: 'attribution'; text: string }

export interface SlideData {
  archetype: Archetype
  /** the raw heading text, in case it differs from a known archetype */
  rawType: string
  lines: SlideLine[]
  /** mono micro-label for the chrome layer, e.g. `observation ii` */
  microLabel: string
}

export interface CarouselDoc {
  title: string
  slides: SlideData[]
}

const KNOWN_ARCHETYPES: Archetype[] = ['hook', 'fact', 'diagram', 'quote', 'cta']

const ROMAN = [
  '', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
]

function roman(n: number): string {
  return ROMAN[n] ?? String(n)
}

// deterministic "entry number" for the hook label, derived from the title
function entryNumber(title: string): number {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return (h % 89) + 11 // 11..99, feels like a real journal
}

export function parseCarousel(md: string): CarouselDoc {
  const doc: CarouselDoc = { title: '', slides: [] }
  let current: SlideData | null = null

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (trimmed.startsWith('## ')) {
      const rawType = trimmed.slice(3).trim().toLowerCase()
      const archetype = (KNOWN_ARCHETYPES as string[]).includes(rawType)
        ? (rawType as Archetype)
        : 'fact' // unknown archetypes degrade gracefully to the fact layout
      current = { archetype, rawType, lines: [], microLabel: '' }
      doc.slides.push(current)
      continue
    }

    if (trimmed.startsWith('# ')) {
      if (!doc.title) doc.title = trimmed.slice(2).trim()
      continue
    }

    if (!current) continue // prose before the first slide is ignored

    if (trimmed.toLowerCase().startsWith('stat:')) {
      current.lines.push({ kind: 'stat', text: trimmed.slice(5).trim() })
    } else if (trimmed.toLowerCase().startsWith('def:')) {
      current.lines.push({ kind: 'def', text: trimmed.slice(4).trim() })
    } else if (trimmed.startsWith('@')) {
      current.lines.push({ kind: 'image', name: trimmed.slice(1).trim() })
    } else if (trimmed.startsWith('~')) {
      current.lines.push({ kind: 'annotation', text: trimmed.slice(1).trim() })
    } else if (trimmed.startsWith('—') && current.archetype === 'quote') {
      current.lines.push({ kind: 'attribution', text: trimmed.slice(1).trim() })
    } else {
      // body text — keep empty lines so paragraph breaks survive
      current.lines.push({ kind: 'body', text: line.trimStart() })
    }
  }

  // trim leading/trailing blank body lines per slide
  for (const slide of doc.slides) {
    while (slide.lines.length && isBlankBody(slide.lines[0])) slide.lines.shift()
    while (slide.lines.length && isBlankBody(slide.lines[slide.lines.length - 1]))
      slide.lines.pop()
  }

  assignMicroLabels(doc)
  return doc
}

function isBlankBody(l: SlideLine): boolean {
  return l.kind === 'body' && l.text === ''
}

function assignMicroLabels(doc: CarouselDoc) {
  let facts = 0
  let plates = 0
  const no = entryNumber(doc.title || 'untitled')
  for (const slide of doc.slides) {
    switch (slide.archetype) {
      case 'hook':
        slide.microLabel = `field notes · no. ${no}`
        break
      case 'fact':
        facts += 1
        slide.microLabel = `observation ${roman(facts)}`
        break
      case 'diagram':
        plates += 1
        slide.microLabel = `plate ${roman(plates)}`
        break
      case 'quote':
        slide.microLabel = 'marginalia'
        break
      case 'cta':
        slide.microLabel = 'end of entry'
        break
    }
  }
}

/** joined body text of a slide, line breaks preserved */
export function bodyText(slide: SlideData): string {
  return slide.lines
    .filter((l): l is Extract<SlideLine, { kind: 'body' }> => l.kind === 'body')
    .map((l) => l.text)
    .join('\n')
}

export function linesOf<K extends SlideLine['kind']>(
  slide: SlideData,
  kind: K,
): Extract<SlideLine, { kind: K }>[] {
  return slide.lines.filter((l) => l.kind === kind) as Extract<SlideLine, { kind: K }>[]
}

/** every `@asset` name referenced anywhere in the doc */
export function referencedAssets(doc: CarouselDoc): string[] {
  const names = new Set<string>()
  for (const slide of doc.slides)
    for (const line of slide.lines) if (line.kind === 'image') names.add(line.name)
  return [...names]
}
