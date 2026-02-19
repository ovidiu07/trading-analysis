import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownContent from './MarkdownContent'

const assetsApiMock = vi.hoisted(() => ({
  fetchAssetBlob: vi.fn(),
  isProtectedApiUrl: vi.fn(),
  resolveAssetUrl: vi.fn((value?: string | null) => value || '')
}))

vi.mock('../../api/assets', () => assetsApiMock)

describe('MarkdownContent', () => {
  beforeEach(() => {
    assetsApiMock.fetchAssetBlob.mockReset()
    assetsApiMock.isProtectedApiUrl.mockReset()
    assetsApiMock.resolveAssetUrl.mockImplementation((value?: string | null) => value || '')
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => 'blob:markdown-image')
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn()
    })
  })

  it('loads protected asset image URLs through authenticated blob fetch', async () => {
    assetsApiMock.isProtectedApiUrl.mockImplementation((value?: string | null) => (value || '').includes('/api/assets/'))
    assetsApiMock.fetchAssetBlob.mockResolvedValue(new Blob(['img'], { type: 'image/png' }))

    render(<MarkdownContent content="![Chart](/api/assets/asset-1/view)" />)

    await waitFor(() => {
      expect(assetsApiMock.fetchAssetBlob).toHaveBeenCalledWith('/api/assets/asset-1/view')
    })

    expect(await screen.findByRole('img', { name: 'Chart' })).toHaveAttribute('src', 'blob:markdown-image')
  })

  it('renders public image URLs without authenticated fetch', async () => {
    assetsApiMock.isProtectedApiUrl.mockReturnValue(false)
    assetsApiMock.resolveAssetUrl.mockImplementation((value?: string | null) => value || '')

    render(<MarkdownContent content="![Chart](https://cdn.example.com/chart.png)" />)

    const image = await screen.findByRole('img', { name: 'Chart' })
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/chart.png')
    expect(assetsApiMock.fetchAssetBlob).not.toHaveBeenCalled()
  })
})
