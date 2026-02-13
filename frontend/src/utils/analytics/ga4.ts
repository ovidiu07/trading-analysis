const GA_FALLBACK_ID = 'G-8H5HCBG170'
const GA_SCRIPT_ID = 'ga4-gtag-js'
const OUTBOUND_CLICK_THROTTLE_MS = 1000

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    __tradeJAuditGaInitialized?: boolean
    __tradeJAuditOutboundClickListenerBound?: boolean
    __tradeJAuditLastTrackedPagePath?: string
    __tradeJAuditEventThrottleMap?: Record<string, number>
  }
}

const configuredGaId = (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
export const GA_ID = configuredGaId || GA_FALLBACK_ID

const isDevEnabled = import.meta.env.DEV
  ? import.meta.env.VITE_GA_ENABLE_IN_DEV === 'true'
  : true

const isAnalyticsGloballyEnabled = Boolean(GA_ID) && isDevEnabled

function hasAnalyticsConsent() {
  // TODO: Wire this to cookie consent state if/when a consent banner is implemented.
  return true
}

function canUseAnalytics() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && isAnalyticsGloballyEnabled && hasAnalyticsConsent()
}

function ensureDataLayerAndGtag() {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args)
    }
  }
}

function ensureScriptTag() {
  if (document.getElementById(GA_SCRIPT_ID)) {
    return
  }

  const existingBySrc = document.querySelector<HTMLScriptElement>(
    `script[src*="googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}"]`
  )
  if (existingBySrc) {
    existingBySrc.id = existingBySrc.id || GA_SCRIPT_ID
    return
  }

  const script = document.createElement('script')
  script.id = GA_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(script)
}

function normalizePagePath(path: string) {
  const trimmed = (path || '/').trim()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function getCurrentPagePath() {
  if (typeof window === 'undefined') {
    return '/'
  }
  return normalizePagePath(`${window.location.pathname}${window.location.search}`)
}

function getFeatureArea(path: string) {
  const [pathname] = path.split('?')
  const [segment] = pathname.replace(/^\//, '').split('/')
  return segment || 'root'
}

function shouldThrottleEvent(key: string, throttleMs: number) {
  window.__tradeJAuditEventThrottleMap = window.__tradeJAuditEventThrottleMap || {}
  const now = Date.now()
  const previous = window.__tradeJAuditEventThrottleMap[key] || 0
  window.__tradeJAuditEventThrottleMap[key] = now
  return now - previous < throttleMs
}

function getTrimmedErrorMessage(input: unknown) {
  if (typeof input !== 'string') return undefined
  return input.trim().slice(0, 160)
}

function sanitizeEventParams(params: Record<string, unknown>) {
  const pagePath = typeof params.page_path === 'string' && params.page_path
    ? normalizePagePath(params.page_path)
    : getCurrentPagePath()

  const payload: Record<string, unknown> = {
    page_path: pagePath,
    feature_area: typeof params.feature_area === 'string' && params.feature_area
      ? params.feature_area
      : getFeatureArea(pagePath)
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || key === 'page_path' || key === 'feature_area') {
      return
    }
    if (key === 'error_message') {
      const trimmed = getTrimmedErrorMessage(value)
      if (trimmed) payload.error_message = trimmed
      return
    }
    payload[key] = value
  })

  return payload
}

function bindOutboundClickTracking() {
  if (!canUseAnalytics() || window.__tradeJAuditOutboundClickListenerBound) {
    return
  }

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
    if (!anchor) return

    const href = anchor.getAttribute('href')
    if (!href || href.startsWith('#')) return

    let destination: URL
    try {
      destination = new URL(anchor.href, window.location.href)
    } catch {
      return
    }

    if (!['http:', 'https:'].includes(destination.protocol)) return
    if (destination.origin === window.location.origin) return

    const throttleKey = `outbound_link_click:${destination.href}`
    if (shouldThrottleEvent(throttleKey, OUTBOUND_CLICK_THROTTLE_MS)) return

    trackEvent('outbound_link_click', {
      destination_url: destination.href,
      link_text: anchor.textContent?.trim().slice(0, 120) || undefined
    })
  }, true)

  window.__tradeJAuditOutboundClickListenerBound = true
}

export function initializeAnalytics() {
  if (!canUseAnalytics() || window.__tradeJAuditGaInitialized) {
    return
  }

  ensureScriptTag()
  ensureDataLayerAndGtag()

  window.gtag?.('js', new Date())
  window.gtag?.('config', GA_ID, { send_page_view: false })
  window.__tradeJAuditGaInitialized = true

  bindOutboundClickTracking()
}

export function trackPageView(path: string) {
  if (!canUseAnalytics()) return

  initializeAnalytics()
  if (typeof window.gtag !== 'function') return

  const pagePath = normalizePagePath(path)
  if (window.__tradeJAuditLastTrackedPagePath === pagePath) {
    return
  }

  window.__tradeJAuditLastTrackedPagePath = pagePath
  window.gtag('config', GA_ID, {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title
  })
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!canUseAnalytics() || !name) return

  initializeAnalytics()
  if (typeof window.gtag !== 'function') return

  const payload = sanitizeEventParams(params)
  window.gtag('event', name, payload)
}
