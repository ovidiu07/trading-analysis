import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isProtectedApiUrl, toAssetMarkdownUrl, uploadAsset } from './assets'

class MockUploadXhr {
  static latest: MockUploadXhr | null = null

  responseType: XMLHttpRequestResponseType = ''
  response: unknown = null
  status = 0
  statusText = ''
  withCredentials = false
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  onload: (() => void) | null = null
  upload = {
    onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null
  }
  headers: Record<string, string> = {}

  constructor() {
    MockUploadXhr.latest = this
  }

  open() {}

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send() {}
}

const apiUrl = import.meta.env.VITE_API_URL || '/api'
const apiOrigin = /^https?:\/\//i.test(apiUrl) ? new URL(apiUrl).origin : window.location.origin
const originalXmlHttpRequest = globalThis.XMLHttpRequest

describe('assets url helpers', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXmlHttpRequest
    MockUploadXhr.latest = null
    localStorage.clear()
  })

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

  it('resolves upload success from xhr.response when responseType is json', async () => {
    globalThis.XMLHttpRequest = MockUploadXhr as unknown as typeof XMLHttpRequest

    const file = new File(['chart'], 'chart.png', { type: 'image/png' })
    const promise = uploadAsset({
      file,
      scope: 'NOTEBOOK'
    })

    const xhr = MockUploadXhr.latest
    expect(xhr).not.toBeNull()
    Object.defineProperty(xhr as MockUploadXhr, 'responseText', {
      configurable: true,
      get() {
        throw new Error('responseText should not be accessed for json uploads')
      }
    })
    ;(xhr as MockUploadXhr).status = 201
    ;(xhr as MockUploadXhr).responseType = 'json'
    ;(xhr as MockUploadXhr).response = {
      id: 'asset-1',
      scope: 'NOTEBOOK',
      originalFileName: 'chart.png'
    }

    ;(xhr as MockUploadXhr).onload?.()

    await expect(promise).resolves.toMatchObject({
      id: 'asset-1',
      originalFileName: 'chart.png'
    })
  })

  it('builds upload errors from xhr.response when responseType is json', async () => {
    globalThis.XMLHttpRequest = MockUploadXhr as unknown as typeof XMLHttpRequest

    const file = new File(['chart'], 'chart.png', { type: 'image/png' })
    const promise = uploadAsset({
      file,
      scope: 'NOTEBOOK'
    })

    const xhr = MockUploadXhr.latest
    expect(xhr).not.toBeNull()
    Object.defineProperty(xhr as MockUploadXhr, 'responseText', {
      configurable: true,
      get() {
        throw new Error('responseText should not be accessed for json uploads')
      }
    })
    ;(xhr as MockUploadXhr).status = 422
    ;(xhr as MockUploadXhr).statusText = 'Unprocessable Entity'
    ;(xhr as MockUploadXhr).responseType = 'json'
    ;(xhr as MockUploadXhr).response = {
      error: 'UPLOAD_LIMIT',
      message: 'File is too large'
    }

    ;(xhr as MockUploadXhr).onload?.()

    await expect(promise).rejects.toMatchObject({
      status: 422,
      code: 'UPLOAD_LIMIT',
      message: 'File is too large'
    })
  })
})
