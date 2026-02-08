import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en.json'
import ro from './ro.json'

export type AppLanguage = 'en' | 'ro'

type TranslationParams = Record<string, string | number>

type I18nContextType = {
  language: AppLanguage
  locale: string
  setLanguage: (language: AppLanguage) => void
  t: (key: string, params?: TranslationParams) => string
}

type TranslationTree = Record<string, unknown>

const STORAGE_KEY = 'app.language'
const LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  ro: 'ro-RO'
}

const RESOURCES: Record<AppLanguage, TranslationTree> = { en, ro }

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const resolveLanguage = (value?: string | null): AppLanguage => {
  if (value === 'ro') return 'ro'
  return 'en'
}

const detectLanguageFromUrl = (): AppLanguage | null => {
  const params = new URLSearchParams(window.location.search)
  const queryLanguage = params.get('lang')
  if (queryLanguage === 'en' || queryLanguage === 'ro') {
    return queryLanguage
  }

  const pathname = window.location.pathname.toLowerCase()
  if (pathname === '/ro' || pathname.startsWith('/ro/')) {
    return 'ro'
  }
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    return 'en'
  }
  return null
}

const detectInitialLanguage = (): AppLanguage => {
  const fromUrl = detectLanguageFromUrl()
  if (fromUrl) {
    return fromUrl
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ro') {
    return stored
  }
  const browserLanguage = navigator.language.toLowerCase()
  return browserLanguage.startsWith('ro') ? 'ro' : 'en'
}

const getNestedValue = (tree: TranslationTree, key: string): string | undefined => {
  const parts = key.split('.')
  let current: unknown = tree
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined
    }
    current = (current as TranslationTree)[part]
  }
  return typeof current === 'string' ? current : undefined
}

const interpolate = (template: string, params?: TranslationParams): string => {
  if (!params) return template
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = params[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

let currentLanguage: AppLanguage = detectInitialLanguage()

export const getCurrentLanguage = (): AppLanguage => currentLanguage
export const getCurrentLocale = (): string => LOCALES[currentLanguage]
export const resolveAppLanguage = resolveLanguage

const resolveTranslation = (language: AppLanguage, key: string, params?: TranslationParams): string => {
  const localized = getNestedValue(RESOURCES[language], key)
  if (localized) {
    return interpolate(localized, params)
  }
  const english = getNestedValue(RESOURCES.en, key)
  if (english) {
    return interpolate(english, params)
  }
  return key
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>(currentLanguage)

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    const normalized = resolveLanguage(nextLanguage)
    currentLanguage = normalized
    localStorage.setItem(STORAGE_KEY, normalized)
    setLanguageState(normalized)
  }, [])

  useEffect(() => {
    currentLanguage = language
    document.documentElement.lang = language
  }, [language])

  const t = useCallback((key: string, params?: TranslationParams) => {
    return resolveTranslation(language, key, params)
  }, [language])

  const value = useMemo<I18nContextType>(() => ({
    language,
    locale: LOCALES[language],
    setLanguage,
    t
  }), [language, setLanguage, t])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
