import { CssBaseline, ThemeProvider } from '@mui/material'
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { createAppTheme } from './theme'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedThemeMode = 'light' | 'dark'
export type BackendThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM'

type ThemeModeContextType = {
  preference: ThemePreference
  resolvedMode: ResolvedThemeMode
  setPreference: (preference: ThemePreference) => void
}

const STORAGE_KEY = 'app.themePreference'

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined)

const normalizeThemePreference = (value?: string | null): ThemePreference => {
  if (value === 'light' || value === 'LIGHT') return 'light'
  if (value === 'dark' || value === 'DARK') return 'dark'
  return 'system'
}

const getSystemMode = (): ResolvedThemeMode =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const toBackendThemePreference = (preference: ThemePreference): BackendThemePreference =>
  preference.toUpperCase() as BackendThemePreference

export const fromBackendThemePreference = (value?: string | null): ThemePreference =>
  normalizeThemePreference(value)

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return normalizeThemePreference(stored)
  })
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemMode)
  const hasManualChange = useRef(false)
  const previousUserId = useRef<string | null>(null)

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    hasManualChange.current = true
    const normalized = normalizeThemePreference(nextPreference)
    localStorage.setItem(STORAGE_KEY, normalized)
    setPreferenceState(normalized)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemMode(event.matches ? 'dark' : 'light')
    setSystemMode(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (user?.id !== previousUserId.current) {
      hasManualChange.current = false
      previousUserId.current = user?.id ?? null
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.themePreference || hasManualChange.current) return
    const serverPreference = fromBackendThemePreference(user.themePreference)
    setPreferenceState(serverPreference)
    localStorage.setItem(STORAGE_KEY, serverPreference)
  }, [user?.themePreference])

  const resolvedMode = preference === 'system' ? systemMode : preference

  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedMode
    document.documentElement.dataset.theme = resolvedMode
  }, [resolvedMode])

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode])

  const value = useMemo<ThemeModeContextType>(() => ({
    preference,
    resolvedMode,
    setPreference
  }), [preference, resolvedMode, setPreference])

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider')
  }
  return context
}
