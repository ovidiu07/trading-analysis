import { describe, expect, it } from 'vitest'
import { isProtectedApiUrl, toAssetMarkdownUrl } from './assets'

const apiUrl = import.meta.env.VITE_API_URL || '/api'
const apiOrigin = /^https?:\/\//i.test(apiUrl) ? new URL(apiUrl).origin : window.location.origin

describe('assets url helpers', () => {
  it('marks relative /api URLs as protected', () => {
    expect(isProtectedApiUrl('/api/assets/123/view')).toBe(true)
  })

  it('detects same-origin absolute API URLs as protected', () => {
    const absolute = `${apiOrigin}/api/assets/123/view`
    expect(isProtectedApiUrl(absolute)).toBe(true)
  })

  it('keeps non-api URLs as unprotected', () => {
    expect(isProtectedApiUrl('https://example.com/images/chart.png')).toBe(false)
  })

  it('normalizes same-origin absolute asset API URLs to relative markdown URLs', () => {
    const absolute = `${apiOrigin}/api/assets/123/view?mode=inline`
    expect(toAssetMarkdownUrl(absolute)).toBe('/api/assets/123/view?mode=inline')
  })

  it('keeps external URLs unchanged for markdown', () => {
    const external = 'https://cdn.example.com/path/chart.png'
    expect(toAssetMarkdownUrl(external)).toBe(external)
  })
})
