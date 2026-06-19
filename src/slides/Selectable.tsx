import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { ElementKey } from '../model'

// a vivid, theme-independent selection colour so the outline reads on any palette
export const SELECT_COLOR = '#2f7bff'

export interface ElementSelection {
  /** the element currently highlighted on this slide (null = none) */
  selectedElement?: ElementKey | null
  /** click handler wired only in the editor preview; absent during export */
  onSelectElement?: (key: ElementKey) => void
  /** begins a free-layout drag for an element; editor preview only, absent on export */
  onElementPointerDown?: (e: ReactPointerEvent, key: ElementKey) => void
  /** begins a resize (font-size) drag from the corner handle; editor preview only */
  onResizePointerDown?: (e: ReactPointerEvent, key: ElementKey) => void
}

// wraps one slide element so it can be clicked to select (and dragged when the
// slide is in free layout). when `onSelectElement` is absent and the slide is
// not free (export), it renders the element untouched — keeping exported pixels
// identical to the editor.
export function Selectable({
  el,
  align = 'left',
  stretch = false,
  free = false,
  pos,
  selectedElement,
  onSelectElement,
  onElementPointerDown,
  onResizePointerDown,
  children,
}: ElementSelection & {
  el: ElementKey
  align?: 'left' | 'center'
  /** match a full-bleed band element so its wrapper doesn't clip the bleed */
  stretch?: boolean
  /** free layout: the element is placed absolutely at `pos` instead of stacked */
  free?: boolean
  /** top-left in canvas coordinates, used only when `free` */
  pos?: { x: number; y: number }
  children: ReactNode
}) {
  // export with no free positions: render untouched so the raster is unchanged
  if (!onSelectElement && !free) return <>{children}</>

  const selected = selectedElement === el
  const interactive = !!onSelectElement

  // free elements are absolutely placed; auto elements flow in the flex column
  const layoutStyle: CSSProperties = free
    ? { position: 'absolute', left: pos?.x ?? 0, top: pos?.y ?? 0, width: 'fit-content' }
    : {
        width: stretch ? '100%' : 'fit-content',
        maxWidth: '100%',
        alignSelf: stretch ? 'stretch' : align === 'center' ? 'center' : 'flex-start',
      }

  return (
    <div
      data-el={el}
      onPointerDown={interactive ? (e) => onElementPointerDown?.(e, el) : undefined}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation()
              onSelectElement(el)
            }
          : undefined
      }
      style={{
        ...layoutStyle,
        cursor: interactive ? (free ? 'move' : 'pointer') : undefined,
        outline: selected ? `5px solid ${SELECT_COLOR}` : '2px dashed transparent',
        outlineOffset: 12,
        borderRadius: 4,
        touchAction: free ? 'none' : undefined,
      }}
    >
      {children}
      {/* resize handle — drag to change the element's font size */}
      {free && selected && onResizePointerDown && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation() // don't also start a move drag
            onResizePointerDown(e, el)
          }}
          style={{
            position: 'absolute',
            right: -26,
            bottom: -26,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: SELECT_COLOR,
            border: '4px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            cursor: 'nwse-resize',
            touchAction: 'none',
          }}
        />
      )}
    </div>
  )
}
