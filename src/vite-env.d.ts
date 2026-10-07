/// <reference types="vite/client" />
import 'react'
import type { ThreeElements } from '@react-three/fiber'

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
