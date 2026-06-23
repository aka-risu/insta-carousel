import type { CSSProperties, ReactNode } from 'react'
import type { Align, ElementKey, SlideModel, TextBacking } from '../model'
import type { Palette } from '../tokens'
import { resolveColor } from '../tokens'
import { alignCss } from './align'

// colored shapes behind text so it reads on a busy background image.
// box / pill / band wrap the whole element; highlight is a per-line marker that
// must sit on the inline text itself (so it hugs each wrapped line).

const PAD: Record<TextBacking['style'], string> = {
  box: '0.2em 0.5em',
  // pill needs generous horizontal room so the rounded ends clear the glyphs
  pill: '0.28em 0.9em',
  band: '0.3em 0',
  highlight: '0 0.2em',
}

// the painted height of a highlight marker, in em. kept below any line-height so
// adjacent wrapped lines never touch — at <100% opacity overlaps would otherwise
// double up into dark seams.
const HL_BAND = '0.92em'

// inline marker style for highlighted text content. instead of filling the whole
// line box (which overlaps the next line when line-height is tight), it paints a
// fixed-height stripe centred on each line via a gradient, so lines stay separate.
export function highlightStyle(b: TextBacking, p: Palette): CSSProperties {
  const c = resolveColor(b.color, p, b.opacity ?? 1)
  return {
    backgroundImage: `linear-gradient(${c}, ${c})`,
    backgroundSize: `100% ${HL_BAND}`,
    backgroundPosition: '0 center',
    backgroundRepeat: 'no-repeat',
    padding: PAD.highlight,
    WebkitBoxDecorationBreak: 'clone',
    boxDecorationBreak: 'clone',
  }
}

// wrap a whole element block (box / pill / band). highlight is handled inline by
// `hlWrap`, so this is a no-op for it.
// `bleed` is the host container's horizontal padding: a band uses it to extend
// edge-to-edge past that padding while keeping its text in the original column.
export function blockPlate(
  backing: TextBacking | undefined,
  p: Palette,
  align: Align,
  node: ReactNode,
  bleed = 0,
): ReactNode {
  if (!backing || backing.style === 'highlight') return node
  const bg = resolveColor(backing.color, p, backing.opacity ?? 1)

  // band: full-bleed colour spanning the whole slide width
  if (backing.style === 'band') {
    return (
      <div
        style={{
          background: bg,
          padding: PAD.band,
          paddingLeft: bleed,
          paddingRight: bleed,
          marginLeft: -bleed,
          marginRight: -bleed,
          alignSelf: 'stretch',
          textAlign: alignCss(align).textAlign,
          boxSizing: 'border-box',
        }}
      >
        {node}
      </div>
    )
  }

  // box / pill: a plate that hugs the text within the content column
  const base: CSSProperties = {
    background: bg,
    padding: PAD[backing.style],
    width: align === 'spread' ? '100%' : 'fit-content',
    maxWidth: '100%',
    alignSelf: alignCss(align).alignSelf,
    textAlign: alignCss(align).textAlign,
    boxSizing: 'border-box',
  }
  if (backing.style === 'pill') base.borderRadius = 999
  return <div style={base}>{node}</div>
}

// wrap inline text content in a per-line highlight marker when that style is set
export function hlWrap(
  slide: SlideModel,
  key: ElementKey,
  p: Palette,
  content: ReactNode,
): ReactNode {
  const tb = slide.textBg?.[key]
  if (tb?.style !== 'highlight') return content
  return <span style={highlightStyle(tb, p)}>{content}</span>
}
