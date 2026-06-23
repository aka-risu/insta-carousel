import { layout } from '../tokens'
import type { Theme } from '../tokens'
import { Slide } from '../slides/Slide'
import { SLIDE_TYPE_ORDER, SLIDE_TYPES } from '../model'
import type { SlideModel, SlideType } from '../model'

const PREVIEW_W = 150
const SCALE = PREVIEW_W / layout.slideW

export interface FilmstripProps {
  slides: SlideModel[]
  selectedId: string | null
  labels: string[]
  theme: Theme
  assets: Record<string, string>
  onSelect: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onAdd: (type: SlideType) => void
  /** rendered slide height for the carousel's ratio */
  slideH: number
}

export function Filmstrip({
  slides,
  selectedId,
  labels,
  theme,
  assets,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
  slideH,
}: FilmstripProps) {
  const frameH = Math.round(slideH * SCALE)

  return (
    <>
      <label className="pane-label">slides</label>
      <div className="filmstrip-list">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={`filmstrip-row${slide.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(slide.id)}
          >
            <div
              className="filmstrip-frame"
              style={{ width: PREVIEW_W, height: frameH }}
            >
              <div
                style={{
                  width: layout.slideW,
                  height: slideH,
                  transform: `scale(${SCALE})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                }}
              >
                <Slide
                  slide={slide}
                  microLabel={labels[i]}
                  index={i}
                  total={slides.length}
                  theme={theme}
                  assets={assets}
                  slideH={slideH}
                  selectedElement={null}
                />
              </div>
            </div>
            <div className="filmstrip-caption">
              <span className="filmstrip-no">{String(i + 1).padStart(2, '0')}</span>
              <span className="filmstrip-type">{SLIDE_TYPES[slide.type].name}</span>
            </div>
            <span
              className="filmstrip-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                title="move up"
                disabled={i === 0}
                onClick={() => onMove(slide.id, -1)}
              >
                ↑
              </button>
              <button
                title="move down"
                disabled={i === slides.length - 1}
                onClick={() => onMove(slide.id, 1)}
              >
                ↓
              </button>
              <button title="duplicate" onClick={() => onDuplicate(slide.id)}>
                ⧉
              </button>
              <button title="delete" onClick={() => onRemove(slide.id)}>
                ×
              </button>
            </span>
          </div>
        ))}
      </div>

      <label className="pane-label">add slide</label>
      <div className="add-row">
        {SLIDE_TYPE_ORDER.map((t) => (
          <button
            key={t}
            className="add-chip"
            onClick={() => onAdd(t)}
            title={SLIDE_TYPES[t].about}
          >
            + {t}
          </button>
        ))}
      </div>
    </>
  )
}
