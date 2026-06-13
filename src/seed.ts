import type { Project } from './model'
import { slideOf } from './model'

// the app opens with this populated example
export const SEED_PROJECT: Project = {
  title: 'the mammalian dive reflex',
  themeId: 'journal',
  slides: [
    slideOf('hook', { text: 'your body still *remembers*\nbeing aquatic.' }),
    slideOf('fact', {
      stat: '−25%',
      text: 'face in cold water — heart rate drops 10–25%.\nno training required.',
      def: 'bradycardia, n. — the slowing of the heart',
    }),
    slideOf('diagram', {
      image: 'seal-plate.jpg',
      annotations: 'blood shifts inward\nvasoconstriction',
    }),
    slideOf('quote', {
      text: 'the sea, once it casts its spell,\nholds one in its net of wonder forever.',
      attribution: 'jacques cousteau',
    }),
    slideOf('cta', { text: 'learn to use it.', sub: 'antara freediving · koh tao' }),
  ],
}
