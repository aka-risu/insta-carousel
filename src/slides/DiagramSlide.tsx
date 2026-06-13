import type { SlideModel } from '../model'
import { sizeFor } from '../model'
import type { Palette } from '../tokens'
import { fonts } from '../tokens'

// diagram — centered image plate with hand-annotation labels and dashed
// leader lines. annotations alternate top-left / bottom-right.
export function DiagramSlide({
  slide,
  p,
  assets,
}: {
  slide: SlideModel
  p: Palette
  assets: Record<string, string>
}) {
  const has = (k: string) => slide.elements.includes(k as never)
  const annotations = has('annotations')
    ? slide.annotations.split('\n').filter((l) => l.trim() !== '')
    : []
  const url = has('image') && slide.image ? assets[slide.image] : undefined

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the plate */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '47%',
          transform: 'translate(-50%, -50%)',
          width: 720,
          height: 760,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {has('image') && slide.image && url && (
          // tipped-in photographic plate: a clean mat so the image keeps its
          // true tones (no blend washing it out), with a hairline + soft shadow
          <div
            style={{
              padding: 22,
              background: p.mat,
              border: `1px solid ${p.dim}`,
              boxShadow: '0 10px 34px rgba(0,0,0,0.16)',
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'flex',
            }}
          >
            <img
              src={url}
              alt={slide.image}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        )}
        {has('image') && slide.image && !url && (
          <div
            style={{
              width: '100%',
              height: '100%',
              border: `2px dashed ${p.dim}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontFamily: fonts.mono,
                fontWeight: 500,
                fontSize: 34,
                letterSpacing: '0.18em',
                color: p.dim,
              }}
            >
              missing image
            </div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 32,
                padding: '10px 24px',
                border: `1px solid ${p.accent}`,
                borderRadius: 999,
                color: p.fg,
                background: 'rgba(185, 168, 124, 0.18)',
              }}
            >
              {slide.image}
            </div>
          </div>
        )}
        {(!has('image') || !slide.image) && (
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: 36,
              letterSpacing: '0.14em',
              color: p.dim,
            }}
          >
            ( pick an image )
          </div>
        )}
      </div>

      {/* annotations with dashed leader lines */}
      {annotations.map((text, i) => {
        const topLeft = i % 2 === 0
        const tier = Math.floor(i / 2)
        return topLeft ? (
          <div
            key={i}
            style={{ position: 'absolute', top: 160 + tier * 170, left: 96, width: 380 }}
          >
            <div
              style={{
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: sizeFor(slide, 'annotations'),
                lineHeight: 1.28,
                color: p.fg,
              }}
            >
              {text}
            </div>
            <svg width="240" height="110" style={{ display: 'block', marginTop: 8 }}>
              <line
                x1="16"
                y1="6"
                x2="218"
                y2="96"
                stroke={p.dim}
                strokeWidth="2"
                strokeDasharray="7 7"
              />
              <circle cx="222" cy="98" r="5" fill="none" stroke={p.dim} strokeWidth="2" />
            </svg>
          </div>
        ) : (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: 200 + tier * 170,
              right: 96,
              width: 380,
              textAlign: 'right',
            }}
          >
            <svg
              width="240"
              height="110"
              style={{ display: 'block', marginBottom: 8, marginLeft: 140 }}
            >
              <line
                x1="222"
                y1="104"
                x2="20"
                y2="14"
                stroke={p.dim}
                strokeWidth="2"
                strokeDasharray="7 7"
              />
              <circle cx="16" cy="12" r="5" fill="none" stroke={p.dim} strokeWidth="2" />
            </svg>
            <div
              style={{
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: sizeFor(slide, 'annotations'),
                lineHeight: 1.28,
                color: p.fg,
              }}
            >
              {text}
            </div>
          </div>
        )
      })}

      {/* caption + any extra elements stacked under the plate */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 150,
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          textAlign: 'center',
          width: 800,
        }}
      >
        {has('text') && slide.text && (
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: sizeFor(slide, 'text'),
              letterSpacing: '0.14em',
              color: p.dim,
              whiteSpace: 'pre-wrap',
            }}
          >
            {slide.text}
          </div>
        )}
        {has('sub') && slide.sub && (
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: sizeFor(slide, 'sub'),
              letterSpacing: '0.16em',
              color: p.dim,
              whiteSpace: 'pre-wrap',
            }}
          >
            {slide.sub}
          </div>
        )}
        {has('def') && slide.def && (
          <div
            style={{
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: sizeFor(slide, 'def'),
              lineHeight: 1.45,
              color: p.dim,
              whiteSpace: 'pre-wrap',
            }}
          >
            {slide.def}
          </div>
        )}
        {has('attribution') && slide.attribution && (
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 500,
              fontSize: sizeFor(slide, 'attribution'),
              letterSpacing: '0.18em',
              color: p.dim,
            }}
          >
            — {slide.attribution}
          </div>
        )}
      </div>
    </div>
  )
}
