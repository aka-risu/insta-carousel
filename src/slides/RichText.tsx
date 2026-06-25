import type { ReactNode } from 'react'
import type { Palette, ThemeStyle } from '../tokens'
import { readableHighlightColor, resolveColor } from '../tokens'

// inline emphasis marks for body text. the same markup renders two ways:
//
// editorial (the field-journal hand):
//   *word*   → pen circle (hand-drawn loop around the word)
//   _word_   → hand-drawn underline
//   ==word== → highlighter sweep
//
// bold (the manifesto look — crisp, not hand-drawn):
//   *word*   → bold white run
//   _word_   → straight mint underline
//   ==word== → solid mint highlight
//
// rendered as svg/css overlays — NO svg <filter>, which html-to-image drops.

const RE = /(==[^=\n]+==|\*[^*\n]+\*|_[^_\n]+_)/g

// a slightly irregular, overshooting loop so it reads as ink, not a vector oval.
// drawn near the edges of a 0..100 × 0..50 box (with a little overshoot past the
// start); preserveAspectRatio=none stretches it to the word, non-scaling stroke
// keeps the line weight even regardless of word width/height.
const CIRCLE_PATH =
  'M3,25 C2,12 26,4 50,4 C76,4 99,10 97,25 C99,40 66,47 39,46 C13,45 2,39 4,23 C5,16 11,12 20,9'

const UNDERLINE_PATH = 'M1,6 C22,2 44,9 63,4 C79,1 92,7 99,3'

export function RichText({
  text,
  p,
  style = 'editorial',
  hlColor,
}: {
  text: string
  p: Palette
  style?: ThemeStyle
  /** text color for ==highlight== spans (hex or palette token); undefined =
   *  auto-contrast against the highlight fill */
  hlColor?: string
}): ReactNode {
  if (!text) return null
  const parts = text.split(RE)
  // explicit override color for emphasis marks, or undefined for "auto" (each
  // mark keeps its own default). applies to *circle* / _underline_ runs.
  const markColor = hlColor ? resolveColor(hlColor, p) : undefined
  // text color for ==highlight== runs: the override, else a color chosen to stay
  // legible on this style's highlight fill (avoids white-on-white).
  const hlText = markColor ?? readableHighlightColor(p, style)

  // bold style: crisp marks, no hand-drawn svg overlays
  if (style === 'bold') {
    return parts.map((part, i) => {
      if (part.startsWith('==') && part.endsWith('==')) {
        return (
          <span
            key={i}
            style={{
              background: p.accent,
              color: hlText,
              fontWeight: 700,
              padding: '0.02em 0.16em',
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {part.slice(2, -2)}
          </span>
        )
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <span key={i} style={{ fontWeight: 700, color: markColor ?? p.fg }}>
            {part.slice(1, -1)}
          </span>
        )
      }
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        return (
          <span
            key={i}
            style={{
              fontWeight: 700,
              color: markColor ?? p.fg,
              borderBottom: `0.09em solid ${p.accent}`,
              paddingBottom: '0.04em',
            }}
          >
            {part.slice(1, -1)}
          </span>
        )
      }
      return part
    })
  }

  return parts.map((part, i) => {
    if (part.startsWith('==') && part.endsWith('==')) {
      return (
        <span
          key={i}
          style={{
            background: `color-mix(in srgb, ${p.accent} 46%, transparent)`,
            color: hlText,
            padding: '0.02em 0.12em',
            borderRadius: 3,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {part.slice(2, -2)}
        </span>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <span
          key={i}
          // padding gives the loop room around the glyphs; the svg fills this
          // padded box. an svg is a *replaced element*, so width/height must be
          // explicit 100% — `width:auto` snaps to the viewBox ratio (the bug
          // that made the loop a fixed width regardless of the word).
          style={{
            position: 'relative',
            display: 'inline-block',
            whiteSpace: 'pre',
            padding: '0.14em 0.5em', // room so the loop clears the first/last glyph
            color: markColor,
          }}
        >
          {part.slice(1, -1)}
          <svg
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <path
              d={CIRCLE_PATH}
              fill="none"
              stroke={p.accent}
              strokeWidth={2.4}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </span>
      )
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return (
        <span
          key={i}
          style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', color: markColor }}
        >
          {part.slice(1, -1)}
          <svg
            viewBox="0 0 100 9"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '-0.18em',
              width: '100%',
              height: '0.22em',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <path
              d={UNDERLINE_PATH}
              fill="none"
              stroke={p.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </span>
      )
    }
    return part // plain text — newlines preserved by the parent's pre-wrap
  })
}
