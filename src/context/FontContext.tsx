import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { FontWeightLevel } from '@cortex/core'
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT_ID, getFontFamily, getFontWeightValue } from '@cortex/core'

interface FontContextValue {
  uiFont: string
  uiFontWeight: FontWeightLevel
  composeFont: string
  composeFontWeight: FontWeightLevel
  setUIFont: (id: string) => void
  setUIFontWeight: (id: FontWeightLevel) => void
  setComposeFont: (id: string) => void
  setComposeFontWeight: (id: FontWeightLevel) => void
}

const FontContext = createContext<FontContextValue | null>(null)

export function FontProvider({
  children,
  vaultReady,
}: {
  children: ReactNode
  vaultReady: boolean
}) {
  const [uiFont, setUIFontState] = useState(DEFAULT_FONT_ID)
  const [uiFontWeight, setUIFontWeightState] = useState<FontWeightLevel>(DEFAULT_FONT_WEIGHT_ID)
  const [composeFont, setComposeFontState] = useState(DEFAULT_FONT_ID)
  const [composeFontWeight, setComposeFontWeightState] = useState<FontWeightLevel>(DEFAULT_FONT_WEIGHT_ID)

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--ui-font-family', getFontFamily(uiFont))
  }, [uiFont])

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-font-weight', String(getFontWeightValue(uiFontWeight)))
  }, [uiFontWeight])

  useEffect(() => {
    document.documentElement.style.setProperty('--compose-font-family', getFontFamily(composeFont))
  }, [composeFont])

  useEffect(() => {
    document.documentElement.style.setProperty('--compose-font-weight', String(getFontWeightValue(composeFontWeight)))
  }, [composeFontWeight])

  useEffect(() => {
    if (!vaultReady) return
    Promise.all([
      window.cortex.settings.getUIFont(),
      window.cortex.settings.getUIFontWeight(),
      window.cortex.settings.getComposeFont(),
      window.cortex.settings.getComposeFontWeight(),
    ])
      .then(([font, weight, composeF, composeW]) => {
        setUIFontState(font)
        setUIFontWeightState(weight)
        setComposeFontState(composeF)
        setComposeFontWeightState(composeW)
      })
      .catch(() => {})
  }, [vaultReady])

  const setUIFont = useCallback(
    (id: string) => {
      setUIFontState(id)
      if (vaultReady) void window.cortex.settings.setUIFont(id).catch(() => {})
    },
    [vaultReady]
  )

  const setUIFontWeight = useCallback(
    (id: FontWeightLevel) => {
      setUIFontWeightState(id)
      if (vaultReady) void window.cortex.settings.setUIFontWeight(id).catch(() => {})
    },
    [vaultReady]
  )

  const setComposeFont = useCallback(
    (id: string) => {
      setComposeFontState(id)
      if (vaultReady) void window.cortex.settings.setComposeFont(id).catch(() => {})
    },
    [vaultReady]
  )

  const setComposeFontWeight = useCallback(
    (id: FontWeightLevel) => {
      setComposeFontWeightState(id)
      if (vaultReady) void window.cortex.settings.setComposeFontWeight(id).catch(() => {})
    },
    [vaultReady]
  )

  return (
    <FontContext.Provider
      value={{ uiFont, uiFontWeight, composeFont, composeFontWeight, setUIFont, setUIFontWeight, setComposeFont, setComposeFontWeight }}
    >
      {children}
    </FontContext.Provider>
  )
}

export function useFonts(): FontContextValue {
  const ctx = useContext(FontContext)
  if (!ctx) throw new Error('useFonts must be used within FontProvider')
  return ctx
}
