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

export const layout = {
  slideW: 1080,
  slideH: 1350,
  frame: 72, // inner padding of every slide
  microSize: 36,
  microTracking: '0.22em',
  footerSize: 42,
} as const

export const fonts = {
  serif: `'EB Garamond', 'Iowan Old Style', Georgia, serif`,
  mono: `'IBM Plex Mono', 'SF Mono', Menlo, monospace`,
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

// a full-bleed background plate (vintage sea chart) for image-backed themes
export interface ChartBg {
  id: string
  name: string
  url: string
}

export interface Theme {
  id: string
  name: string
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
]

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
