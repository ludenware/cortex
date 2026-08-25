import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { TextSize } from '@cortex/core'

interface TextSizeContextValue {
  textSize: TextSize
  setTextSize: (size: TextSize) => void
}

const TextSizeContext = createContext<TextSizeContextValue | null>(null)

/** Maps to Chromium's native content zoom factor (`webFrame.setZoomFactor`,
 *  same mechanism as Cmd/Ctrl+=/-) rather than a CSS `zoom` rule — see
 *  CLAUDE.md for why: a CSS-only approach can't simultaneously keep the UI
 *  filling the window exactly *and* preserve internal layout proportions,
 *  since compensating a subtree's declared height for the composite scale
 *  necessarily changes how much local space flexible children see. Native
 *  zoom scales `vh`/`%`/`window.innerHeight` consistently throughout, so
 *  neither problem occurs. */
const TEXT_SIZE_ZOOM: Record<TextSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.1,
}

export function TextSizeProvider({
  children,
  vaultReady,
}: {
  children: ReactNode
  vaultReady: boolean
}) {
  const [textSize, setTextSizeState] = useState<TextSize>('medium')

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize)
    try {
      window.cortex.window.setZoomFactor(TEXT_SIZE_ZOOM[textSize])
    } catch {
      // preload bridge not ready yet
    }
  }, [textSize])

  useEffect(() => {
    if (!vaultReady) return
    window.cortex.settings.getTextSize().then(setTextSizeState).catch(() => {})
  }, [vaultReady])

  const setTextSize = useCallback(
    async (next: TextSize) => {
      setTextSizeState(next)
      if (vaultReady) {
        try {
          await window.cortex.settings.setTextSize(next)
        } catch {
          // vault may not be ready yet
        }
      }
    },
    [vaultReady]
  )

  return (
    <TextSizeContext.Provider value={{ textSize, setTextSize }}>
      {children}
    </TextSizeContext.Provider>
  )
}

export function useTextSize(): TextSizeContextValue {
  const ctx = useContext(TextSizeContext)
  if (!ctx) throw new Error('useTextSize must be used within TextSizeProvider')
  return ctx
}
