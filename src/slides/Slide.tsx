import type { CSSProperties } from 'react'
import type { SlideModel } from '../model'
import type { Theme, Palette } from '../tokens'
import { layout, fonts } from '../tokens'
import { AntaraWordmark } from './AntaraWordmark'
import { ContentSlide } from './ContentSlide'
import { DiagramSlide } from './DiagramSlide'

export interface SlideProps {
  slide: SlideModel
  microLabel: string
  index: number
  total: number
  theme: Theme
  assets: Record<string, string> // name -> object url
}

// the one slide component — used verbatim for both preview and export
export function Slide({ slide, microLabel, index, total, theme, assets }: SlideProps) {
  // cta always renders in the theme's inverted palette
  const p: Palette = slide.type === 'cta' ? theme.inverted : theme.base

  // image-backed themes: pick this slide's full-bleed plate (manual override,
  // else cycle through the set by position so a carousel gets variety)
  const charts = theme.backgrounds
  const bgUrl =
    charts && charts.length
      ? (charts.find((c) => c.id === slide.background) ?? charts[index % charts.length]).url
      : undefined

  const rootStyle: CSSProperties = {
    width: layout.slideW,
    height: layout.slideH,
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    backgroundColor: p.bg,
    backgroundImage: bgUrl ? undefined : p.texture, // image carries its own texture
    backgroundRepeat: 'repeat',
    color: p.fg,
    fontFamily: fonts.serif,
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

      {/* inner hairline frame — skipped on chart plates, which carry their own */}
      {!bgUrl && (
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

      {/* chrome: micro-label */}
      <div
        style={{
          position: 'absolute',
          top: layout.frame,
          left: layout.frame,
          fontFamily: fonts.mono,
          fontWeight: 500,
          fontSize: layout.microSize,
          letterSpacing: layout.microTracking,
          color: p.dim,
        }}
      >
        {microLabel}
      </div>

      {/* archetype content */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {renderType(slide, p, assets)}
      </div>

      {/* chrome: footer — the antara wordmark, recolored to the palette */}
      <div
        style={{
          position: 'absolute',
          bottom: layout.frame + 2,
          left: layout.frame,
        }}
      >
        <AntaraWordmark height={28} color={p.dim} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: layout.frame - 8,
          right: layout.frame,
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: layout.footerSize,
          color: p.dim,
        }}
      >
        {index + 1} / {total}
      </div>
    </div>
  )
}

function renderType(slide: SlideModel, p: Palette, assets: Record<string, string>) {
  if (slide.type === 'diagram') return <DiagramSlide slide={slide} p={p} assets={assets} />
  return <ContentSlide slide={slide} p={p} assets={assets} />
}
