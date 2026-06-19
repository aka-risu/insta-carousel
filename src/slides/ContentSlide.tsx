import type { CSSProperties, ReactNode } from 'react'
import type { ElementKey, SlideModel, SlideType } from '../model'
import { sizeFor, DEFAULT_FREE_POS } from '../model'
import type { Palette } from '../tokens'
import { layout, fonts } from '../tokens'
import { RichText } from './RichText'
import { blockPlate, hlWrap } from './TextPlate'
import { Selectable } from './Selectable'
import type { ElementSelection } from './Selectable'

// one renderer for every non-diagram slide: it lays out whichever elements
// the slide carries, in canonical order, styled by the slide type's preset.

interface Preset {
  align: 'left' | 'center'
  weight: 500 | 600
  italic: boolean
  lineHeight: number
  lowBias: number // extra top padding to sit the block slightly low
}

const PRESETS: Record<Exclude<SlideType, 'diagram'>, Preset> = {
  hook: { align: 'left', weight: 600, italic: false, lineHeight: 1.18, lowBias: 100 },
  text: { align: 'left', weight: 500, italic: false, lineHeight: 1.42, lowBias: 0 },
  fact: { align: 'left', weight: 500, italic: false, lineHeight: 1.4, lowBias: 0 },
  quote: { align: 'center', weight: 500, italic: true, lineHeight: 1.38, lowBias: 0 },
  cta: { align: 'center', weight: 600, italic: false, lineHeight: 1.2, lowBias: 0 },
}

export function ContentSlide({
  slide,
  p,
  assets,
  selectedElement,
  onSelectElement,
  onElementPointerDown,
  onResizePointerDown,
}: {
  slide: SlideModel
  p: Palette
  assets: Record<string, string>
} & ElementSelection) {
  const type = slide.type as Exclude<SlideType, 'diagram'>
  const preset = PRESETS[type] ?? PRESETS.text
  const centered = preset.align === 'center'

  // a per-element color override beats the palette default when set
  const colorFor = (key: ElementKey, fallback: string) => slide.colors?.[key] || fallback

  // render each present element in the slide's own order (drag-reorderable)
  const renderEl = (key: ElementKey): ReactNode => {
    switch (key) {
      case 'stat':
        if (!slide.stat) return null
        return (
          <div
            key="stat"
            style={{
              fontSize: sizeFor(slide, 'stat'),
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: colorFor('stat', p.fg),
            }}
          >
            {hlWrap(slide, 'stat', p, slide.stat)}
          </div>
        )
      case 'text':
        if (!slide.text) return null
        return (
          <div
            key="text"
            style={{
              fontSize: sizeFor(slide, 'text'), // manual override, else auto-fit
              fontWeight: preset.weight,
              fontStyle: preset.italic ? 'italic' : 'normal',
              lineHeight: preset.lineHeight,
              whiteSpace: 'pre-wrap',
              maxWidth: 920,
              letterSpacing: type === 'hook' ? '-0.005em' : undefined,
              color: colorFor('text', p.fg),
            }}
          >
            {hlWrap(slide, 'text', p, <RichText text={slide.text} p={p} />)}
          </div>
        )
      case 'sub':
        if (!slide.sub && type !== 'hook') return null
        if (type === 'cta') {
          return (
            <div key="sub" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 96, borderTop: `2px solid ${p.accent}`, marginBottom: 72 }} />
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontWeight: 500,
                  fontSize: sizeFor(slide, 'sub'),
                  lineHeight: 1.85,
                  letterSpacing: '0.16em',
                  whiteSpace: 'pre-wrap',
                  color: colorFor('sub', p.accent),
                }}
              >
                {slide.sub.split('\n').filter((l) => l.trim()).join('\n')}
              </div>
            </div>
          )
        }
        return (
          <div
            key="sub"
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: sizeFor(slide, 'sub'),
              letterSpacing: '0.2em',
              whiteSpace: 'pre-wrap',
              color: colorFor('sub', p.dim),
            }}
          >
            {hlWrap(
              slide,
              'sub',
              p,
              type === 'hook' ? <>{slide.sub || 'keep reading'}&nbsp;&nbsp;→</> : slide.sub,
            )}
          </div>
        )
      case 'image': {
        if (!slide.image) return null
        // a top/bottom image is drawn full-bleed by the slide frame, not here
        if (slide.imageMode === 'top' || slide.imageMode === 'bottom') return null
        const url = assets[slide.image]
        return url ? (
          <div
            key="image"
            style={{
              padding: 18,
              background: p.mat,
              border: `1px solid ${p.dim}`,
              boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
              alignSelf: centered ? 'center' : 'flex-start',
              display: 'flex',
            }}
          >
            <img
              src={url}
              alt={slide.image}
              style={{ maxWidth: 700, maxHeight: 420, objectFit: 'contain', display: 'block' }}
            />
          </div>
        ) : (
          <div
            key="image"
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: 30,
              padding: '18px 28px',
              border: `2px dashed ${p.dim}`,
              color: p.dim,
              alignSelf: centered ? 'center' : 'flex-start',
            }}
          >
            ⚠ missing image · {slide.image}
          </div>
        )
      }
      case 'def':
        if (!slide.def) return null
        return (
          <div
            key="def"
            style={{
              paddingLeft: 32,
              borderLeft: `3px solid ${p.accent}`,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: sizeFor(slide, 'def'),
              lineHeight: 1.45,
              color: colorFor('def', p.dim),
              maxWidth: 760,
              whiteSpace: 'pre-wrap',
              textAlign: 'left',
            }}
          >
            {hlWrap(slide, 'def', p, slide.def)}
          </div>
        )
      case 'attribution':
        if (!slide.attribution) return null
        return (
          <div
            key="attribution"
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: sizeFor(slide, 'attribution'),
              letterSpacing: '0.18em',
              color: colorFor('attribution', p.dim),
            }}
          >
            {hlWrap(slide, 'attribution', p, <>— {slide.attribution}</>)}
          </div>
        )
      default:
        return null
    }
  }

  // the root's horizontal padding — a band plate bleeds past this to the edges
  const padX = layout.frame + (centered ? 48 : 24)

  const blocks = slide.elements
    .map((key) => {
      const node = renderEl(key)
      if (!node) return null
      // box/pill/band wrap the whole element; highlight is already inline
      return (
        <Selectable
          key={key}
          el={key}
          align={preset.align}
          // a band plate bleeds full-width, so its wrapper must stretch too
          stretch={slide.textBg?.[key]?.style === 'band'}
          free={slide.free}
          pos={slide.free ? (slide.positions?.[key] ?? DEFAULT_FREE_POS) : undefined}
          selectedElement={selectedElement}
          onSelectElement={onSelectElement}
          onElementPointerDown={onElementPointerDown}
          // images have no font size; everything else can be scaled by drag
          onResizePointerDown={key === 'image' ? undefined : onResizePointerDown}
        >
          {blockPlate(slide.textBg?.[key], p, preset.align, node, padX)}
        </Selectable>
      )
    })
    .filter(Boolean)

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    padding: layout.frame + (centered ? 48 : 24),
    paddingTop: layout.frame + 24 + preset.lowBias,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: centered ? 'center' : 'flex-start',
    textAlign: preset.align,
    gap: 64,
  }

  return (
    <div data-content-root style={rootStyle}>
      {blocks}
    </div>
  )
}
