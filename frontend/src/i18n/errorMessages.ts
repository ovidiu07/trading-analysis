import { ApiError } from '../api/client'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

const API_CODE_MAP: Record<string, string> = {
  EMAIL_NOT_VERIFIED: 'errors.EMAIL_NOT_VERIFIED',
  EMAIL_IN_USE: 'errors.EMAIL_IN_USE',
  CAPTCHA_FAILED: 'errors.CAPTCHA_FAILED',
  RATE_LIMITED: 'errors.RATE_LIMITED',
  NOT_IMPLEMENTED: 'errors.NOT_IMPLEMENTED',
  VALIDATION_ERROR: 'errors.validation',
  UNAUTHORIZED: 'errors.unauthorized',
  NOT_FOUND: 'errors.notFound'
}

export const translateApiError = (error: unknown, t: TranslateFn, fallbackKey = 'errors.generic'): string => {
  if (error instanceof ApiError) {
    if (error.code && API_CODE_MAP[error.code]) {
      return t(API_CODE_MAP[error.code])
    }
    if (error.status === 401) return t('errors.unauthorized')
    if (error.status === 403) return t('errors.forbidden')
    if (error.status === 404) return t('errors.notFound')
    if (!navigator.onLine) return t('errors.network')
    return t(fallbackKey)
  }
  return t(fallbackKey)
}
