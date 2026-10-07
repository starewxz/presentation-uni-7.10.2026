import type { ComponentType } from 'react'
import type { SlideProps } from '../types'
import Slide01Opening from './Slide01Opening'
import Slide02Question from './Slide02Question'
import Slide03Language from './Slide03Language'
import Slide04Identity from './Slide04Identity'
import Slide05Ukraine from './Slide05Ukraine'
import Slide06Protest from './Slide06Protest'
import Slide07Society from './Slide07Society'
import Slide08Digital from './Slide08Digital'
import Slide09Code from './Slide09Code'
import Slide10Finale from './Slide10Finale'
import Slide11Sources from './Slide11Sources'

const slides: ComponentType<SlideProps>[] = [
  Slide01Opening, Slide02Question, Slide03Language, Slide04Identity, Slide05Ukraine, Slide06Protest,
  Slide07Society, Slide08Digital, Slide09Code, Slide10Finale, Slide11Sources,
]
/** Page tone per slide: drives background / ink colours (animated). */
export const TONES: ('light' | 'dark')[] = ['dark', 'light', 'light', 'light', 'light', 'light', 'light', 'dark', 'light', 'dark', 'light']
export default slides
