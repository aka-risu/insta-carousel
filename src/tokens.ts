// design tokens + themes — single source of truth

import chart1 from './assets/backgrounds/chart1.jpg'
import chart2 from './assets/backgrounds/chart2.jpg'
import chart3 from './assets/backgrounds/chart3.jpg'
import chart4 from './assets/backgrounds/chart4.jpg'
import chart5 from './assets/backgrounds/chart5.jpg'
import parch1 from './assets/backgrounds/parch1.png'
import parch2 from './assets/backgrounds/parch2.png'
import parch3 from './assets/backgrounds/parch3.png'
import parch4 from './assets/backgrounds/parch4.png'
import parch5 from './assets/backgrounds/parch5.png'
import parch6 from './assets/backgrounds/parch6.png'
import tide1 from './assets/backgrounds/tide1.png'

export const layout = {
  slideW: 1080,
  slideH: 1350,
  frame: 72, // inner padding of every slide
  microSize: 36,
  microTracking: '0.22em',
  footerSize: 42,
} as const

// output aspect ratio — width is always 1080, only the height changes, so
// horizontal layout, padding and free-element x positions are ratio-agnostic.
export type Ratio = '1:1' | '4:5' | '9:16'
export const RATIOS: { id: Ratio; label: string; h: number }[] = [
  { id: '1:1', label: 'square · 1:1', h: 1080 },
  { id: '4:5', label: 'portrait · 4:5', h: 1350 },
  { id: '9:16', label: 'stories · 9:16', h: 1920 },
]
export const DEFAULT_RATIO: Ratio = '4:5'
export function slideHeightFor(ratio?: Ratio): number {
  return RATIOS.find((r) => r.id === ratio)?.h ?? layout.slideH
}

export const fonts = {
  serif: `'EB Garamond', 'Iowan Old Style', Georgia, serif`,
  mono: `'IBM Plex Mono', 'SF Mono', Menlo, monospace`,
  sans: `'Archivo', 'Helvetica Neue', Arial, sans-serif`,
  display: `'Archivo Black', 'Archivo', 'Helvetica Neue', Arial, sans-serif`,
} as const

// kept for backwards compatibility with the app chrome css variables
export const tokens = {
  cream: '#F4EEDD',
  ink: '#2E2A1F',
  faded: '#8A7C5C',
  accent: '#B9A87C',
  serif: fonts.serif,
  mono: fonts.mono,
  ...layout,
} as const

// ── paper grain ──────────────────────────────────────────────
// tileable texture as a base64 png — no network requests, ever.
// generated via canvas, not an svg filter: html-to-image's foreignObject
// rasterization drops svg <filter> effects (renders solid black instead).
function makeGrain(r: number, g: number, b: number, maxAlpha: number): string {
  const size = 280
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  // deterministic lcg so every render (and every export) is identical
  let seed = 0x5eed
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32)
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r
    img.data[i + 1] = g
    img.data[i + 2] = b
    img.data[i + 3] = Math.round(rand() * rand() * maxAlpha * 255)
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

// ── themes ───────────────────────────────────────────────────

export interface Palette {
  bg: string
  fg: string
  dim: string // secondary text, chrome
  accent: string // rules, highlights
  texture: string // css background-image value
  mat: string // mount color behind image plates
}

// palette tokens a text-plate / overlay color may reference, so swatches track
// the live theme instead of baking in a fixed hex
const PALETTE_TOKENS: Record<string, keyof Palette> = {
  paper: 'bg',
  fg: 'fg',
  dim: 'dim',
  accent: 'accent',
}

