import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '../../api/client'
import OfficialEventInbox from './OfficialEventInbox'
vi.mock('../../api/client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const event = { sourceId: 'BLS', eventId: 'one', sourceEventId: 'native', identityBasis: 'SOURCE_UID', name: 'Employment',
 scheduledAt: '2026-09-01T12:30:00Z', scheduledDate: '2026-09-01', sourceTimezone: 'America/New_York', status: 'UPCOMING',
 retrievedAt: '2026-09-01T08:00:00Z', sourceUrl: 'https://www.bls.gov/' }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiGet).mockResolvedValue({ suggestions: [{ id: 'r1', revision: 1, event }], runs: [], measures: [] }) })
afterEach(cleanup)
describe('official event admin review', () => {
 it('discards an in-flight reviewed suggestion after switching drafts', async () => {
   let resolve!: (value: unknown) => void
   vi.mocked(apiPost).mockReturnValue(new Promise(done => { resolve = done }))
   const use = vi.fn()
   const view = render(<OfficialEventInbox key="first" date="2026-09-01" disabled={false} onUse={use} />)
   fireEvent.click(await screen.findByRole('button', { name: 'officialEvents.review' }))
   fireEvent.click(screen.getByRole('button', { name: 'officialEvents.useReviewed' }))
   view.rerender(<OfficialEventInbox key="second" date="2026-09-02" disabled={false} onUse={use} />)
   await act(async () => resolve({ id: 'old-draft-event' }))
   expect(use).not.toHaveBeenCalled()
 })
 it('only adds a reviewed suggestion to the draft and never publishes', async () => {
   const use = vi.fn(); vi.mocked(apiPost).mockResolvedValue({ id: 'official-event' })
   render(<OfficialEventInbox date="2026-09-01" disabled={false} onUse={use} />)
   fireEvent.click(await screen.findByRole('button', { name: 'officialEvents.review' }))
   expect(screen.getByRole('button', { name: 'officialEvents.fetchResult' })).toBeDisabled()
   fireEvent.click(screen.getByRole('button', { name: 'officialEvents.useReviewed' }))
   await waitFor(() => expect(use).toHaveBeenCalledWith({ id: 'official-event' }))
   expect(apiPost).toHaveBeenCalledTimes(1)
   expect(apiPost).toHaveBeenCalledWith('/admin/official-events/r1/review', {})
 })
 it('keeps prior suggestions visible on source failure', async () => {
   vi.mocked(apiPost).mockRejectedValue(new Error('Official source HTTP 403'))
   render(<OfficialEventInbox date="2026-09-01" disabled={false} onUse={vi.fn()} />)
   await screen.findByRole('button', { name: 'officialEvents.review' })
   fireEvent.click(screen.getByRole('button', { name: 'officialEvents.refresh BLS' }))
   expect(await screen.findByText(/Official source HTTP 403/)).toBeInTheDocument()
   expect(screen.getByRole('button', { name: 'officialEvents.review' })).toBeInTheDocument()
 })
})
