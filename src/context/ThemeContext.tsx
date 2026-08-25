import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ThemeMode } from '@cortex/core'

type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  /** Resolved theme actually applied — 'system' is never exposed here. */
  theme: ResolvedTheme
  /** Raw stored preference, including 'system'. */
  themePreference: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({
  children,
  vaultReady,
}: {
  children: ReactNode
  vaultReady: boolean
}) {
  const [themePreference, setThemePreference] = useState<ThemeMode>('dark')
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(resolveSystemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const theme: ResolvedTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!vaultReady) return
    window.cortex.settings.getTheme().then(setThemePreference).catch(() => {})
  }, [vaultReady])

  const setTheme = useCallback(
    async (next: ThemeMode) => {
      setThemePreference(next)
      if (vaultReady) {
        try {
          await window.cortex.settings.setTheme(next)
        } catch {
          // vault may not be ready yet
        }
      }
    },
    [vaultReady]
  )

  return (
    <ThemeContext.Provider value={{ theme, themePreference, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
