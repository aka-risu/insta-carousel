// alignment snapping for free-layout drag. pure math, no DOM — given the box
// being dragged, the other elements' boxes, and the canvas size, it nudges the
// drag onto any near-aligned edge/center and reports the guide lines to draw.
//
// all coordinates are canvas coords (1080×1350), matching slide `positions`.

export interface Box {
  x: number // top-left
  y: number
  w: number
  h: number
}

// a line to draw over the canvas while dragging. 'v' = vertical (constant x),
// 'h' = horizontal (constant y).
export interface Guide {
  axis: 'v' | 'h'
  pos: number
}

export interface SnapResult {
  x: number
  y: number
  guides: Guide[]
}

// how close (in canvas px) an edge must be to a reference line to snap to it
export const SNAP_THRESHOLD = 6

// the three reference offsets along one axis: near edge, center, far edge
function refsAlong(start: number, size: number): number[] {
  return [start, start + size / 2, start + size]
}

// snap one axis: returns the adjusted start coord and the matched line (or null)
function snapAxis(
  start: number,
  size: number,
  refLines: number[],
): { start: number; line: number | null } {
  const edges = refsAlong(start, size)
  let best: { delta: number; line: number; adjust: number } | null = null
  for (const edge of edges) {
    for (const line of refLines) {
      const delta = Math.abs(line - edge)
      if (delta <= SNAP_THRESHOLD && (!best || delta < best.delta)) {
        best = { delta, line, adjust: line - edge }
      }
    }
  }
  return best ? { start: start + best.adjust, line: best.line } : { start, line: null }
}

// compute the snapped position and the guide lines for a dragged box.
// `proposed` is where the raw pointer drag would place the box's top-left.
export function computeSnap(
  proposed: { x: number; y: number },
  size: { w: number; h: number },
  others: Box[],
  canvas: { w: number; h: number },
): SnapResult {
  // vertical reference lines (constant x): every other box's left/center/right,
  // plus the canvas left edge, horizontal center, and right edge
  const vLines = [
    ...others.flatMap((b) => refsAlong(b.x, b.w)),
    0,
    canvas.w / 2,
    canvas.w,
  ]
  // horizontal reference lines (constant y): tops/centers/bottoms + canvas
  const hLines = [
    ...others.flatMap((b) => refsAlong(b.y, b.h)),
    0,
    canvas.h / 2,
    canvas.h,
  ]

  const sx = snapAxis(proposed.x, size.w, vLines)
  const sy = snapAxis(proposed.y, size.h, hLines)

  const guides: Guide[] = []
  if (sx.line !== null) guides.push({ axis: 'v', pos: sx.line })
  if (sy.line !== null) guides.push({ axis: 'h', pos: sy.line })

  return { x: Math.round(sx.start), y: Math.round(sy.start), guides }
}
