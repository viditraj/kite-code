declare module 'ink-big-text' {
  import { FC } from 'react'

  interface BigTextProps {
    text: string
    font?: 'block' | 'slick' | 'tiny' | 'grid' | 'pallet' | 'shade' | 'simple' | 'simpleBlock' | '3d' | 'simple3d' | 'chrome' | 'huge'
    align?: 'left' | 'center' | 'right'
    colors?: string[]
    backgroundColor?: string
    letterSpacing?: number
    lineHeight?: number
    space?: boolean
    maxLength?: number
  }

  const BigText: FC<BigTextProps>
  export default BigText
}
