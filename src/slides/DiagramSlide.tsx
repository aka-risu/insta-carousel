import type { CSSProperties, ReactNode } from 'react'
import type { DragKey, ElementKey, SlideModel } from '../model'
import { sizeFor, widthFor, DEFAULT_FREE_POS } from '../model'
import type { Palette } from '../tokens'
import { fonts } from '../tokens'
import { blockPlate, hlWrap } from './TextPlate'
import { Selectable } from './Selectable'
import type { ElementSelection } from './Selectable'

// diagram — centered image plate with hand-annotation labels and dashed
// leader lines. annotations alternate top-left / bottom-right.
//
// in free layout every element (caption text, image, and each annotation line)
// is dragged to an absolute position via the shared free-layout engine; the
// leader lines re-aim from each callout toward the image plate. auto layout
// keeps the original centered composition untouched.
export function DiagramSlide({
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
  const sel = { selectedElement, onSelectElement }
  const drag = { onElementPointerDown, onResizePointerDown }
  const free = !!slide.free
  const has = (k: string) => slide.elements.includes(k as never)
  const colorFor = (key: ElementKey, fallback: string) => slide.colors?.[key] || fallback
  const annotations = has('annotations')
    ? slide.annotations.split('\n').filter((l) => l.trim() !== '')
    : []
  const url = has('image') && slide.image ? assets[slide.image] : undefined
  const hasImage = has('image') && !!slide.image
  const posOf = (k: DragKey) => slide.positions?.[k] ?? DEFAULT_FREE_POS

  // ── element content (no positioning) — shared by both layouts ──

  const imageNode: ReactNode = url ? (
    // tipped-in photographic plate: a clean mat so the image keeps its true
    // tones (no blend washing it out), with a hairline + soft shadow
    <div
      style={{
        padding: 22,
        background: p.mat,
        border: `1px solid ${p.dim}`,
        boxShadow: '0 10px 34px rgba(0,0,0,0.16)',
        maxWidth: free ? 720 : '100%',
        maxHeight: free ? 760 : '100%',
        display: 'flex',
      }}
    >
      <img
        src={url}
        alt={slide.image}
        style={{
          maxWidth: free ? 676 : '100%',
          maxHeight: free ? 716 : '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  ) : (
    <div
      style={{
        width: free ? 560 : '100%',
        height: free ? 560 : '100%',
        border: `2px dashed ${p.dim}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        boxSizing: 'border-box',
        padding: 40,
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
  )

  const annotationNode = (text: string): ReactNode => (
    <div
      style={{
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: sizeFor(slide, 'annotations'),
        lineHeight: 1.28,
        maxWidth: widthFor(slide, 'annotations') ?? 380,
        color: colorFor('annotations', p.fg),
      }}
    >
      {text}
    </div>
  )

  // caption block (text / sub / def / attribution) — mono, centered
  const captionNode = (key: 'text' | 'sub' | 'def' | 'attribution'): ReactNode => {
    if (!has(key) || !slide[key]) return null
    const styleByKey: Record<typeof key, CSSProperties> = {
      text: {
        fontFamily: fonts.mono,
        fontWeight: 500,
        fontSize: sizeFor(slide, 'text'),
        letterSpacing: '0.14em',
        maxWidth: widthFor(slide, 'text'),
        color: colorFor('text', p.dim),
        whiteSpace: 'pre-wrap',
      },
      sub: {
        fontFamily: fonts.mono,
        fontWeight: 500,
        fontSize: sizeFor(slide, 'sub'),
        letterSpacing: '0.16em',
        maxWidth: widthFor(slide, 'sub'),
        color: colorFor('sub', p.dim),
        whiteSpace: 'pre-wrap',
      },
      def: {
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: sizeFor(slide, 'def'),
        lineHeight: 1.45,
        maxWidth: widthFor(slide, 'def'),
        color: colorFor('def', p.dim),
        whiteSpace: 'pre-wrap',
      },
      attribution: {
        fontFamily: fonts.mono,
        fontWeight: 500,
        fontSize: sizeFor(slide, 'attribution'),
        letterSpacing: '0.18em',
        maxWidth: widthFor(slide, 'attribution'),
        color: colorFor('attribution', p.dim),
      },
    }
    const inner =
      key === 'attribution' ? <>— {slide.attribution}</> : slide[key]
    return blockPlate(
      slide.textBg?.[key],
      p,
      'center',
      <div style={styleByKey[key]}>{hlWrap(slide, key, p, inner)}</div>,
    )
  }

  const captionKeys: ('text' | 'sub' | 'def' | 'attribution')[] = [
    'text',
    'sub',
    'def',
    'attribution',
  ]

  // ── free layout: everything placed absolutely; leader lines re-aim ──
  if (free) {
    // the image plate's rough centre, so leader lines point at it (approximate
    // — the line just needs to read as aiming at the plate)
    const imgPos = hasImage ? slide.positions?.['image'] : undefined
    const target = imgPos ? { x: imgPos.x + 220, y: imgPos.y + 240 } : { x: 540, y: 430 }

    return (
      <div data-content-root style={{ position: 'absolute', inset: 0 }}>
        {/* leader lines (decorative; never intercept pointer events) */}
        {annotations.length > 0 && (
          <svg
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {annotations.map((_, i) => {
              const a = posOf(`annotations#${i}`)
              const ax = a.x + 30
              const ay = a.y + 20
              // stop the pin short of the plate centre so it reads as pointing at it
              const px = ax + (target.x - ax) * 0.86
              const py = ay + (target.y - ay) * 0.86
              return (
                <g key={i}>
                  <line
                    x1={ax}
                    y1={ay}
                    x2={px}
                    y2={py}
                    stroke={p.dim}
                    strokeWidth={2}
                    strokeDasharray="7 7"
                  />
                  <circle cx={px} cy={py} r={5} fill="none" stroke={p.dim} strokeWidth={2} />
                </g>
              )
            })}
          </svg>
        )}

        {hasImage && (
          <Selectable
            el="image"
            free
            pos={posOf('image')}
            {...sel}
            onElementPointerDown={onElementPointerDown}
          >
            {imageNode}
          </Selectable>
        )}

        {annotations.map((text, i) => (
          <Selectable
            key={i}
            el={`annotations#${i}`}
            free
            pos={posOf(`annotations#${i}`)}
            {...sel}
            {...drag}
          >
            {annotationNode(text)}
          </Selectable>
        ))}

        {captionKeys.map((key) => {
          const node = captionNode(key)
          if (!node) return null
          return (
            <Selectable key={key} el={key} free pos={posOf(key)} {...sel} {...drag}>
              {node}
            </Selectable>
          )
        })}
      </div>
    )
  }

  // ── auto layout: the original centered composition ──
  return (
    <div data-content-root style={{ position: 'absolute', inset: 0 }}>
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
        {hasImage && (
          <Selectable
            el="image"
            align="center"
            {...sel}
            onElementPointerDown={onElementPointerDown}
          >
            {imageNode}
          </Selectable>
        )}
        {!hasImage && (
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
            <Selectable el={`annotations#${i}`} stretch {...sel} {...drag}>
              {annotationNode(text)}
            </Selectable>
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
            <Selectable el={`annotations#${i}`} stretch {...sel} {...drag}>
              {annotationNode(text)}
            </Selectable>
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
        {captionKeys.map((key) => {
          const node = captionNode(key)
          if (!node) return null
          return (
            <Selectable key={key} el={key} align="center" {...sel} {...drag}>
              {node}
            </Selectable>
          )
        })}
      </div>
    </div>
  )
}
