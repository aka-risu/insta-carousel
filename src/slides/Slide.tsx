import type { CSSProperties } from 'react'
import type { SlideModel } from '../model'
import { DEFAULT_IMAGE_FRAC, IMAGE_FRAC_RANGE } from '../model'
import type { Theme, Palette } from '../tokens'
import { layout, fonts, resolveColor, themeStyle } from '../tokens'
import { AntaraWordmark } from './AntaraWordmark'
import { ContentSlide } from './ContentSlide'
import { DiagramSlide } from './DiagramSlide'
import type { ElementSelection } from './Selectable'

export interface SlideProps extends ElementSelection {
  slide: SlideModel
  microLabel: string
  index: number
  total: number
  theme: Theme
  assets: Record<string, string> // name -> object url
  /** rendered slide height for the carousel's ratio; defaults to 4:5 (1350) */
  slideH?: number
}

// the one slide component — used verbatim for both preview and export
export function Slide({
  slide,
  microLabel,
  index,
  total,
  theme,
  assets,
  slideH = layout.slideH,
  selectedElement,
  onSelectElement,
  onElementPointerDown,
  onResizePointerDown,
}: SlideProps) {
  // cta always renders in the theme's inverted palette
  const p: Palette = slide.type === 'cta' ? theme.inverted : theme.base
  const style = themeStyle(theme)
  const bold = style === 'bold'
  // a per-slide eyebrow overrides the auto micro-label, in any theme
  const labelText = slide.eyebrow?.trim() || microLabel

  // background image: a per-slide image (any theme) wins; otherwise fall back to
  // an image-backed theme's plate (manual override, else cycle by position)
  const charts = theme.backgrounds
  const themeBgUrl =
    charts && charts.length
      ? (charts.find((c) => c.id === slide.background) ?? charts[index % charts.length]).url
      : undefined
  const ownBgUrl = slide.bgImage ? assets[slide.bgImage] : undefined
  const bgUrl = ownBgUrl ?? themeBgUrl

  // optional tint/scrim over the background for legibility
  const overlay = slide.overlay
  const overlayBg = overlay
    ? overlay.mode === 'wash'
      ? resolveColor(overlay.color, p, overlay.opacity)
      : `linear-gradient(${overlay.mode === 'top' ? 'to bottom' : 'to top'}, ${resolveColor(
          overlay.color,
          p,
          overlay.opacity,
        )}, ${resolveColor(overlay.color, p, 0)})`
    : undefined

  // full-bleed image band: a slide's image pinned edge-to-edge to the top or
  // bottom. the band owns its region; the text + chrome shrink into the rest.
  const bandSide = slide.imageMode === 'top' || slide.imageMode === 'bottom' ? slide.imageMode : null
  const hasBand = bandSide !== null && !!slide.image
  const bandFrac = Math.min(
    IMAGE_FRAC_RANGE.max,
    Math.max(IMAGE_FRAC_RANGE.min, slide.imageFrac ?? DEFAULT_IMAGE_FRAC),
  )
  const bandH = hasBand ? Math.round(slideH * bandFrac) : 0
  const bandUrl = hasBand && slide.image ? assets[slide.image] : undefined
  const contentTop = hasBand && bandSide === 'top' ? bandH : 0
  const contentBottom = hasBand && bandSide === 'bottom' ? bandH : 0

  const rootStyle: CSSProperties = {
    width: layout.slideW,
    height: slideH,
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    backgroundColor: p.bg,
    backgroundImage: bgUrl ? undefined : p.texture, // image carries its own texture
    backgroundRepeat: 'repeat',
    color: p.fg,
    fontFamily: bold ? fonts.sans : fonts.serif,
  }

  return (
    <div style={rootStyle}>
      {/* full-bleed background plate (rendered as <img> so export inlines it) */}
      {bgUrl && (
        <img
          src={bgUrl}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* tint/scrim over the background for legibility */}
      {overlayBg && (
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, background: overlayBg, pointerEvents: 'none' }}
        />
      )}

      {/* full-bleed image band (top or bottom) */}
      {hasBand &&
        (bandUrl ? (
          <img
            src={bandUrl}
            alt={slide.image}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              [bandSide as 'top' | 'bottom']: 0,
              width: '100%',
              height: bandH,
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              [bandSide as 'top' | 'bottom']: 0,
              width: '100%',
              height: bandH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: fonts.mono,
              fontSize: 30,
              color: p.dim,
              border: `2px dashed ${p.dim}`,
              boxSizing: 'border-box',
            }}
          >
            ⚠ missing image · {slide.image}
          </div>
        ))}

      {/* inner hairline frame — skipped on chart plates, full-bleed bands, and
          the bold style (which wants clean edges) */}
      {!bgUrl && !hasBand && !bold && (
        <div
          style={{
            position: 'absolute',
            inset: 40,
            border: `1.5px solid ${p.dim}`,
            opacity: 0.45,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* chrome: eyebrow / micro-label — sits inside the content region, clear
          of the band. bold style frames it in a thin outlined box. */}
      <div
        style={{
          position: 'absolute',
          top: contentTop + layout.frame,
          left: layout.frame,
          fontFamily: bold ? fonts.sans : fonts.mono,
          fontWeight: bold ? 600 : 500,
          fontSize: bold ? 30 : layout.microSize,
          letterSpacing: bold ? '0.18em' : layout.microTracking,
          textTransform: bold ? 'uppercase' : undefined,
          color: p.dim,
          ...(bold
            ? {
                border: `1.5px solid ${p.dim}`,
                borderRadius: 4,
                padding: '10px 18px',
              }
            : null),
        }}
      >
        {labelText}
      </div>

      {/* archetype content — confined to the region the band leaves free */}
      <div style={{ position: 'absolute', top: contentTop, bottom: contentBottom, left: 0, right: 0 }}>
        {renderType(
          slide,
          p,
          style,
          assets,
          selectedElement,
          onSelectElement,
          onElementPointerDown,
          onResizePointerDown,
        )}
      </div>

      {/* chrome: footer — the antara wordmark, recolored to the palette */}
      <div
        style={{
          position: 'absolute',
          bottom: contentBottom + layout.frame + 2,
          left: layout.frame,
        }}
      >
        <AntaraWordmark height={28} color={p.dim} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: contentBottom + layout.frame - 8,
          right: layout.frame,
          fontFamily: bold ? fonts.sans : undefined,
          fontStyle: bold ? 'normal' : 'italic',
          fontWeight: bold ? 600 : 500,
          fontSize: layout.footerSize,
          letterSpacing: bold ? '0.04em' : undefined,
          color: p.dim,
        }}
      >
        {index + 1} / {total}
      </div>
    </div>
  )
}

function renderType(
  slide: SlideModel,
  p: Palette,
  style: ReturnType<typeof themeStyle>,
  assets: Record<string, string>,
  selectedElement: SlideProps['selectedElement'],
  onSelectElement: SlideProps['onSelectElement'],
  onElementPointerDown: SlideProps['onElementPointerDown'],
  onResizePointerDown: SlideProps['onResizePointerDown'],
) {
  const sel = { selectedElement, onSelectElement }
  // free-layout drag/resize is content-slide only; diagrams keep their layout
  if (slide.type === 'diagram')
    return <DiagramSlide slide={slide} p={p} assets={assets} {...sel} />
  return (
    <ContentSlide
      slide={slide}
      p={p}
      style={style}
      assets={assets}
      {...sel}
      onElementPointerDown={onElementPointerDown}
      onResizePointerDown={onResizePointerDown}
    />
  )
}
