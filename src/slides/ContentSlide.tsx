import type { CSSProperties, ReactNode } from 'react'
import type { ElementKey, SlideModel, SlideType } from '../model'
import { sizeFor, widthFor, alignFor, DEFAULT_FREE_POS } from '../model'
import type { Palette, ThemeStyle } from '../tokens'
import { layout, fonts } from '../tokens'
import { RichText } from './RichText'
import { blockPlate, hlWrap } from './TextPlate'
import { Selectable } from './Selectable'
import { alignCss } from './align'
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
  style = 'editorial',
  selectedElement,
  onSelectElement,
  onElementPointerDown,
  onResizePointerDown,
}: {
  slide: SlideModel
  p: Palette
  assets: Record<string, string>
  style?: ThemeStyle
} & ElementSelection) {
  const type = slide.type as Exclude<SlideType, 'diagram'>
  const preset = PRESETS[type] ?? PRESETS.text
  const centered = preset.align === 'center'
  const bold = style === 'bold'

  // a per-element color override beats the palette default when set
  const colorFor = (key: ElementKey, fallback: string) => slide.colors?.[key] || fallback

  // render each present element in the slide's own order (drag-reorderable).
  // each element carries its own align as both alignSelf (placement on export,
  // where Selectable is a no-op) and textAlign.
  const renderEl = (key: ElementKey): ReactNode => {
    const ac = alignCss(alignFor(slide, key))
    switch (key) {
      case 'stat':
        if (!slide.stat) return null
        return (
          <div
            key="stat"
            style={{
              fontFamily: bold ? fonts.display : undefined,
              fontSize: sizeFor(slide, 'stat'),
              fontWeight: bold ? 400 : 600,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              maxWidth: widthFor(slide, 'stat'),
              color: colorFor('stat', bold ? p.accent : p.fg),
              alignSelf: ac.alignSelf,
              textAlign: ac.textAlign,
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
              fontFamily: bold ? fonts.display : undefined,
              fontSize: sizeFor(slide, 'text'), // manual override, else auto-fit
              fontWeight: bold ? 400 : preset.weight,
              fontStyle: bold ? 'normal' : preset.italic ? 'italic' : 'normal',
              lineHeight: bold ? 1.05 : preset.lineHeight,
              textTransform: bold ? 'uppercase' : undefined,
              whiteSpace: 'pre-wrap',
              maxWidth: widthFor(slide, 'text') ?? 920,
              letterSpacing: bold ? '-0.01em' : type === 'hook' ? '-0.005em' : undefined,
              color: colorFor('text', p.fg),
              alignSelf: ac.alignSelf,
              textAlign: ac.textAlign,
            }}
          >
            {hlWrap(slide, 'text', p, <RichText text={slide.text} p={p} style={style} hlColor={slide.hlColors?.text} />)}
          </div>
        )
      case 'sub':
        if (!slide.sub && type !== 'hook') return null
        if (type === 'cta') {
          return (
            <div key="sub" style={{ display: 'flex', flexDirection: 'column', alignItems: ac.alignSelf, alignSelf: ac.alignSelf }}>
              <div style={{ width: 96, borderTop: `2px solid ${p.accent}`, marginBottom: 72 }} />
              <div
                style={{
                  fontFamily: bold ? fonts.sans : fonts.mono,
                  fontWeight: bold ? 600 : 500,
                  fontSize: sizeFor(slide, 'sub'),
                  lineHeight: 1.85,
                  letterSpacing: bold ? '0.08em' : '0.16em',
                  textTransform: bold ? 'uppercase' : undefined,
                  whiteSpace: 'pre-wrap',
                  maxWidth: widthFor(slide, 'sub'),
                  color: colorFor('sub', p.accent),
                  textAlign: ac.textAlign,
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
              fontFamily: bold ? fonts.sans : fonts.mono,
              fontWeight: bold ? 600 : 500,
              fontSize: sizeFor(slide, 'sub'),
              letterSpacing: bold ? '0.01em' : '0.2em',
              lineHeight: bold ? 1.32 : undefined,
              textTransform: bold ? 'uppercase' : undefined,
              whiteSpace: 'pre-wrap',
              maxWidth: widthFor(slide, 'sub'),
              color: colorFor('sub', p.dim),
              alignSelf: ac.alignSelf,
              textAlign: ac.textAlign,
            }}
          >
            {hlWrap(
              slide,
              'sub',
              p,
              type === 'hook' ? (
                <>
                  {bold ? (
                    <RichText text={slide.sub || 'keep reading'} p={p} style={style} hlColor={slide.hlColors?.sub} />
                  ) : (
                    slide.sub || 'keep reading'
                  )}
                  &nbsp;&nbsp;→
                </>
              ) : bold ? (
                <RichText text={slide.sub} p={p} style={style} hlColor={slide.hlColors?.sub} />
              ) : (
                slide.sub
              ),
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
              alignSelf: ac.alignSelf,
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
              alignSelf: ac.alignSelf,
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
              paddingLeft: bold ? 0 : 32,
              borderLeft: bold ? undefined : `3px solid ${p.accent}`,
              fontFamily: bold ? fonts.sans : undefined,
              fontStyle: bold ? 'normal' : 'italic',
              fontWeight: 500,
              fontSize: sizeFor(slide, 'def'),
              lineHeight: bold ? 1.4 : 1.45,
              textTransform: bold ? 'uppercase' : undefined,
              letterSpacing: bold ? '0.01em' : undefined,
              color: colorFor('def', p.dim),
              maxWidth: widthFor(slide, 'def') ?? 760,
              whiteSpace: 'pre-wrap',
              alignSelf: ac.alignSelf,
              textAlign: ac.textAlign,
            }}
          >
            {hlWrap(slide, 'def', p, bold ? <RichText text={slide.def} p={p} style={style} hlColor={slide.hlColors?.def} /> : slide.def)}
          </div>
        )
      case 'attribution':
        if (!slide.attribution) return null
        return (
          <div
            key="attribution"
            style={{
              fontFamily: bold ? fonts.sans : fonts.mono,
              fontWeight: bold ? 600 : 500,
              fontSize: sizeFor(slide, 'attribution'),
              letterSpacing: bold ? '0.04em' : '0.18em',
              textTransform: bold ? 'uppercase' : undefined,
              maxWidth: widthFor(slide, 'attribution'),
              color: colorFor('attribution', p.dim),
              alignSelf: ac.alignSelf,
              textAlign: ac.textAlign,
            }}
          >
            {hlWrap(slide, 'attribution', p, <>— {slide.attribution}</>)}
          </div>
        )
      case 'annotations': {
        // outside a diagram there's no plate to pin callouts to, so render the
        // lines as a simple stacked italic list honoring the element's controls
        const lines = slide.annotations.split('\n').filter((l) => l.trim() !== '')
        if (lines.length === 0) return null
        return (
          <div
            key="annotations"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontFamily: bold ? fonts.sans : undefined,
              fontStyle: bold ? 'normal' : 'italic',
              fontWeight: 500,
              fontSize: sizeFor(slide, 'annotations'),
              lineHeight: 1.3,
              textTransform: bold ? 'uppercase' : undefined,
              maxWidth: widthFor(slide, 'annotations'),
              color: colorFor('annotations', p.dim),
              alignSelf: ac.alignSelf,
              textAlign: ac.textAlign,
            }}
          >
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )
      }
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
      const align = alignFor(slide, key)
      // box/pill/band wrap the whole element; highlight is already inline
      return (
        <Selectable
          key={key}
          el={key}
          align={align}
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
          {blockPlate(slide.textBg?.[key], p, align, node, padX)}
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
