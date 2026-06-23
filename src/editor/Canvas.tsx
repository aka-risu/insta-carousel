import { useLayoutEffect, useRef, useState } from 'react'
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
  /** rendered slide height for the carousel's ratio */
  slideH: number
  selectedElement: ElementKey | null
  onSelectElement: (key: ElementKey) => void
  onDeselect: () => void
  onElementPointerDown: (e: ReactPointerEvent, key: ElementKey) => void
  onResizePointerDown: (e: ReactPointerEvent, key: ElementKey) => void
}

// largest the slide is ever drawn on screen — keeps a 1:1 slide from blowing
// up on a wide desktop. the canvas otherwise shrinks to fit its mat.
const MAX_W = 560
const PAD = 24 // matches .canvas-mat padding, both axes

export function Canvas(props: CanvasProps) {
  const matRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = matRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { slideH } = props
  // fit the whole slide inside the mat (both axes), capped so it never over-zooms
  const fitW = Math.max(0, box.w - PAD * 2)
  const fitH = Math.max(0, box.h - PAD * 2)
  const scale = box.w
    ? Math.min(fitW / layout.slideW, fitH / slideH, MAX_W / layout.slideW)
    : MAX_W / layout.slideW
  const w = Math.round(layout.slideW * scale)
  const h = Math.round(slideH * scale)

  return (
    <div className="canvas-mat" ref={matRef} onClick={props.onDeselect}>
      {props.slide && (
        <div className="canvas-frame" style={{ width: w, height: h }}>
          <div
            data-slide-canvas
            style={{ width: layout.slideW, height: slideH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            <Slide
              slide={props.slide}
              microLabel={props.microLabel}
              index={props.index}
              total={props.total}
              theme={props.theme}
              assets={props.assets}
              slideH={slideH}
              selectedElement={props.selectedElement}
              onSelectElement={props.onSelectElement}
              onElementPointerDown={props.onElementPointerDown}
              onResizePointerDown={props.onResizePointerDown}
            />
          </div>
        </div>
      )}
      {!props.slide && <p className="empty-note">no slide selected</p>}
    </div>
  )
}
