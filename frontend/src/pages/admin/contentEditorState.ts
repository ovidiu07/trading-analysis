import type { AppLanguage } from '../../i18n'
import type { ContentPost, ContentPostRequest, LocalizedContent } from '../../api/content'

export type EditorLocale = AppLanguage

export type LocalizedDraft = {
  title: string
  summary: string
  body: string
}

export type TranslationDraft = Record<EditorLocale, LocalizedDraft>

const emptyDraft = (): LocalizedDraft => ({ title: '', summary: '', body: '' })

const normalize = (value?: string | null) => value ?? ''

export const createDefaultTranslations = (
  translations?: Record<string, LocalizedContent> | null,
  resolved?: Pick<ContentPost, 'title' | 'summary' | 'body' | 'resolvedLocale'> | null
): TranslationDraft => {
  const draft: TranslationDraft = {
    en: emptyDraft(),
    ro: emptyDraft()
  }

  if (translations) {
    if (translations.en) {
      draft.en = {
        title: normalize(translations.en.title),
        summary: normalize(translations.en.summary),
        body: normalize(translations.en.body)
      }
    }
    if (translations.ro) {
      draft.ro = {
        title: normalize(translations.ro.title),
        summary: normalize(translations.ro.summary),
        body: normalize(translations.ro.body)
      }
    }
  }

  if (resolved?.resolvedLocale === 'en' && !draft.en.title && !draft.en.body) {
    draft.en = {
      title: normalize(resolved.title),
      summary: normalize(resolved.summary),
      body: normalize(resolved.body)
    }
  }

  if (resolved?.resolvedLocale === 'ro' && !draft.ro.title && !draft.ro.body) {
    draft.ro = {
      title: normalize(resolved.title),
      summary: normalize(resolved.summary),
      body: normalize(resolved.body)
    }
  }

  return draft
}

export const updateLocalizedField = (
  translations: TranslationDraft,
  locale: EditorLocale,
  patch: Partial<LocalizedDraft>
): TranslationDraft => ({
  ...translations,
  [locale]: {
    ...translations[locale],
    ...patch
  }
})

const hasRequiredTranslation = (entry: LocalizedDraft) =>
  Boolean(entry.title.trim()) && Boolean(entry.body.trim())

const hasAnyContent = (entry: LocalizedDraft) =>
  Boolean(entry.title.trim() || entry.summary.trim() || entry.body.trim())

export const isLocaleMissing = (translations: TranslationDraft, locale: EditorLocale) => !hasRequiredTranslation(translations[locale])

export const buildTranslationsPayload = (translations: TranslationDraft): ContentPostRequest['translations'] => {
  const payload: ContentPostRequest['translations'] = {
    en: {
      title: translations.en.title.trim(),
      summary: translations.en.summary.trim() || undefined,
      body: translations.en.body.trim()
    }
  }

  if (hasRequiredTranslation(translations.ro) || hasAnyContent(translations.ro)) {
    payload.ro = {
      title: translations.ro.title.trim(),
      summary: translations.ro.summary.trim() || undefined,
      body: translations.ro.body.trim()
    }
  }

  return payload
}

export const copyLocaleContent = (source: LocalizedDraft): LocalizedDraft => ({
  title: source.title,
  summary: source.summary,
  body: source.body
})
