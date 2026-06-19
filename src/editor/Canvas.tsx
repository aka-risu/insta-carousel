import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SlideModel, ElementKey } from '../model'
import type { Theme } from '../tokens'
import { layout } from '../tokens'
import { Slide } from '../slides/Slide'

export interface CanvasProps {
  slide: SlideModel | null
  index: number
  total: number
  microLabel: string
  theme: Theme
  assets: Record<string, string>
  selectedElement: ElementKey | null
  onSelectElement: (key: ElementKey) => void
  onDeselect: () => void
  onElementPointerDown: (e: ReactPointerEvent, key: ElementKey) => void
  onResizePointerDown: (e: ReactPointerEvent, key: ElementKey) => void
}

const CANVAS_W = 520
const SCALE = CANVAS_W / layout.slideW

export function Canvas(props: CanvasProps) {
  if (!props.slide) return <p className="empty-note">no slide selected</p>
  return (
    <div className="canvas-mat" onClick={props.onDeselect}>
      <div className="canvas-frame" style={{ width: CANVAS_W, height: Math.round(layout.slideH * SCALE) }}>
        <div data-slide-canvas style={{ width: layout.slideW, height: layout.slideH, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
          <Slide
            slide={props.slide}
            microLabel={props.microLabel}
            index={props.index}
            total={props.total}
            theme={props.theme}
            assets={props.assets}
            selectedElement={props.selectedElement}
            onSelectElement={props.onSelectElement}
            onElementPointerDown={props.onElementPointerDown}
            onResizePointerDown={props.onResizePointerDown}
          />
        </div>
      </div>
    </div>
  )
}
