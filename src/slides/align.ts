import type { CSSProperties } from 'react'
import type { Align } from '../model'

// the two CSS facts an alignment maps to: where the block sits in the flex
// column, and how its text lays out. 'spread' justifies and stretches full-width.
export function alignCss(align: Align): {
  alignSelf: CSSProperties['alignSelf']
  textAlign: CSSProperties['textAlign']
} {
  switch (align) {
    case 'center':
      return { alignSelf: 'center', textAlign: 'center' }
    case 'right':
      return { alignSelf: 'flex-end', textAlign: 'right' }
    case 'spread':
      return { alignSelf: 'stretch', textAlign: 'justify' }
    default:
      return { alignSelf: 'flex-start', textAlign: 'left' }
  }
}
