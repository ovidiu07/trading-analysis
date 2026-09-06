import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { uploadAsset } from '../../api/assets'
import TradeReviewAssets from './TradeReviewAssets'
vi.mock('../../api/assets', async original => ({ ...await original<typeof import('../../api/assets')>(), listTradeAssets: vi.fn().mockResolvedValue([]), uploadAsset: vi.fn() }))
beforeEach(() => { localStorage.setItem('app.language', 'en'); vi.clearAllMocks() })
afterEach(cleanup)
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><I18nProvider><TradeReviewAssets tradeId="owned-trade" /></I18nProvider></QueryClientProvider>)
describe('Trade review screenshots', () => {
  it('retains the chosen file after failure and retries the owned asset upload', async () => {
    vi.mocked(uploadAsset).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'asset', scope: 'TRADE', originalFileName: 'synthetic.png' })
    show()
    const file = new File(['synthetic'], 'synthetic.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Choose screenshot', { selector: 'input' }), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Save screenshot' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(2))
    expect(uploadAsset).toHaveBeenLastCalledWith({ file, scope: 'TRADE', tradeId: 'owned-trade' })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved')
  })
  it('rejects non-image files before upload', async () => {
    show()
    fireEvent.change(screen.getByLabelText('Choose screenshot', { selector: 'input' }), { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG')
    expect(uploadAsset).not.toHaveBeenCalled()
  })
})