// turn a stored color (hex or palette token) + optional opacity into a css color.
// hex (#rgb / #rrggbb) gets an alpha appended; tokens resolve against the palette.
export function resolveColor(color: string, p: Palette, opacity = 1): string {
  const base = PALETTE_TOKENS[color] ? p[PALETTE_TOKENS[color]] : color
  if (opacity >= 1) return base
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(base)
  if (!m) return base
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`
}

// a full-bleed background plate (vintage sea chart) for image-backed themes
export interface ChartBg {
  id: string
  name: string
  url: string
}

// the typographic system a theme renders in. 'editorial' is the original
// serif/mono field-journal lineage; 'bold' is the high-impact uppercase sans
// look (black canvas, mint accent, boxed eyebrow). undefined ⇒ 'editorial'.
export type ThemeStyle = 'editorial' | 'bold'

export interface Theme {
  id: string
  name: string
  /** typographic system; undefined ⇒ 'editorial' (every original theme) */
  style?: ThemeStyle
  base: Palette
  inverted: Palette // the cta slide uses this
  /** full-bleed background plates; slides cycle through them unless overridden */
  backgrounds?: ChartBg[]
  labels: {
    hook: (no: number) => string
    section: (numeral: string) => string // text + fact slides
    diagram: (numeral: string) => string
    quote: string
    cta: string
  }
}

export const THEMES: Theme[] = [
  {
    id: 'journal',
    name: 'field journal',
    base: {
      bg: '#F4EEDD',
      fg: '#2E2A1F',
      dim: '#8A7C5C',
      accent: '#B9A87C',
      texture: `url("${makeGrain(107, 92, 56, 0.16)}")`,
      mat: '#FCF9F0',
    },
    inverted: {
      bg: '#2E2A1F',
      fg: '#F4EEDD',
      dim: '#B9A87C',
      accent: '#B9A87C',
      texture: `url("${makeGrain(245, 237, 217, 0.12)}")`,
      mat: '#FCF9F0',
    },
    labels: {
      hook: (no) => `field notes · no. ${no}`,
      section: (n) => `observation ${n}`,
      diagram: (n) => `plate ${n}`,
      quote: 'marginalia',
      cta: 'end of entry',
    },
  },
  {
    id: 'openwater',
    name: 'open water',
    base: {
      bg: '#EAF1EE',
      fg: '#143540',
      dim: '#54767E',
      accent: '#2E8C96',
      texture: `url("${makeGrain(20, 53, 64, 0.08)}")`,
      mat: '#FBFDFC',
    },
    inverted: {
      bg: '#143540',
      fg: '#EAF1EE',
      dim: '#7FA6AD',
      accent: '#3FB9C9',
      texture: `url("${makeGrain(234, 241, 238, 0.09)}")`,
      mat: '#FBFDFC',
    },
    labels: {
      hook: (no) => `dive log · no. ${no}`,
      section: (n) => `descent ${n}`,
      diagram: (n) => `figure ${n}`,
      quote: 'from the log',
      cta: 'back to surface',
    },
  },
  {
    id: 'linen',
    name: 'linen',
    base: {
      bg: '#FAF8F2',
      fg: '#23211C',
      dim: '#A39C8B',
      accent: '#B5482A',
      texture: `url("${makeGrain(35, 33, 28, 0.05)}")`,
      mat: '#FFFFFF',
    },
    inverted: {
      bg: '#23211C',
      fg: '#FAF8F2',
      dim: '#A39C8B',
      accent: '#C8896B',
      texture: `url("${makeGrain(250, 248, 242, 0.07)}")`,
      mat: '#FFFFFF',
    },
    labels: {
      hook: (no) => `notes · no. ${no}`,
      section: (n) => `${n}.`,
      diagram: (n) => `fig. ${n}`,
      quote: 'aside',
      cta: 'the end',
    },
  },
  {
    id: 'seachart',
    name: 'sea chart',
    // full-bleed antique chart plates; text sits in the clear centers. the
    // image carries the texture, so the grain layer stays empty here.
    base: {
      bg: '#E8DEC4',
      fg: '#3B2F19',
      dim: '#80693B',
      accent: '#6E5733',
      texture: 'none',
      mat: '#F2EAD6',
    },
    inverted: {
      bg: '#E8DEC4',
      fg: '#3B2F19',
      dim: '#80693B',
      accent: '#6E5733',
      texture: 'none',
      mat: '#F2EAD6',
    },
    backgrounds: [
      { id: 'chart1', name: 'specimen survey', url: chart1 },
      { id: 'chart2', name: 'naturalist plate', url: chart2 },
      { id: 'chart3', name: 'seahorse & nautilus', url: chart3 },
      { id: 'chart4', name: 'green turtle survey', url: chart4 },
      { id: 'chart5', name: 'moon jelly chart', url: chart5 },
    ],
    labels: {
      hook: (no) => `chart · no. ${no}`,
      section: (n) => `fig. ${n}`,
      diagram: (n) => `plate ${n}`,
      quote: 'marginalia',
      cta: 'fair winds',
    },
  },
  {
    id: 'parchment',
    name: 'weathered parchment',
    // soft aged-paper plates: faint imagery at the edges, clear centers — the
    // background stays out of the text's way.
    base: {
      bg: '#E7DAC0',
      fg: '#40331C',
      dim: '#85714A',
      accent: '#7A5E33',
      texture: 'none',
      mat: '#F3ECDA',
    },
    inverted: {
      bg: '#E7DAC0',
      fg: '#40331C',
      dim: '#85714A',
      accent: '#7A5E33',
      texture: 'none',
      mat: '#F3ECDA',
    },
    backgrounds: [
      { id: 'parch1', name: 'parchment i' },
      { id: 'parch2', name: 'parchment ii' },
      { id: 'parch3', name: 'parchment iii' },
      { id: 'parch4', name: 'parchment iv' },
      { id: 'parch5', name: 'parchment v' },
      { id: 'parch6', name: 'parchment vi' },
    ].map((b, i) => ({ ...b, url: [parch1, parch2, parch3, parch4, parch5, parch6][i] })),
    labels: {
      hook: (no) => `entry · no. ${no}`,
      section: (n) => `note ${n}`,
      diagram: (n) => `plate ${n}`,
      quote: 'marginalia',
      cta: 'fair winds',
    },
  },
  {
    id: 'tide',
    name: 'tide',
    // a single soft watercolor plate — sand, coral and sea-foam bleeding across
    // cream paper. the wash carries the texture, so the grain layer stays empty.
    base: {
      bg: '#F1E8D8',
      fg: '#2B2720',
      dim: '#8B7B5E',
      accent: '#C2714A',
      texture: 'none',
      mat: '#F5EFE2',
    },
    inverted: {
      bg: '#243E3A',
      fg: '#F1E8D8',
      dim: '#7DA39B',
      accent: '#D98E63',
      texture: 'none',
      mat: '#F5EFE2',
    },
    backgrounds: [{ id: 'tide1', name: 'low tide', url: tide1 }],
    labels: {
      hook: (no) => `tide · no. ${no}`,
      section: (n) => `mark ${n}`,
      diagram: (n) => `plate ${n}`,
      quote: 'marginalia',
      cta: 'slack tide',
    },
  },
  {
    id: 'noir',
    name: 'noir',
    // pure black canvas with cream type — meant to pair with a single full-bleed
    // image pinned to the top or bottom of the slide (set per-slide via image
    // placement). no texture, no inner frame; the photo carries all the weight.
    base: {
      bg: '#0A0A0A',
      fg: '#F4EEDD',
      dim: '#8C8579',
      accent: '#C2A878',
      texture: 'none',
      mat: '#0A0A0A',
    },
    // black stays black on the cta — nothing to invert against
    inverted: {
      bg: '#0A0A0A',
      fg: '#F4EEDD',
      dim: '#8C8579',
      accent: '#C2A878',
      texture: 'none',
      mat: '#0A0A0A',
    },
    labels: {
      hook: (no) => `no. ${no}`,
      section: (n) => `${n}.`,
      diagram: (n) => `plate ${n}`,
      quote: 'aside',
      cta: 'the end',
    },
  },
  {
    id: 'manifesto',
    name: 'manifesto',
    // high-impact "viral infographic" look: pure-black canvas, heavy uppercase
    // sans type, mint accent, a thin outlined eyebrow label and clean (not
    // hand-drawn) emphasis marks. the bold style owns the typography; the
    // palette carries the colors. eyebrow wording comes from the per-slide
    // `eyebrow` field (these auto labels are the fallback).
    style: 'bold',
    base: {
      bg: '#0A0A0A',
      fg: '#FFFFFF',
      dim: '#8A8A8A',
      accent: '#A8E6B0',
      texture: 'none',
      mat: '#161616',
    },
    // black stays black on the cta — nothing to invert against
    inverted: {
      bg: '#0A0A0A',
      fg: '#FFFFFF',
      dim: '#8A8A8A',
      accent: '#A8E6B0',
      texture: 'none',
      mat: '#161616',
    },
    labels: {
      hook: () => 'the hook',
      section: () => 'the point',
      diagram: () => 'the figure',
      quote: 'the quote',
      cta: 'the takeaway',
    },
  },
]

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// the typographic system a theme renders in; the renderers branch on this.
export function themeStyle(t: Theme): ThemeStyle {
  return t.style ?? 'editorial'
}

// ── per-project text-color overrides ─────────────────────────
// optional overrides applied on top of ANY theme (built-in or custom) so the
// user can recolor text/chrome/marks without leaving their chosen theme. only
// the text-bearing palette keys are overridable; the page color stays the
// theme's own (the custom theme owns its paper/bg through its dedicated UI).

export interface ColorOverrides {
  fg?: string
  dim?: string
  accent?: string
}

export function applyColorOverrides(theme: Theme, c?: ColorOverrides): Theme {
  if (!c || (!c.fg && !c.dim && !c.accent)) return theme
  const apply = (p: Palette): Palette => ({
    ...p,
    fg: c.fg || p.fg,
    dim: c.dim || p.dim,
    accent: c.accent || p.accent,
  })
  return { ...theme, base: apply(theme.base), inverted: apply(theme.inverted) }
}

// ── custom theme ─────────────────────────────────────────────
// a single user-defined theme: bring your own background image and text colors.
// stored separately from the built-in THEMES and turned into a Theme on demand
// when project.themeId === 'custom'.

export interface CustomThemeData {
  bg: string // background image as a data url; '' = a plain colored theme
  paper: string // page color behind the text (shows when there's no image)
  fg: string // primary text
  dim: string // chrome labels, rules, secondary text
  accent: string // pen circle, underline, highlighter marks
}

export const DEFAULT_CUSTOM: CustomThemeData = {
  bg: '',
  paper: '#F1E8D8',
  fg: '#2B2720',
  dim: '#8B7B5E',
  accent: '#C2714A',
}

export function buildCustomTheme(c: CustomThemeData): Theme {
  const palette: Palette = {
    bg: c.paper,
    fg: c.fg,
    dim: c.dim,
    accent: c.accent,
    texture: 'none',
    mat: c.paper,
  }
  return {
    id: 'custom',
    name: 'custom',
    base: palette,
    // image-backed themes don't truly invert — the plate is the same on the cta
    inverted: palette,
    backgrounds: c.bg ? [{ id: 'custom-bg', name: 'your image', url: c.bg }] : undefined,
    labels: {
      hook: (no) => `no. ${no}`,
      section: (n) => `note ${n}`,
      diagram: (n) => `plate ${n}`,
      quote: 'marginalia',
      cta: 'the end',
    },
  }
}

// ── auto colors from an image ────────────────────────────────
// sample a background to suggest readable text + accent colors. a heuristic
// starting point the user can nudge, not a guarantee — busy images are hard.

type RGB = [number, number, number]

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}
function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp8(v).toString(16).padStart(2, '0')).join('')
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function sampleTheme(dataUrl: string): Promise<Partial<CustomThemeData>> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const W = 72
      const H = 90 // 4:5, the slide ratio
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, W, H)
      const { data } = ctx.getImageData(0, 0, W, H)

      let sr = 0
      let sg = 0
      let sb = 0
      let n = 0
      let accent: RGB | null = null
      let bestScore = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        sr += r
        sg += g
        sb += b
        n++
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const sat = max === 0 ? 0 : (max - min) / max
        const lum = (max + min) / 2 / 255
        // favour vivid, mid-tone pixels for the accent
        const score = sat * (1 - Math.abs(lum - 0.5) * 1.4)
        if (score > bestScore) {
          bestScore = score
          accent = [r, g, b]
        }
      }

      const avg: RGB = [sr / n, sg / n, sb / n]
      const avgLum = (0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2]) / 255
      const light = avgLum > 0.55

      const fg: RGB = light ? [38, 34, 27] : [244, 239, 227]
      const paper = mix(avg, light ? [255, 255, 255] : [20, 18, 14], 0.18)
      const dim = mix(fg, paper, 0.42)
      const acc: RGB = bestScore > 0.12 && accent ? accent : mix(fg, paper, 0.2)

      resolve({
        paper: toHex(paper[0], paper[1], paper[2]),
        fg: toHex(fg[0], fg[1], fg[2]),
        dim: toHex(dim[0], dim[1], dim[2]),
        accent: toHex(acc[0], acc[1], acc[2]),
      })
    }
    img.onerror = () => reject(new Error('could not load image for sampling'))
    img.src = dataUrl
  })
}
